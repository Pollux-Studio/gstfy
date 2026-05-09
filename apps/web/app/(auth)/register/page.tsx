"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldGroup } from "@/components/ui/field"

export default function RegisterPage() {
  const { t } = useTranslation()

  return (
    <FieldGroup>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-bold">{t("auth.register.title")}</h1>
        <FieldDescription>{t("auth.register.description")}</FieldDescription>
      </div>
      <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
        {t("auth.register.backToLogin")}
      </Button>
    </FieldGroup>
  )
}
