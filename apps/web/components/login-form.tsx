"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowRightIcon,
  Building2Icon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  GalleryVerticalEndIcon,
  LockKeyholeIcon,
} from "lucide-react"
import { type HTMLAttributes, useEffect, useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import {
  login as loginWithPassword,
  lookupIdentifier,
  sendOtp,
  type LookupIdentifierResponse,
  verifyOtp,
} from "@/lib/auth/api"
import { clearStoredAuthSession, setStoredAuthSession } from "@/lib/auth/session"
import { appendPathToUrl, getAuthSubdomainUrl } from "@/lib/auth/workspace-url"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type IdentifierValues = { identifier: string }
type PasswordValues = { password: string }
type OtpValues = { token: string }
type Account = LookupIdentifierResponse["account"]
type LoginStep = "identifier" | "workspace" | "password" | "otp"
type LoginFormProps = HTMLAttributes<HTMLDivElement> & {
  registrationBanner?: string
}

const OTP_RESEND_INTERVAL_SECONDS = 60

export function LoginForm({
  className,
  registrationBanner = "",
  ...props
}: LoginFormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = sanitizeNextPath(searchParams.get("next"))
  const shouldReduceMotion = useReducedMotion()
  const [step, setStep] = useState<LoginStep>("identifier")
  const [lookupState, setLookupState] = useState<"idle" | "not-found">("idle")
  const [account, setAccount] = useState<Account | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState("")
  const [otpFeedback, setOtpFeedback] = useState("")
  const [otpResendAvailableAt, setOtpResendAvailableAt] = useState(0)
  const [otpResendNow, setOtpResendNow] = useState(0)
  const [caLoginHref, setCaLoginHref] = useState("/auth/ca/login")

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

  const otpSchema = useMemo(
    () =>
      z.object({
        token: z
          .string()
          .trim()
          .regex(/^\d{6}$/, t("auth.login.errors.invalidOtp")),
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

  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      token: "",
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
  const rawOtp = useWatch({
    control: otpForm.control,
    name: "token",
    defaultValue: "",
  })

  const lookupMutation = useMutation({
    mutationFn: lookupIdentifier,
  })

  const loginMutation = useMutation({
    mutationFn: loginWithPassword,
  })

  const sendOtpMutation = useMutation({
    mutationFn: sendOtp,
  })

  const verifyOtpMutation = useMutation({
    mutationFn: verifyOtp,
  })

  const phoneMode = isPhoneMode(rawIdentifier)
  const normalizedIdentifier = phoneMode
    ? normalizePhone(rawIdentifier)
    : rawIdentifier.trim().toLowerCase()
  const canContinue =
    rawIdentifier.trim().length > 0 &&
    identifierForm.formState.isValid &&
    !lookupMutation.isPending &&
    !sendOtpMutation.isPending
  const canLogin =
    rawPassword.length > 0 &&
    passwordForm.formState.isValid &&
    !loginMutation.isPending
  const canVerifyOtp =
    rawOtp.trim().length === 6 &&
    otpForm.formState.isValid &&
    !verifyOtpMutation.isPending
  const resendRemainingSeconds =
    step === "otp" && otpResendAvailableAt > 0
      ? Math.max(0, Math.ceil((otpResendAvailableAt - otpResendNow) / 1000))
      : 0
  const canResendOtp =
    resendRemainingSeconds === 0 && !sendOtpMutation.isPending
  const identifierError = identifierForm.formState.errors.identifier
  const shouldShowIdentifierError =
    Boolean(identifierError) &&
    (!phoneMode ||
      normalizePhone(rawIdentifier).length === 10 ||
      identifierForm.formState.isSubmitted)
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: "easeOut" as const }

  useEffect(() => {
    setCaLoginHref(getAuthSubdomainUrl("/auth/ca/login"))
  }, [])

  useEffect(() => {
    if (step !== "otp" || otpResendAvailableAt === 0) {
      return
    }

    if (otpResendAvailableAt <= Date.now()) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setOtpResendNow(Date.now())
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [otpResendAvailableAt, otpResendNow, step])

  async function handleIdentifierSubmit(values: IdentifierValues) {
    setLookupState("idle")
    setAuthError("")
    setOtpFeedback("")

    try {
      const response = await lookupMutation.mutateAsync(values.identifier)
      const nextPhoneMode = isPhoneMode(values.identifier)

      setAccount(response.account)
      setShowPassword(false)
      passwordForm.reset()
      otpForm.reset()

      if (shouldOfferWorkspaceSwitch(response.account)) {
        setStep("workspace")
        return
      }

      await continueWithAuthMethod(nextPhoneMode, values.identifier)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth.login.errors.generic")

      if (/account not found/i.test(message)) {
        setAccount(null)
        setLookupState("not-found")
        return
      }

      identifierForm.setError("identifier", {
        type: "server",
        message,
      })
    }
  }

  async function continueWithAuthMethod(nextPhoneMode: boolean, identifier: string) {
    if (nextPhoneMode) {
      await sendOtpMutation.mutateAsync({
        identifier: normalizePhone(identifier),
        purpose: "login",
      })
      startOtpResendCooldown()
      setOtpFeedback(t("auth.login.otpSent"))
      setStep("otp")
      return
    }

    setStep("password")
  }

  async function handleContinueHere() {
    setAuthError("")

    try {
      await continueWithAuthMethod(isPhoneMode(rawIdentifier), rawIdentifier)
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.login.errors.generic")
      )
    }
  }

  function handleSwitchToWorkspace() {
    if (!account?.tenantUrl) {
      return
    }

    const workspaceLoginUrl = appendPathToUrl(account.tenantUrl, "/auth/login")
    const workspaceRedirectUrl =
      nextPath === "/dashboard"
        ? workspaceLoginUrl
        : `${workspaceLoginUrl}?next=${encodeURIComponent(nextPath)}`

    window.location.assign(workspaceRedirectUrl)
  }

  async function handlePasswordSubmit() {
    setAuthError("")

    try {
      const response = await loginMutation.mutateAsync({
        identifier: normalizedIdentifier,
        password: rawPassword,
      })

      setStoredAuthSession({
        accountType: "business",
        user: response.user,
        session: response.session,
        tenant: response.tenant,
      })

      navigateAfterBusinessLogin(response.redirectTo, nextPath, router)
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.login.errors.generic")
      )
    }
  }

  async function handleOtpSubmit(values: OtpValues) {
    setAuthError("")

    try {
      const response = await verifyOtpMutation.mutateAsync({
        identifier: normalizePhone(rawIdentifier),
        token: values.token,
      })

      setStoredAuthSession({
        accountType: "business",
        user: response.user,
        session: response.session,
        tenant: response.tenant,
      })

      navigateAfterBusinessLogin(response.redirectTo, nextPath, router)
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.login.errors.otpGeneric")
      )
    }
  }

  async function handleResendOtp() {
    setAuthError("")

    try {
      await sendOtpMutation.mutateAsync({
        identifier: normalizePhone(rawIdentifier),
        purpose: "login",
      })
      startOtpResendCooldown()
      setOtpFeedback(t("auth.login.otpSent"))
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : t("auth.login.errors.otpGeneric")
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

    if (authError) {
      setAuthError("")
    }

    if (otpFeedback) {
      setOtpFeedback("")
    }

    if (identifierForm.formState.errors.identifier) {
      identifierForm.clearErrors("identifier")
    }
  }

  function handleOtpChange(nextValue: string) {
    otpForm.setValue("token", nextValue.replace(/\D/g, "").slice(0, 6), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })

    if (authError) {
      setAuthError("")
    }

    if (otpFeedback) {
      setOtpFeedback("")
    }
  }

  function handleResetToIdentifier() {
    setStep("identifier")
    setLookupState("idle")
    setAuthError("")
    setOtpFeedback("")
    setAccount(null)
    setShowPassword(false)
    passwordForm.reset()
    otpForm.reset()
    loginMutation.reset()
    lookupMutation.reset()
    sendOtpMutation.reset()
    verifyOtpMutation.reset()
    setOtpResendAvailableAt(0)
    setOtpResendNow(0)
  }

  function startOtpResendCooldown() {
    const now = Date.now()

    setOtpResendNow(now)
    setOtpResendAvailableAt(now + OTP_RESEND_INTERVAL_SECONDS * 1000)
  }

  const passwordRegistration = passwordForm.register("password")
  const stepDescription =
    step === "identifier"
      ? t("auth.login.stepOneDescription")
      : step === "workspace"
        ? t("auth.login.stepWorkspaceDescription")
      : step === "password"
        ? t("auth.login.stepTwoDescription")
        : t("auth.login.stepOtpDescription")

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
        <FieldDescription>{stepDescription}</FieldDescription>
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
                  <InputGroupAddon
                    aria-hidden={!phoneMode}
                    className={cn(
                      "overflow-hidden transition-all",
                      phoneMode
                        ? "w-auto pl-2 opacity-100"
                        : "w-0 gap-0 overflow-hidden p-0 opacity-0"
                    )}
                  >
                    <InputGroupText
                      className={cn(
                        "whitespace-nowrap transition-opacity",
                        !phoneMode && "opacity-0"
                      )}
                    >
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
                  <InputGroupInput
                    id="identifier"
                    type="text"
                    value={rawIdentifier}
                    inputMode={phoneMode ? "numeric" : "email"}
                    maxLength={phoneMode ? 10 : undefined}
                    placeholder={
                      phoneMode
                        ? t("auth.login.phonePlaceholder")
                        : t("auth.login.emailPlaceholder")
                    }
                    autoComplete={phoneMode ? "tel-national" : "username"}
                    aria-invalid={shouldShowIdentifierError}
                    className={cn(phoneMode && "font-mono")}
                    onChange={(event) => handleIdentifierChange(event.target.value)}
                  />
                </InputGroup>
                {shouldShowIdentifierError ? (
                  <FieldError errors={[identifierError]} />
                ) : null}
                {lookupState === "not-found" ? (
                  <FieldError>{t("auth.login.errors.accountNotFound")}</FieldError>
                ) : null}
              </Field>

              <Field>
                <Button type="submit" className="w-full" disabled={!canContinue}>
                  {lookupMutation.isPending || sendOtpMutation.isPending ? (
                    <Spinner />
                  ) : (
                    t("auth.login.continue")
                  )}
                </Button>
              </Field>
              <FieldSeparator>{t("auth.login.or")}</FieldSeparator>
              <Field className="gap-3">
                <Button
                  type="button"
                  nativeButton={false}
                  variant="outline"
                  className="w-full"
                  render={<Link href="/auth/register" />}
                >
                  {t("auth.login.createAccount")}
                </Button>
                <Button
                  type="button"
                  nativeButton={false}
                  variant="ghost"
                  className="w-full"
                  render={<Link href={caLoginHref} />}
                >
                  Login or register as a CA
                </Button>
                <FieldDescription className="text-center">
                  {t("auth.login.registerHint")}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </motion.form>
        ) : step === "workspace" ? (
          <motion.div
            key="workspace-step"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -12 }}
            transition={transition}
          >
            <FieldGroup>
              <AccountSummary account={account} />

              <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50">
                <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-emerald-300/30 blur-2xl dark:bg-emerald-500/15" />
                <div className="relative flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-900/10">
                    <Building2Icon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {t("auth.login.workspaceSwitchTitle")}
                      </p>
                      <span className="flex size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
                    </div>
                    <p className="text-sm text-emerald-800/80 dark:text-emerald-100/75">
                      {t("auth.login.workspaceSwitchDescription", {
                        business:
                          account?.displayName ??
                          t("auth.login.workspaceFallbackName"),
                      })}
                    </p>
                    {account?.tenantUrl ? (
                      <p
                        className="truncate font-mono text-xs text-emerald-700 dark:text-emerald-200"
                        title={account.tenantUrl}
                      >
                        {getWorkspaceHost(account.tenantUrl)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {authError ? (
                <FieldDescription className="text-destructive">
                  {authError}
                </FieldDescription>
              ) : null}

              <Field className="gap-3">
                <Button
                  type="button"
                  className="w-full"
                  disabled={!account?.tenantUrl}
                  onClick={handleSwitchToWorkspace}
                >
                  {t("auth.login.switchToWorkspace")}
                  <ExternalLinkIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={sendOtpMutation.isPending}
                  onClick={handleContinueHere}
                >
                  {sendOtpMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <>
                      {t("auth.login.continueHere")}
                      <ArrowRightIcon className="size-4" />
                    </>
                  )}
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
          </motion.div>
        ) : step === "password" ? (
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
              <AccountSummary account={account} />

              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="password">
                    {t("auth.login.passwordLabel")}
                  </FieldLabel>
                  <Link
                    href="/auth/forgot-password"
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
                <Button type="submit" className="w-full" disabled={!canLogin}>
                  {loginMutation.isPending ? (
                    <Spinner />
                  ) : (
                    t("auth.login.login")
                  )}
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
        ) : (
          <motion.form
            key="otp-step"
            onSubmit={otpForm.handleSubmit(handleOtpSubmit)}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -12 }}
            transition={transition}
            noValidate
          >
            <FieldGroup>
              <AccountSummary account={account} />

              <Field>
                <FieldLabel htmlFor="login-otp">
                  {t("auth.login.otpLabel")}
                </FieldLabel>
                <InputOTP
                  id="login-otp"
                  value={rawOtp}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-invalid={!!otpForm.formState.errors.token}
                  containerClassName="justify-center"
                  onChange={handleOtpChange}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription>
                  {t("auth.login.phoneOtpDescription")}
                </FieldDescription>
                <FieldError errors={[otpForm.formState.errors.token]} />
                {authError ? (
                  <FieldDescription className="text-destructive">
                    {authError}
                  </FieldDescription>
                ) : null}
                {otpFeedback ? (
                  <FieldDescription className="text-emerald-600 dark:text-emerald-400">
                    {otpFeedback}
                  </FieldDescription>
                ) : null}
              </Field>

              <Field className="gap-3">
                <Button type="submit" className="w-full" disabled={!canVerifyOtp}>
                  {verifyOtpMutation.isPending ? (
                    <Spinner />
                  ) : (
                    t("auth.login.verifyOtp")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!canResendOtp}
                  onClick={handleResendOtp}
                >
                  {sendOtpMutation.isPending ? (
                    <Spinner />
                  ) : resendRemainingSeconds > 0
                      ? t("auth.login.resendOtpIn", {
                          seconds: resendRemainingSeconds,
                        })
                      : t("auth.login.resendOtp")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleResetToIdentifier}
                >
                  {t("auth.login.backToIdentifier")}
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
            terms: <a href="/terms" />,
            privacy: <a href="/privacy" />,
          }}
        />
      </FieldDescription>
    </div>
  )
}

