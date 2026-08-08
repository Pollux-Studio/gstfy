import en from "@/messages/en.json"
import hi from "@/messages/hi.json"
import ta from "@/messages/ta.json"

export const resources = {
  en: { translation: en },
  ta: { translation: ta },
  hi: { translation: hi },
} as const

export function getTranslation(
  key: string,
  language: keyof typeof resources = "en"
) {
  const segments = key.split(".")
  let currentValue: unknown = resources[language].translation

  for (const segment of segments) {
    if (
      !currentValue ||
      typeof currentValue !== "object" ||
      !(segment in currentValue)
    ) {
      return key
    }

    currentValue = (currentValue as Record<string, unknown>)[segment]
  }

  return typeof currentValue === "string" ? currentValue : key
}
