"use client"

import Image from "next/image"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckIcon,
  CheckCircle2Icon,
  Clock3Icon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  LockKeyholeIcon,
  MapPinHouseIcon,
  MapPinnedIcon,
  ReceiptTextIcon,
  StoreIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
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
  InputGroupText,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import {
  buildMockProfile,
  formatGstAddress,
  getGstStateMeta,
  gstApiSample,
  type GstProfile,
} from "@/lib/auth/mock-gst-profile"
import { cn } from "@/lib/utils"

type RegisterStep = "gstin" | "review" | "account"
type GstinValues = { gstin: string }
type AccountValues = {
  identifier: string
  password: string
  confirmPassword: string
}

type SignupFormProps = React.ComponentProps<"div">

export function SignupForm({ className, ...props }: SignupFormProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<RegisterStep>("gstin")
  const [verifyState, setVerifyState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "blocked">(
    "idle"
  )
  const [profile, setProfile] = useState<GstProfile | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const gstinSchema = useMemo(
    () =>
      z.object({
        gstin: z
          .string()
          .trim()
          .toUpperCase()
          .min(1, t("auth.register.errors.gstinRequired"))
          .regex(
            /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/,
            t("auth.register.errors.gstinInvalid")
          ),
      }),
    [t]
  )

  const accountSchema = useMemo(
    () =>
      z
        .object({
          identifier: z
            .string()
            .trim()
            .min(1, t("auth.register.errors.identifierRequired"))
            .superRefine((value, ctx) => {
              if (isPhoneMode(value)) {
                if (!/^[6-9]\d{9}$/.test(normalizePhone(value))) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t("auth.register.errors.invalidPhone"),
                  })
                }
                return
              }

              if (!z.email().safeParse(value.trim().toLowerCase()).success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("auth.register.errors.invalidEmail"),
                })
              }
            }),
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

  const gstinForm = useForm<GstinValues>({
    resolver: zodResolver(gstinSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      gstin: gstApiSample.data.data.gstin,
    },
  })

  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      identifier: "",
      password: "",
      confirmPassword: "",
    },
  })

  const rawGstin = useWatch({
    control: gstinForm.control,
    name: "gstin",
    defaultValue: gstApiSample.data.data.gstin,
  })
  const rawIdentifier = useWatch({
    control: accountForm.control,
    name: "identifier",
    defaultValue: "",
  })
  const rawPassword = useWatch({
    control: accountForm.control,
    name: "password",
    defaultValue: "",
  })
  const rawConfirmPassword = useWatch({
    control: accountForm.control,
    name: "confirmPassword",
    defaultValue: "",
  })

  const phoneMode = isPhoneMode(rawIdentifier)
  const canVerify =
    rawGstin.trim().length > 0 &&
    gstinForm.formState.isValid &&
    verifyState !== "loading"
  const canSubmit =
    rawIdentifier.trim().length > 0 &&
    rawPassword.length > 0 &&
    rawConfirmPassword.length > 0 &&
    accountForm.formState.isValid &&
    submitState !== "submitting"
  const contentWidthClass = step === "review" ? "max-w-3xl" : "max-w-sm"

  async function handleVerifyGstin(values: GstinValues) {
    setVerifyState("loading")

    await new Promise((resolve) => setTimeout(resolve, 900))

    setProfile(buildMockProfile(values.gstin))
    setVerifyState("success")
    setStep("review")
  }

  async function handleCreateAccount() {
    setSubmitState("submitting")

    await new Promise((resolve) => setTimeout(resolve, 800))

    setSubmitState("blocked")
  }

  function handleGstinChange(nextValue: string) {
    gstinForm.setValue("gstin", nextValue.toUpperCase(), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })

    if (verifyState !== "idle") {
      setVerifyState("idle")
    }
  }

  function handleIdentifierChange(nextValue: string) {
    const normalizedValue = isPhoneMode(nextValue)
      ? normalizePhoneInput(nextValue)
      : nextValue

    accountForm.setValue("identifier", normalizedValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  const passwordRegistration = accountForm.register("password")
  const confirmPasswordRegistration = accountForm.register("confirmPassword")
  const gstStateMeta = profile ? getGstStateMeta(profile.gstin) : null

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col items-center gap-6",
        className
      )}
      {...props}
    >
      <div className="w-full max-w-3xl">
        <StepIndicator currentStep={step} />
      </div>

      <div
        className={cn(
          "mx-auto w-full",
          contentWidthClass,
          step === "review"
            ? "flex h-full min-h-0 flex-1 flex-col"
            : "flex flex-1 flex-col justify-center"
        )}
      >
        {step === "gstin" ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={gstinForm.handleSubmit(handleVerifyGstin)}
            noValidate
          >
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">{t("auth.register.title")}</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    {t("auth.register.subtitle")}
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="gstin">
                    {t("auth.register.steps.gstin.label")}
                  </FieldLabel>
                  <Input
                    id="gstin"
                    value={rawGstin}
                    placeholder={t("auth.register.steps.gstin.placeholder")}
                    className="bg-background"
                    aria-invalid={!!gstinForm.formState.errors.gstin}
                    onChange={(event) => handleGstinChange(event.target.value)}
                  />
                  <FieldError errors={[gstinForm.formState.errors.gstin]} />
                  <FieldDescription>
                    {t("auth.register.steps.gstin.helper")}
                  </FieldDescription>
                </Field>

                <Field>
                  <Button type="submit" disabled={!canVerify}>
                    {verifyState === "loading"
                      ? t("auth.register.steps.gstin.loading")
                      : t("auth.register.steps.gstin.cta")}
                  </Button>
                </Field>

                <FieldDescription className="px-6 text-center">
                  {t("auth.register.sampleHint", {
                    gstin: gstApiSample.data.data.gstin,
                  })}
                </FieldDescription>
              </FieldGroup>
          </form>
        ) : null}

        {step === "review" && profile ? (
          <div className="flex min-h-0 flex-1 flex-col">
              <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-6 pb-8">
                  <div className="space-y-1 text-center lg:text-left">
                    <h1 className="text-2xl font-bold">
                      {t("auth.register.steps.review.heading")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {t("auth.register.steps.review.description")}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-background p-4 shadow-xs">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <BadgeCheckIcon className="size-3.5" />
                            <span>{t("auth.register.steps.review.gstinVerified")}</span>
                          </Badge>
                          <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2Icon className="size-3.5" />
                            <span>{profile.sts}</span>
                          </Badge>
                        </div>
                        <p className="font-mono text-base tracking-[0.16em] uppercase">
                          {profile.gstin}
                        </p>
                      </div>

                      {gstStateMeta?.emblemSrc ? (
                        <Image
                          src={gstStateMeta.emblemSrc}
                          alt={gstStateMeta.name}
                          width={48}
                          height={48}
                          className="size-12 rounded-md object-cover"
                        />
                      ) : null}
                    </div>
                  </div>

                  <ReviewSection
                    title={t("auth.register.steps.review.sections.businessIdentity")}
                    items={[
                      {
                        label: t("auth.register.steps.review.fields.legalName"),
                        value: profile.lgnm,
                        icon: Building2Icon,
                      },
                      {
                        label: t("auth.register.steps.review.fields.tradeName"),
                        value: profile.tradeNam,
                        icon: StoreIcon,
                      },
                      {
                        label: t("auth.register.steps.review.fields.businessType"),
                        value: profile.ctb,
                        icon: BriefcaseBusinessIcon,
                      },
                      {
                        label: t("auth.register.steps.review.fields.taxpayerType"),
                        value: profile.dty,
                        icon: FileTextIcon,
                      },
                    ]}
                  />

                  <ReviewSection
                    title={t("auth.register.steps.review.sections.companyInformation")}
                    items={[
                      {
                        label: t("auth.register.steps.review.fields.gstState"),
                        value: profile.pradr.addr.stcd,
                        icon: MapPinnedIcon,
                      },
                      {
                        label: t("auth.register.steps.review.fields.eInvoice"),
                        value: profile.einvoiceStatus,
                        icon: ReceiptTextIcon,
                      },
                      {
                        label: t("auth.register.steps.review.fields.registeredDate"),
                        value: profile.rgdt,
                        icon: CalendarDaysIcon,
                      },
                      {
                        label: t("auth.register.steps.review.fields.lastUpdated"),
                        value: profile.lstupdt,
                        icon: Clock3Icon,
                      },
                    ]}
                  />

                  <div className="rounded-xl border bg-background p-4 shadow-xs">
                    <div className="mb-3 flex items-center gap-2">
                      <MapPinHouseIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium">
                        {t("auth.register.steps.review.sections.registeredAddress")}
                      </h2>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {formatGstAddress(profile)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 mt-auto border-t bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("gstin")}
                  >
                    <ArrowLeftIcon className="size-4" />
                    {t("auth.register.steps.review.editGstin")}
                  </Button>
                  <Button type="button" onClick={() => setStep("account")}>
                    {t("auth.register.steps.review.continue")}
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
          </div>
        ) : null}

        {step === "account" ? (
          <form
            className="flex flex-col gap-6"
            onSubmit={accountForm.handleSubmit(handleCreateAccount)}
            noValidate
          >
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">
                    {t("auth.register.steps.account.heading")}
                  </h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    {t("auth.register.steps.account.description")}
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="register-identifier">
                    {t("auth.register.steps.account.identifierLabel")}
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
                      id="register-identifier"
                      type="text"
                      value={rawIdentifier}
                      inputMode={phoneMode ? "numeric" : "email"}
                      placeholder={
                        phoneMode
                          ? t("auth.register.steps.account.phonePlaceholder")
                          : t("auth.register.steps.account.emailPlaceholder")
                      }
                      autoComplete="email"
                      aria-invalid={!!accountForm.formState.errors.identifier}
                      onChange={(event) =>
                        handleIdentifierChange(event.target.value)
                      }
                    />
                  </InputGroup>
                  <FieldError errors={[accountForm.formState.errors.identifier]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="register-password">
                    {t("auth.register.steps.account.passwordLabel")}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <LockKeyholeIcon className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.register.steps.account.passwordPlaceholder")}
                      autoComplete="new-password"
                      aria-invalid={!!accountForm.formState.errors.password}
                      {...passwordRegistration}
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
                  <FieldError errors={[accountForm.formState.errors.password]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="register-confirm-password">
                    {t("auth.register.steps.account.confirmPasswordLabel")}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <LockKeyholeIcon className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="register-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t(
                        "auth.register.steps.account.confirmPasswordPlaceholder"
                      )}
                      autoComplete="new-password"
                      aria-invalid={!!accountForm.formState.errors.confirmPassword}
                      {...confirmPasswordRegistration}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label={
                          showConfirmPassword
                            ? t("auth.login.hidePassword")
                            : t("auth.login.showPassword")
                        }
                        onClick={() =>
                          setShowConfirmPassword((current) => !current)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOffIcon className="size-4" />
                        ) : (
                          <EyeIcon className="size-4" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError
                    errors={[accountForm.formState.errors.confirmPassword]}
                  />
                  <FieldDescription>
                    {t("auth.register.steps.account.passwordHelper")}
                  </FieldDescription>
                </Field>

                {submitState === "blocked" ? (
                  <FieldDescription className="text-destructive">
                    {t("auth.register.steps.account.blockedMessage")}
                  </FieldDescription>
                ) : null}

                <Field className="gap-3">
                  <Button type="submit" disabled={!canSubmit}>
                    {submitState === "submitting"
                      ? t("auth.register.steps.account.submitting")
                      : t("auth.register.steps.account.cta")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("review")}
                  >
                    {t("auth.register.steps.account.backToReview")}
                  </Button>
                </Field>

                <FieldDescription className="px-6 text-center">
                  {t("auth.register.backToLoginText.before")}{" "}
                  <Link
                    href="/login"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    {t("auth.register.backToLoginText.link")}
                  </Link>
                </FieldDescription>
              </FieldGroup>
          </form>
        ) : null}
      </div>
    </div>
  )
}