function AccountSummary({
  account,
}: {
  account: Account | null
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="ring-1 ring-border">
          <AvatarFallback>{getAccountInitials(account?.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{account?.displayName}</p>
            <span
              className="ml-auto size-2.5 shrink-0 rounded-full bg-emerald-500"
              aria-label="Active"
              title="Active"
            />
          </div>
          {account?.gstin ? (
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {account.gstin}
            </p>
          ) : null}
        </div>
      </div>
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

function sanitizeNextPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/dashboard"
  }

  return value
}

function shouldOfferWorkspaceSwitch(account: Account) {
  if (!account.tenantUrl || typeof window === "undefined") {
    return false
  }

  try {
    return new URL(account.tenantUrl).origin !== window.location.origin
  } catch {
    return false
  }
}

function getWorkspaceHost(tenantUrl: string) {
  try {
    return new URL(tenantUrl).host
  } catch {
    return tenantUrl
  }
}

function navigateAfterBusinessLogin(
  redirectTo: string,
  nextPath: string,
  router: ReturnType<typeof useRouter>
) {
  const targetPath = nextPath === "/dashboard" ? redirectTo : nextPath

  if (/^https?:\/\//.test(targetPath)) {
    assignAuthTarget(targetPath)
    return
  }

  router.push(targetPath)
}

function assignAuthTarget(target: string) {
  const targetUrl = new URL(target, window.location.href)

  if (targetUrl.origin !== window.location.origin) {
    clearStoredAuthSession()
  }

  window.location.assign(targetUrl.toString())
}
