import { HttpError } from "../../utils/http-error.js"

type JournalValidationInput = {
  journal: {
    lines: Array<{
      debit: string
      credit: string
    }>
  }
}

export function validateBalancedJournal(input: JournalValidationInput) {
  const totals = input.journal.lines.reduce(
    (current, line) => {
      const debit = toCents(line.debit)
      const credit = toCents(line.credit)

      if (debit < 0 || credit < 0) {
        throw new HttpError(400, "Journal debit and credit values must be positive.")
      }

      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw new HttpError(
          400,
          "Each journal line must contain either debit or credit, not both."
        )
      }

      return {
        debit: current.debit + debit,
        credit: current.credit + credit,
      }
    },
    { debit: 0, credit: 0 }
  )

  if (totals.debit !== totals.credit) {
    throw new HttpError(400, "Journal entry is not balanced.")
  }
}

export function assertInternalPostingKey(
  headerValue: string | undefined,
  expectedKey: string
) {
  if (!headerValue || headerValue !== expectedKey) {
    throw new HttpError(403, "Raw core voucher posting is internal-only.")
  }
}

export function normalizeMoney(value: string) {
  return formatCents(toCents(value))
}

export function toCents(value: string) {
  const normalized = value.trim()
  const isNegative = normalized.startsWith("-")
  const unsigned = isNegative ? normalized.slice(1) : normalized
  const [whole = "0", fraction = ""] = unsigned.split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))

  return isNegative ? -cents : cents
}

export function formatCents(cents: number) {
  const isNegative = cents < 0
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / 100)
  const fraction = String(absolute % 100).padStart(2, "0")

  return `${isNegative ? "-" : ""}${whole}.${fraction}`
}