function StepIndicator({ currentStep }: { currentStep: RegisterStep }) {
  const { t } = useTranslation()
  const steps: Array<{ id: RegisterStep; label: string }> = [
    { id: "gstin", label: t("auth.register.steps.gstin.stepTitle") },
    { id: "review", label: t("auth.register.steps.review.stepTitle") },
    { id: "account", label: t("auth.register.steps.account.stepTitle") },
  ]
  const currentIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <div className="grid grid-cols-3 gap-3">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex
        const isComplete = index < currentIndex

        return (
          <div key={step.id} className="space-y-2">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                isComplete && "bg-emerald-500",
                isCurrent && "bg-foreground",
                !isCurrent && !isComplete && "bg-border"
              )}
            />
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  isComplete &&
                    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
                  isCurrent && "border-foreground bg-foreground text-background",
                  !isCurrent &&
                    !isComplete &&
                    "border-border bg-background text-muted-foreground"
                )}
              >
                {isComplete ? <CheckIcon className="size-3.5" /> : index + 1}
              </div>
              <p
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReviewSection({
  title,
  items,
}: {
  title: string
  items: Array<{
    label: string
    value: string
    icon: React.ComponentType<React.ComponentProps<"svg">>
  }>
}) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
          >
            <div className="mt-0.5 rounded-md bg-background p-2 text-muted-foreground shadow-xs">
              <item.icon className="size-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm">{item.value}</p>
            </div>
          </div>
        ))}
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
