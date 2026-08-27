import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"

import { getEnv } from "../config/env.js"
import { HttpError } from "./http-error.js"

const imageMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
])

export const productImageMaxBytes = 15 * 1024 * 1024
export const productImageMaxSizeLabel = "15 MB"
export const businessLogoMaxBytes = 2 * 1024 * 1024
export const businessLogoMaxSizeLabel = "2 MB"
export const r2MultipartMaxBytes = Math.max(productImageMaxBytes, businessLogoMaxBytes)
let cachedClient: S3Client | null = null

type UploadImageInput = {
  body: Buffer
  businessId: string
  contentType: string
  fileName?: string | null
  folder: "products" | "logos" | "invoice-logos"
  maxBytes: number
  maxSizeLabel: string
  label: string
}

export type UploadedObject = {
  contentType: string
  fileSizeBytes: number
  objectKey: string
  publicUrl: string
}

export async function uploadProductImageObject({
  body,
  businessId,
  contentType,
  fileName,
}: Omit<UploadImageInput, "folder" | "maxBytes" | "maxSizeLabel" | "label">): Promise<UploadedObject> {
  return uploadImageObject({
    body,
    businessId,
    contentType,
    fileName,
    folder: "products",
    label: "Product image",
    maxBytes: productImageMaxBytes,
    maxSizeLabel: productImageMaxSizeLabel,
  })
}

export async function uploadBusinessLogoObject({
  body,
  businessId,
  contentType,
  fileName,
}: Omit<UploadImageInput, "folder" | "maxBytes" | "maxSizeLabel" | "label">): Promise<UploadedObject> {
  return uploadImageObject({
    body,
    businessId,
    contentType,
    fileName,
    folder: "logos",
    label: "Business logo",
    maxBytes: businessLogoMaxBytes,
    maxSizeLabel: businessLogoMaxSizeLabel,
  })
}

export async function uploadInvoiceLogoObject({
  body,
  businessId,
  contentType,
  fileName,
}: Omit<UploadImageInput, "folder" | "maxBytes" | "maxSizeLabel" | "label">): Promise<UploadedObject> {
  return uploadImageObject({
    body,
    businessId,
    contentType,
    fileName,
    folder: "invoice-logos",
    label: "Invoice logo",
    maxBytes: businessLogoMaxBytes,
    maxSizeLabel: businessLogoMaxSizeLabel,
  })
}

async function uploadImageObject({
  body,
  businessId,
  contentType,
  fileName,
  folder,
  label,
  maxBytes,
  maxSizeLabel,
}: UploadImageInput): Promise<UploadedObject> {
  const extension = imageMimeTypes.get(contentType)

  if (!extension) {
    throw new HttpError(400, `Only JPG, PNG, and WebP ${label.toLowerCase()} files are supported.`)
  }

  if (body.byteLength === 0) {
    throw new HttpError(400, "Image file is empty.")
  }

  if (body.byteLength > maxBytes) {
    throw new HttpError(400, `${label} must be ${maxSizeLabel} or smaller.`)
  }

  const env = getEnv()
  const objectKey = `businesses/${businessId}/${folder}/${randomUUID()}.${extension}`

  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata:
          fileName ? { "original-file-name": sanitizeMetadataValue(fileName) } : undefined,
      })
    )
  } catch (error) {
    throw new HttpError(
      502,
      `Cloudflare R2 upload failed.${getUploadTroubleshootingMessage(error)}${getUploadErrorSuffix(error)}`
    )
  }

  return {
    contentType,
    fileSizeBytes: body.byteLength,
    objectKey,
    publicUrl: getObjectPublicUrl(objectKey),
  }
}

function getR2Client() {
  if (cachedClient) {
    return cachedClient
  }

  const env = getEnv()

  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new HttpError(
      500,
      "R2 upload credentials are not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
    )
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    forcePathStyle: env.R2_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })

  return cachedClient
}

function getObjectPublicUrl(objectKey: string) {
  const env = getEnv()
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL ?? `${env.R2_ENDPOINT}/${env.R2_BUCKET_NAME}`

  return `${publicBaseUrl.replace(/\/$/, "")}/${encodeObjectKey(objectKey)}`
}

function encodeObjectKey(objectKey: string) {
  return objectKey.split("/").map(encodeURIComponent).join("/")
}

function sanitizeMetadataValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "").slice(0, 180)
}

function getUploadErrorSuffix(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return ""
  }

  const name = error.name

  return typeof name === "string" && name ? ` Provider error: ${name}.` : ""
}

function getUploadTroubleshootingMessage(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error && typeof error.name === "string" ?
      error.name
    : ""

  if (name === "AccessDenied") {
    return " R2 denied object write access. Use an R2 S3 API token with Object Read & Write permission scoped to the gstfy bucket, verify the Access Key ID and Secret Access Key pair, and use the jurisdiction-specific endpoint if the bucket was created in a jurisdiction."
  }

  return " Check R2 endpoint, bucket, access key, secret key, and object-write permission."
}
