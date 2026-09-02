import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import { getEnv } from "../config/env.js"

type EncryptedSecret = {
  ciphertext: string
  iv: string
  tag: string
}

const algorithm = "aes-256-gcm"

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ])

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  }
}

export function decryptSecret(value: EncryptedSecret) {
  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(value.iv, "base64")
  )
  decipher.setAuthTag(Buffer.from(value.tag, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

function getEncryptionKey() {
  return createHash("sha256")
    .update(getEnv().STATUS_ENCRYPTION_KEY)
    .digest()
}
