"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon, GalleryVerticalEndIcon, LockKeyholeIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { resetPassword } from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type ResetPasswordValues = {
  password: string
  confirmPassword: string
}

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const resetToken = searchParams.get("token") ?? ""
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const tokenError = resetToken ? "" : t("auth.resetPassword.errors.invalidLink")

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t("auth.register.errors.passwordLength"))
            .regex(/\d/, t("auth.register.errors.passwordNumber"))
            .regex(/[^A-Za-z0-9]/, t("auth.register.errors.passwordSpecial")),
          confirmPassword: z
            .string()
            .min(1, t("auth.register.errors.confirmPasswordRequired")),
        })
        .refine((values) => values.password === values.confirmPassword, {
          path: ["confirmPassword"],
          message: t("auth.register.errors.passwordMismatch"),
        }),
    [t]
  )

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const rawPassword = useWatch({
    control: form.control,
    name: "password",
    defaultValue: "",
  })
  const rawConfirmPassword = useWatch({
    control: form.control,
    name: "confirmPassword",
    defaultValue: "",
  })

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
  })

  async function handleSubmit(values: ResetPasswordValues) {
    if (!resetToken) {
      return
    }

    try {
      await resetPasswordMutation.mutateAsync({
        token: resetToken,
        password: values.password,
      })

      router.push("/auth/login?reset=1")
    } catch (error) {
      form.setError("password", {
        type: "server",
        message:
          error instanceof Error ? error.message : t("auth.resetPassword.errors.generic"),
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
        <h1 className="text-xl font-bold">{t("auth.resetPassword.title")}</h1>
        <FieldDescription>{t("auth.resetPassword.description")}</FieldDescription>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
        <FieldGroup>
          {tokenError ? (
            <FieldDescription className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive">
              {tokenError}
            </FieldDescription>
          ) : null}

          <Field>
            <FieldLabel htmlFor="reset-password">
              {t("auth.resetPassword.passwordLabel")}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <LockKeyholeIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={rawPassword}
                placeholder={t("auth.resetPassword.passwordPlaceholder")}
                onChange={(event) => {
                  form.setValue("password", event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })

                  if (form.formState.errors.password) {
                    form.clearErrors("password")
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")
                  }
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[form.formState.errors.password]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="reset-confirm-password">
              {t("auth.resetPassword.confirmPasswordLabel")}
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <LockKeyholeIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="reset-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={rawConfirmPassword}
                placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
                onChange={(event) => {
                  form.setValue("confirmPassword", event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })

                  if (form.formState.errors.confirmPassword) {
                    form.clearErrors("confirmPassword")
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showConfirmPassword
                      ? t("auth.login.hidePassword")
                      : t("auth.login.showPassword")
                  }
                  onClick={() => setShowConfirmPassword((currentValue) => !currentValue)}
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[form.formState.errors.confirmPassword]} />
            <FieldDescription>{t("auth.register.steps.account.passwordHelper")}</FieldDescription>
          </Field>

          <Button
            type="submit"
            className="w-full"
            disabled={
              Boolean(tokenError) ||
              !form.formState.isValid ||
              rawPassword.length === 0 ||
              rawConfirmPassword.length === 0 ||
              resetPasswordMutation.isPending
            }
          >
            {resetPasswordMutation.isPending
              ? t("auth.resetPassword.submitting")
              : t("auth.resetPassword.cta")}
          </Button>
        </FieldGroup>
      </form>
    </div>
  )
}
