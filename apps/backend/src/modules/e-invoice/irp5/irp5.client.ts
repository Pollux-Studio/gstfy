import { constants, createHash, createPublicKey, publicEncrypt } from "node:crypto"

import { getEnv } from "../../../config/env.js"
import {
  aesDecrypt,
  aesDecryptSessionKey,
  aesEncrypt,
  decodeAesKey,
} from "./irp5.crypto.js"

type JsonRecord = Record<string, unknown>

type TokenCache = {
  token: string
  sek: string
  gstin: string | null
  expiresAt: number
}

export class Irp5AuthenticationError extends Error {
  constructor(
    public readonly providerResponse: {
      Status?: unknown
      Data?: unknown
      ErrorDetails?: unknown
      InfoDtls?: unknown
    }
  ) {
    super("IRP5 authentication did not return an access token.")
    this.name = "Irp5AuthenticationError"
  }
}

let tokenCache: TokenCache | null = null
const sandboxTestGstin = "33HXUPP8249C1Z2"

export class Irp5Client {
  private readonly env = getEnv()

  async generate(payload: JsonRecord) {
    const sellerDetails = getRecord(payload.SellerDtls)
    const gstin = this.resolveGstin(getString(sellerDetails, "Gstin") ?? undefined)
    const providerPayload = {
      ...payload,
      SellerDtls: {
        ...(sellerDetails ?? {}),
        Gstin: gstin,
      },
    }
    const payloadJson = JSON.stringify(providerPayload)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const auth = await this.authenticate(gstin, attempt === 1)
      const response = await this.request("/irp5/irpapi/v1.0/api/generate", {
        method: "POST",
        token: auth.token,
        gstin,
        body: { Data: aesEncrypt(payloadJson, auth.sek) },
      })

      if (!isRequestDecryptionFailure(response) || attempt === 1) {
        return decryptProviderResponse(response, auth.sek)
      }

      tokenCache = null
    }

    throw new Error("IRP5 generation failed after re-authentication.")
  }

  async search(input: { irn: string | null; providerReference: string | null; gstin?: string }) {
    const gstin = this.resolveGstin(input.gstin)
    const auth = await this.authenticate(gstin)
    const query = new URLSearchParams()

    if (input.irn) {
      query.set("irn", input.irn)
    }
    if (input.providerReference) {
      query.set("referenceId", input.providerReference)
    }

    const response = await this.request(`/irp5/irpapi/v1.0/enSearch?${query.toString()}`, {
      method: "GET",
      token: auth.token,
      gstin,
    })
    return decryptProviderResponse(response, auth.sek)
  }

  async cancel(input: { irn: string; reason: string; gstin?: string }) {
    const gstin = this.resolveGstin(input.gstin)
    const auth = await this.authenticate(gstin)
    const response = await this.request("/irp5/irpapi/v1.0/api/cancel", {
      method: "POST",
      token: auth.token,
      gstin,
      body: { Data: aesEncrypt(JSON.stringify({
        Irn: input.irn,
        CnlRsn: "1",
        CnlRem: input.reason,
      }), auth.sek) },
    })
    return decryptProviderResponse(response, auth.sek)
  }

  async testAuthentication(gstin: string) {
    await this.authenticate(this.resolveGstin(gstin))
    return { authenticated: true }
  }

  private async authenticate(gstin?: string, forceRefresh = false) {
    if (
      !forceRefresh &&
      tokenCache &&
      tokenCache.expiresAt > Date.now() + 60_000 &&
      (!gstin || tokenCache.gstin === gstin)
    ) {
      return tokenCache
    }

    const response = await this.request("/irp5/irpauthapi/v1.0/apiAuth", {
      method: "POST",
      skipAuth: true,
      body: {
        Data: encryptAuthPayload({
          UserName: this.env.IRP5_USERNAME,
          Password: this.env.IRP5_PASSWORD,
          AppKey: this.env.IRP5_APP_KEY,
          ForceRefreshAccessToken: true,
        }, this.env.IRP5_PUBLIC_KEY),
      },
      headers: {
        client_id: this.env.IRP5_CLIENT_ID ?? "",
        client_secret: this.env.IRP5_CLIENT_SECRET ?? "",
        Gstin: gstin ?? "",
      },
    })
    const data = getResponseData(response)
    const token = getStringDeep(
      data,
      "AuthToken",
      "authToken",
      "Auth_Token",
      "AccessToken",
      "accessToken",
      "access_token",
      "Token",
      "token"
    )

    if (!token) {
      throw new Irp5AuthenticationError({
        Status: response.Status,
        Data: redactTokenFields(response.Data),
        ErrorDetails: response.ErrorDetails,
        InfoDtls: response.InfoDtls,
      })
    }

    const expiresIn = Number(getStringDeep(data, "expiresIn", "ExpiresIn", "expires_in") ?? 21_600)
    const encryptedSek = getStringDeep(data, "Sek", "sek")
    if (!encryptedSek || !this.env.IRP5_APP_KEY) {
      throw new Error("IRP5 authentication did not return a usable session key.")
    }

    tokenCache = {
      token,
      sek: aesDecryptSessionKey(encryptedSek, decodeAesKey(this.env.IRP5_APP_KEY)),
      gstin: gstin ?? null,
      expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 21_600_000),
    }
    return tokenCache
  }

  private resolveGstin(gstin?: string) {
    return this.env.EINVOICE_ENVIRONMENT === "sandbox" ? sandboxTestGstin : gstin
  }

  private async request(
    path: string,
    input: {
      method: "GET" | "POST"
      token?: string
      gstin?: string
      skipAuth?: boolean
      body?: JsonRecord
      headers?: Record<string, string>
    }
  ) {
    const baseUrl = this.env.IRP5_BASE_URL
    if (!baseUrl) {
      throw new Error("IRP5_BASE_URL is not configured.")
    }

    if (this.env.EINVOICE_ENVIRONMENT === "production" && !this.env.EINVOICE_LIVE_ENABLED) {
      throw new Error("Live e-invoice operations are disabled.")
    }

    const response = await fetch(new URL(path, baseUrl), {
      method: input.method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "GSTFY/1.0",
        ...(input.token ? {
          client_id: this.env.IRP5_CLIENT_ID ?? "",
          client_secret: this.env.IRP5_CLIENT_SECRET ?? "",
          Gstin: input.gstin ?? "",
          user_name: this.env.IRP5_USERNAME ?? "",
          AuthToken: input.token,
        } : {}),
        ...(input.headers ?? {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    })

    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { message: raw.slice(0, 500) }
    }

    if (!response.ok) {
      throw new Error(`IRP5 request failed with HTTP ${response.status}.`)
    }

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ?
      parsed as JsonRecord
      : { data: parsed }
  }
}

