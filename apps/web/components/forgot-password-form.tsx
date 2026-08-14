"use client"

import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { GalleryVerticalEndIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { forgotPassword } from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ForgotPasswordValues = {
  identifier: string
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation()
  const [successMessage, setSuccessMessage] = useState("")
  const formSchema = useMemo(
    () =>
      z.object({
        identifier: z
          .string()
          .trim()
          .email(t("auth.forgotPassword.errors.invalidEmail")),
      }),
    [t]
  )

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      identifier: "",
    },
  })

  const rawIdentifier = useWatch({
    control: form.control,
    name: "identifier",
    defaultValue: "",
  })
  const forgotPasswordMutation = useMutation({
    mutationFn: async (identifier: string) => {
      await forgotPassword({
        email: identifier,
      })
    },
  })

  async function handleSubmit(values: ForgotPasswordValues) {
    setSuccessMessage("")

    try {
      await forgotPasswordMutation.mutateAsync(values.identifier.trim().toLowerCase())

      setSuccessMessage(t("auth.forgotPassword.success"))
    } catch (error) {
      form.setError("identifier", {
        type: "server",
        message:
          error instanceof Error ? error.message : t("auth.forgotPassword.errors.generic"),
      })
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex flex-col items-center gap-2 font-medium">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEndIcon className="size-6" />
          </div>
          <span className="sr-only">GSTFY</span>
        </div>
        <h1 className="text-xl font-bold">{t("auth.forgotPassword.title")}</h1>
        <FieldDescription>{t("auth.forgotPassword.description")}</FieldDescription>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="forgot-password-email">
              {t("auth.forgotPassword.emailLabel")}
            </FieldLabel>
            <Input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              value={rawIdentifier}
              placeholder={t("auth.forgotPassword.emailPlaceholder")}
              onChange={(event) => {
                form.setValue("identifier", event.target.value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                })

                if (successMessage) {
                  setSuccessMessage("")
                }

                if (form.formState.errors.identifier) {
                  form.clearErrors("identifier")
                }
              }}
            />
            <FieldError errors={[form.formState.errors.identifier]} />
          </Field>

          {successMessage ? (
            <FieldDescription className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {successMessage}
            </FieldDescription>
          ) : (
            <FieldDescription>{t("auth.forgotPassword.emailHelper")}</FieldDescription>
          )}

          <Field className="gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={
                !form.formState.isValid ||
                rawIdentifier.trim().length === 0 ||
                forgotPasswordMutation.isPending
              }
            >
              {forgotPasswordMutation.isPending
                ? t("auth.forgotPassword.submitting")
                : t("auth.forgotPassword.cta")}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              nativeButton={false}
              render={<Link href="/auth/login" />}
            >
              {t("auth.forgotPassword.backToLogin")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
