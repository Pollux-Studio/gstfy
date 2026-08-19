import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"

import { getEnv } from "../config/env.js"
import { HttpError } from "./http-error.js"

const productImageMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
])

export const productImageMaxBytes = 15 * 1024 * 1024
export const productImageMaxSizeLabel = "15 MB"
let cachedClient: S3Client | null = null

type UploadProductImageInput = {
  body: Buffer
  businessId: string
  contentType: string
  fileName?: string | null
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
}: UploadProductImageInput): Promise<UploadedObject> {
  const extension = productImageMimeTypes.get(contentType)

  if (!extension) {
    throw new HttpError(400, "Only JPG, PNG, and WebP product images are supported.")
  }

  if (body.byteLength === 0) {
    throw new HttpError(400, "Image file is empty.")
  }

  if (body.byteLength > productImageMaxBytes) {
    throw new HttpError(400, `Product image must be ${productImageMaxSizeLabel} or smaller.`)
  }

  const env = getEnv()
  const objectKey = `businesses/${businessId}/products/${randomUUID()}.${extension}`

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