function isRequestDecryptionFailure(response: JsonRecord) {
  const errorDetails = response.ErrorDetails
  if (!Array.isArray(errorDetails)) {
    return false
  }

  return errorDetails.some((error) =>
    error && typeof error === "object" && !Array.isArray(error) &&
    (error as JsonRecord).ErrorCode === "1090"
  )
}

function decryptProviderResponse(response: JsonRecord, sessionKey: string) {
  if (typeof response.Data !== "string") {
    return response
  }

  try {
    const decrypted = aesDecrypt(response.Data, decodeAesKey(sessionKey))
    return { ...response, Data: JSON.parse(decrypted) as unknown }
  } catch {
    return response
  }
}

function encryptAuthPayload(payload: JsonRecord, publicKey: string | undefined) {
  if (!publicKey) {
    throw new Error("IRP5_PUBLIC_KEY is not configured.")
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64")
  const normalizedKey = publicKey.replace(/\\n/g, "\n").trim()
  const key = toPublicKey(normalizedKey)

  return publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(encodedPayload, "utf8")
  ).toString("base64")
}

function toPublicKey(value: string) {
  if (value.includes("BEGIN ")) {
    return createPublicKey(value)
  }

  return createPublicKey({
    key: Buffer.from(value.replace(/\s/g, ""), "base64"),
    format: "der",
    type: "spki",
  })
}

function getString(source: unknown, ...keys: string[]) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null
  }

  for (const key of keys) {
    const value = (source as JsonRecord)[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getRecord(source: unknown) {
  return source && typeof source === "object" && !Array.isArray(source) ?
    source as JsonRecord
    : null
}

function getResponseData(response: JsonRecord) {
  const data = response.Data ?? response.data ?? response.Result ?? response.result
  return data && typeof data === "object" && !Array.isArray(data) ? data as JsonRecord : response
}

function getStringDeep(source: unknown, ...keys: string[]): string | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null
  }

  const record = source as JsonRecord
  const directValue = getString(record, ...keys)
  if (directValue) {
    return directValue
  }

  for (const value of Object.values(record)) {
    const nestedValue = getStringDeep(value, ...keys)
    if (nestedValue) {
      return nestedValue
    }
  }

  return null
}

function redactTokenFields(source: unknown): unknown {
  if (Array.isArray(source)) {
    return source.map(redactTokenFields)
  }

  if (!source || typeof source !== "object") {
    return source
  }

  return Object.fromEntries(
    Object.entries(source as JsonRecord).map(([key, value]) => {
      const isTokenField = [
        "AuthToken",
        "authToken",
        "AccessToken",
        "accessToken",
        "access_token",
        "Token",
        "token",
      ].includes(key)

      return [key, isTokenField ? "[REDACTED]" : redactTokenFields(value)]
    })
  )
}

export function hashIrp5Request(payload: JsonRecord) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}
