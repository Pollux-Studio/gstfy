import { createCipheriv, createDecipheriv } from "node:crypto"

export function aesEncrypt(value: string, sessionKey: string) {
  const key = decodeAesKey(sessionKey)
  const cipher = createCipheriv(`aes-${key.length * 8}-ecb`, key, null)
  return Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64")
}

export function aesDecrypt(value: string, key: Buffer) {
  return aesDecryptBuffer(value, key).toString("utf8")
}

export function aesDecryptSessionKey(value: string, key: Buffer) {
  const decrypted = aesDecryptBuffer(value, key)

  if (isAesKeyLength(decrypted.length)) {
    return decrypted.toString("base64")
  }

  const decodedText = decrypted.toString("utf8").trim()
  if (decodedText) {
    try {
      const decoded = decodeAesKey(decodedText)
      if (isAesKeyLength(decoded.length)) {
        return decoded.toString("base64")
      }
    } catch {
      // Fall through with the actual decrypted length below.
    }
  }

  throw new RangeError(
    `IRP5 decrypted session key must be 16, 24, or 32 bytes; received ${decrypted.length} bytes. Check that IRP5_APP_KEY matches the AppKey used for authentication.`
  )
}

function aesDecryptBuffer(value: string, key: Buffer) {
  const decipher = createDecipheriv(`aes-${key.length * 8}-ecb`, key, null)
  return Buffer.concat([decipher.update(value, "base64"), decipher.final()])
}

export function decodeAesKey(value: string) {
  const normalized = value.trim()
  const base64 = normalized.replace(/-/g, "+").replace(/_/g, "/")
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const decoded = Buffer.from(paddedBase64, "base64")

  if (isAesKeyLength(decoded.length)) {
    return decoded
  }

  if (/^[0-9a-f]{64}$/i.test(normalized)) {
    return Buffer.from(normalized, "hex")
  }

  const raw = Buffer.from(normalized, "utf8")
  if (isAesKeyLength(raw.length)) {
    return raw
  }

  throw new RangeError(`IRP5 AES key must be 16, 24, or 32 bytes; received ${raw.length} bytes.`)
}

function isAesKeyLength(length: number) {
  return length === 16 || length === 24 || length === 32
}
