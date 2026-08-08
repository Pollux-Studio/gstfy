"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  GalleryVerticalEndIcon,
  LockKeyholeIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import {
  login as loginWithPassword,
  lookupIdentifier,
  type LookupIdentifierResponse,
} from "@/lib/auth/api"
import { setStoredAuthSession } from "@/lib/auth/session"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type IdentifierValues = { identifier: string }
type PasswordValues = { password: string }
type Account = LookupIdentifierResponse["account"]

export function LoginForm({
  className,
  registrationBanner = "",
  ...props
}: React.ComponentProps<"div"> & {
  registrationBanner?: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [step, setStep] = useState<"identifier" | "password">("identifier")
  const [lookupState, setLookupState] = useState<"idle" | "not-found">("idle")
  const [account, setAccount] = useState<Account | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState("")

  const identifierSchema = useMemo(
    () =>
      z.object({
        identifier: z
          .string()
          .trim()
          .min(1, t("auth.login.errors.identifierRequired"))
          .superRefine((value, ctx) => {
            if (isPhoneMode(value)) {
              if (!/^[6-9]\d{9}$/.test(normalizePhone(value))) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("auth.login.errors.invalidPhone"),
                })
              }
              return
            }

            if (!z.email().safeParse(value.trim().toLowerCase()).success) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("auth.login.errors.invalidEmail"),
              })
            }
          }),
      }),
    [t]
  )

  const passwordSchema = useMemo(
    () =>
      z.object({
        password: z.string().min(1, t("auth.login.errors.passwordRequired")),
      }),
    [t]
  )

  const identifierForm = useForm<IdentifierValues>({
    resolver: zodResolver(identifierSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      identifier: "",
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
    },
  })

  const rawIdentifier = useWatch({
    control: identifierForm.control,
    name: "identifier",
    defaultValue: "",
  })
  const rawPassword = useWatch({
    control: passwordForm.control,
    name: "password",
    defaultValue: "",
  })

  const lookupMutation = useMutation({
    mutationFn: lookupIdentifier,
  })

  const loginMutation = useMutation({
    mutationFn: loginWithPassword,
  })

  const phoneMode = isPhoneMode(rawIdentifier)
  const canContinue =
    rawIdentifier.trim().length > 0 &&
    identifierForm.formState.isValid &&
    !lookupMutation.isPending
  const canLogin =
    rawPassword.length > 0 &&
    passwordForm.formState.isValid &&
    !loginMutation.isPending
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: "easeOut" as const }

  async function handleIdentifierSubmit(values: IdentifierValues) {
    setLookupState("idle")
    setAuthError("")

    try {
      const response = await lookupMutation.mutateAsync(values.identifier)
      setAccount(response.account)
      setStep("password")
      setShowPassword(false)
      passwordForm.reset()
    } catch (error) {
      setAccount(null)
      setLookupState("not-found")

      if (error instanceof Error && !/account not found/i.test(error.message)) {
        identifierForm.setError("identifier", {
          type: "server",
          message: error.message,
        })
      }
    }
  }

  async function handlePasswordSubmit() {
    setAuthError("")

    try {
      const response = await loginMutation.mutateAsync({
        identifier: rawIdentifier,
        password: rawPassword,
      })

      setStoredAuthSession({
        user: response.user,
        session: response.session,
      })

      router.push("/dashboard")
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.login.errors.generic")
      )
    }
  }

  function handleIdentifierChange(nextValue: string) {
    const normalizedValue = isPhoneMode(nextValue)
      ? normalizePhoneInput(nextValue)
      : nextValue

    identifierForm.setValue("identifier", normalizedValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })

    if (lookupState !== "idle") {
      setLookupState("idle")
    }

    if (identifierForm.formState.errors.identifier) {
      identifierForm.clearErrors("identifier")
    }
  }

  function handleResetToIdentifier() {
    setStep("identifier")
    setLookupState("idle")
    setAuthError("")
    setAccount(null)
    setShowPassword(false)
    passwordForm.reset()
    loginMutation.reset()
    lookupMutation.reset()
  }

  const passwordRegistration = passwordForm.register("password")

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex flex-col items-center gap-2 font-medium">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEndIcon className="size-6" />
          </div>
          <span className="sr-only">GSTFY</span>
        </div>
        <h1 className="text-xl font-bold">{t("auth.login.title")}</h1>
        <FieldDescription>
          {step === "identifier"
            ? t("auth.login.stepOneDescription")
            : t("auth.login.stepTwoDescription")}
        </FieldDescription>
        {registrationBanner ? (
          <FieldDescription className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            {registrationBanner}
          </FieldDescription>
        ) : null}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === "identifier" ? (
          <motion.form
            key="identifier-step"
            onSubmit={identifierForm.handleSubmit(handleIdentifierSubmit)}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -12 }}
            transition={transition}
            noValidate
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">
                  {t("auth.login.identifierLabel")}
                </FieldLabel>
                <InputGroup>
                  {phoneMode ? (
                    <InputGroupAddon>
                      <InputGroupText>
                        <Image
                          src="/india-flag.png"
                          alt="India"
                          width={16}
                          height={12}
                          className="h-3 w-4 rounded-[2px] object-cover"
                        />
                        <span>+91</span>
                      </InputGroupText>
                    </InputGroupAddon>
                  ) : null}
                  <InputGroupInput
                    id="identifier"
                    type="text"
                    value={rawIdentifier}
                    inputMode={phoneMode ? "numeric" : "email"}
                    placeholder={
                      phoneMode
                        ? t("auth.login.phonePlaceholder")
                        : t("auth.login.emailPlaceholder")
                    }
                    autoComplete="username"
                    aria-invalid={!!identifierForm.formState.errors.identifier}
                    onChange={(event) =>
                      handleIdentifierChange(event.target.value)
                    }
                  />
                </InputGroup>
                <FieldError errors={[identifierForm.formState.errors.identifier]} />
                {lookupState === "not-found" ? (
                  <FieldError>{t("auth.login.errors.accountNotFound")}</FieldError>
                ) : null}
              </Field>

              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!canContinue}
                >
                  {lookupMutation.isPending
                    ? t("auth.login.checkingAccount")
                    : t("auth.login.continue")}
                </Button>
              </Field>
              <FieldSeparator>{t("auth.login.or")}</FieldSeparator>
              <Field className="gap-3">
                <Button
                  type="button"
                  nativeButton={false}
                  variant="outline"
                  className="w-full"
                  render={<Link href="/register" />}
                >
                  {t("auth.login.createAccount")}
                </Button>
                <FieldDescription className="text-center">
                  {t("auth.login.registerHint")}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </motion.form>
        ) : (
          <motion.form
            key="password-step"
            onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -12 }}
            transition={transition}
            noValidate
          >
            <FieldGroup>
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 shadow-xs">
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="ring-1 ring-border">
                    <AvatarFallback>
                      {getAccountInitials(account?.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {account?.displayName}
                      </p>
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckIcon className="size-3.5" />
                        {t("auth.login.gstStatusActive")}
                      </Badge>
                    </div>
                    {account?.gstin ? (
                      <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                        {account.gstin}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="password">
                    {t("auth.login.passwordLabel")}
                  </FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <InputGroup>
                  <InputGroupAddon>
                    <LockKeyholeIcon className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.login.passwordPlaceholder")}
                    autoComplete="current-password"
                    aria-invalid={!!passwordForm.formState.errors.password}
                    {...passwordRegistration}
                    onChange={(event) => {
                      passwordRegistration.onChange(event)

                      if (authError) {
                        setAuthError("")
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label={
                        showPassword
                          ? t("auth.login.hidePassword")
                          : t("auth.login.showPassword")
                      }
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError errors={[passwordForm.formState.errors.password]} />
                {authError ? (
                  <FieldDescription className="text-destructive">
                    {authError}
                  </FieldDescription>
                ) : null}
              </Field>

              <Field className="gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!canLogin}
                >
                  {loginMutation.isPending
                    ? t("auth.login.signingIn")
                    : t("auth.login.login")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleResetToIdentifier}
                >
                  {t("auth.login.useDifferentIdentifier")}
                </Button>
              </Field>
            </FieldGroup>
          </motion.form>
        )}
      </AnimatePresence>

      <FieldDescription className="px-6 text-center">
        <Trans
          i18nKey="auth.login.termsNotice"
          components={{
            terms: <a href="#" />,
            privacy: <a href="#" />,
          }}
        />
      </FieldDescription>
    </div>
  )
}

function isPhoneMode(value: string) {
  const trimmed = value.trim()
  const digits = normalizePhone(trimmed)

  return (
    trimmed.length > 0 &&
    !trimmed.includes("@") &&
    /^[+\d\s()-]*$/.test(trimmed) &&
    (trimmed.startsWith("+") || digits.length >= 4)
  )
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "")

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 10)
}

function normalizePhoneInput(value: string) {
  return normalizePhone(value)
}

function getAccountInitials(displayName?: string | null) {
  if (!displayName) {
    return "GW"
  }

  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "GW"
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}
