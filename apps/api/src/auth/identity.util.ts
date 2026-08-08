const phonePattern = /^\d{10}$/

export type NormalizedIdentity =
  | { type: "email"; value: string }
  | { type: "phone"; value: string }

export function normalizeIdentifier(identifier: string): NormalizedIdentity {
  const trimmed = identifier.trim()

  if (trimmed.includes("@")) {
    return {
      type: "email",
      value: trimmed.toLowerCase(),
    }
  }

  let digits = trimmed.replace(/\D/g, "")

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2)
  }

  if (!phonePattern.test(digits)) {
    throw new Error("Identifier must be a valid email or 10-digit Indian phone number")
  }

  return {
    type: "phone",
    value: `+91${digits}`,
  }
}
