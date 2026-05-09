"use client"

import { I18nextProvider } from "react-i18next"
import { useEffect } from "react"

import { i18n } from "@/lib/i18n/i18n"
import { languageStorageKey } from "@/lib/i18n/languages"
import { useAppSelector } from "@/lib/store/hooks"

export function I18nProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const language = useAppSelector((state) => state.language.current)

  useEffect(() => {
    void i18n.changeLanguage(language)
    document.documentElement.lang = language
    window.localStorage.setItem(languageStorageKey, language)
  }, [language])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
