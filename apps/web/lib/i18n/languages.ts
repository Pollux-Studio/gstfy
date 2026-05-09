export const supportedLanguages = ["en", "ta", "hi"] as const

export type LanguageCode = (typeof supportedLanguages)[number]

export const languageStorageKey = "gstfy.language"

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string" && supportedLanguages.includes(value as LanguageCode)
}
