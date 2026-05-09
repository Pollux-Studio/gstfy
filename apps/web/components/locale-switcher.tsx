"use client"

import Image from "next/image"
import { useTranslation } from "react-i18next"

import { i18n } from "@/lib/i18n/i18n"
import { supportedLanguages, type LanguageCode } from "@/lib/i18n/languages"
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks"
import { setLanguage } from "@/lib/store/language-slice"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

const languageLabels: Record<LanguageCode, string> = {
  en: "English (IN)",
  ta: "தமிழ்",
  hi: "हिन्दी",
}

export function LocaleSwitcher() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.language.current)

  return (
    <Select
      value={language}
      onValueChange={(value) => {
        const nextLanguage = value as LanguageCode

        void i18n.changeLanguage(nextLanguage)
        dispatch(setLanguage(nextLanguage))
      }}
    >
      <SelectTrigger
        aria-label={t("system.language")}
        className="h-8 min-w-[8.75rem] gap-2 pl-2.5 pr-3"
      >
        <Image
          src="/india-flag.png"
          alt="India"
          width={16}
          height={12}
          className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
        />
        <span className="flex flex-1 items-center text-left leading-none">
          {languageLabels[language]}
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="min-w-[8.75rem]"
      >
        {supportedLanguages.map((option) => (
          <SelectItem key={option} value={option}>
            <Image
              src="/india-flag.png"
              alt="India"
              width={16}
              height={12}
              className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
            />
            <span className="flex items-center leading-none">
              {languageLabels[option]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
