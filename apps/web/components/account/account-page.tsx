"use client"

import Image from "next/image"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import {
  ArrowLeftIcon,
  Clock3Icon,
  EraserIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MonitorSmartphoneIcon,
  RefreshCwIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react"
import * as React from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import {
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { getProfileAvatarUrl } from "@/lib/avatar"
import {
  changeAccountPassword,
  getAccountSettings,
  regenerateAccountProfileImage,
  updateAccountSettings,
  verifyAccountPhone,
} from "@/lib/account/api"
import {
  confirmFirebasePhoneOtp,
  sendFirebasePhoneOtp,
} from "@/lib/auth/firebase-phone"
import { getStoredAuthSession, setStoredAuthSession } from "@/lib/auth/session"
import { supportedLanguages, type LanguageCode } from "@/lib/i18n/languages"
import { useAppDispatch } from "@/lib/store/hooks"
import { setLanguage } from "@/lib/store/language-slice"

const userSettingsSchema = z.object({
  displayName: z.string().trim().max(80, "Keep the display name within 80 characters."),
  phoneLocal: z.union([
    z.literal(""),
    z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit Indian mobile number."),
  ]),
  locale: z.enum(supportedLanguages),
})

type UserSettingsFormValues = z.infer<typeof userSettingsSchema>

const passwordSettingsSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/\d/, "Include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Include at least one special character."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

type PasswordSettingsFormValues = z.infer<typeof passwordSettingsSchema>

const accountSections = [
  { id: "profile", label: "Profile", icon: UserRoundIcon },
  { id: "login", label: "Login", icon: LockKeyholeIcon },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontalIcon },
  { id: "security", label: "Security", icon: KeyRoundIcon },
] as const

const localeLabels: Record<LanguageCode, string> = {
  en: "English (IN)",
  ta: "தமிழ்",
  hi: "हिन्दी",
}

export function AccountPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const isCaAccount = storedSession?.accountType === "ca"
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const [phoneOtpSentTo, setPhoneOtpSentTo] = React.useState("")
  const [phoneOtpToken, setPhoneOtpToken] = React.useState("")
  const [phoneVerificationError, setPhoneVerificationError] = React.useState("")
  const [phoneVerificationFeedback, setPhoneVerificationFeedback] = React.useState("")

  const { data, isLoading, error } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const userForm = useForm<UserSettingsFormValues>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      displayName: "",
      phoneLocal: "",
      locale: "en",
    },
  })
  const passwordForm = useForm<PasswordSettingsFormValues>({
    resolver: zodResolver(passwordSettingsSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })
  const phoneLocal = useWatch({
    control: userForm.control,
    name: "phoneLocal",
  })
  const normalizedPhoneLocal = (phoneLocal ?? "").replace(/\D/g, "").slice(0, 10)
  const phoneOtpReady =
    normalizedPhoneLocal.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhoneLocal)
  const phoneOtpWasSentForCurrentNumber =
    phoneOtpSentTo.length > 0 && phoneOtpSentTo === normalizedPhoneLocal

  React.useEffect(() => {
    if (!data) {
      return
    }

    userForm.reset({
      displayName: data.user.displayName ?? "",
      phoneLocal:
        data.user.phoneE164?.startsWith("+91") ? data.user.phoneE164.slice(3) : "",
      locale: data.user.locale,
    })
  }, [data, userForm])

  const userMutation = useMutation({
    mutationFn: (values: UserSettingsFormValues) =>
      updateAccountSettings(
        {
          displayName: values.displayName.trim() || null,
          locale: values.locale,
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(["account-settings"], nextSettings)
      dispatch(setLanguage(nextSettings.user.locale))
      void queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] })
      toast.success("Account details updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const avatarUrl = getProfileAvatarUrl(data?.user?.profileImageSeed)
  const hasProfileImage = Boolean(data?.user?.profileImageSeed)
  const profileImageActionLabel = hasProfileImage ? "Change" : "Generate"
  const avatarMutation = useMutation({
    mutationFn: () => regenerateAccountProfileImage(accessToken),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(["account-settings"], nextSettings)
      const currentSession = getStoredAuthSession()

      if (currentSession) {
        setStoredAuthSession({
          accountType: currentSession.accountType,
          session: currentSession.session,
          tenant: currentSession.tenant ?? null,
          user: {
            ...currentSession.user,
            email: nextSettings.user.email,
            phone: nextSettings.user.phoneE164,
            profileImageSeed: nextSettings.user.profileImageSeed,
            profileImageStyle: nextSettings.user.profileImageStyle,
          },
        })
      }

      void queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] })
      toast.success(
        hasProfileImage ? "Profile image changed." : "Profile image generated."
      )
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const sendPhoneOtpMutation = useMutation({
    mutationFn: () => {
      if (!phoneOtpReady) {
        throw new Error("Enter a valid 10-digit Indian mobile number.")
      }

      return sendFirebasePhoneOtp({
        identifier: normalizedPhoneLocal,
        purpose: "account",
      })
    },
    onSuccess: () => {
      setPhoneOtpSentTo(normalizedPhoneLocal)
      setPhoneOtpToken("")
      setPhoneVerificationError("")
      setPhoneVerificationFeedback("OTP sent. Enter the 6-digit code to verify.")
    },
    onError: (mutationError) => {
      setPhoneVerificationError(getErrorMessage(mutationError))
      setPhoneVerificationFeedback("")
    },
  })
  const sendPhoneOtpDisabled = !phoneOtpReady || sendPhoneOtpMutation.isPending

  const verifyPhoneMutation = useMutation({
    mutationFn: async () => {
      if (!phoneOtpWasSentForCurrentNumber) {
        throw new Error("Send OTP before verifying this phone number.")
      }

      if (!/^\d{6}$/.test(phoneOtpToken)) {
        throw new Error("Enter the 6-digit OTP.")
      }

      const firebaseToken = await confirmFirebasePhoneOtp({
        identifier: phoneOtpSentTo,
        token: phoneOtpToken,
      })

      return verifyAccountPhone(firebaseToken.idToken, accessToken)
    },
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(["account-settings"], nextSettings)
      void queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] })
      setPhoneOtpSentTo("")
      setPhoneOtpToken("")
      setPhoneVerificationError("")
      setPhoneVerificationFeedback("")
      toast.success("Phone number verified.")
    },
    onError: (mutationError) => {
      setPhoneVerificationError(getErrorMessage(mutationError))
      setPhoneVerificationFeedback("")
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordSettingsFormValues) =>
      changeAccountPassword(values, accessToken),
    onSuccess: () => {
      passwordForm.reset()
      toast.success("Password changed.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  function handleBackToPhoneEdit() {
    setPhoneOtpSentTo("")
    setPhoneOtpToken("")
    setPhoneVerificationError("")
    setPhoneVerificationFeedback("")
    sendPhoneOtpMutation.reset()
    verifyPhoneMutation.reset()
  }

  if (isLoading) {
    return <AccountPageSkeleton />
  }

  if (!data) {
    return (
      <div className="grid w-full flex-1 p-3 pt-3 sm:p-4 lg:grid-cols-[164px_minmax(0,760px)] lg:gap-8 lg:p-5 lg:pt-4 xl:grid-cols-[176px_minmax(0,760px)_260px]">
        <section className="lg:col-start-2">
          <h1 className="text-lg font-semibold">Account unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load your account details right now."}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="grid w-full flex-1 p-3 pt-3 sm:p-4 lg:grid-cols-[164px_minmax(0,760px)] lg:gap-8 lg:p-5 lg:pt-4 xl:grid-cols-[176px_minmax(0,760px)_260px] xl:gap-7">
      <aside className="hidden lg:block">
        <div className="sticky top-20 border-r border-border/70 pr-4">
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Account
          </p>
          <nav className="flex flex-col gap-0.5">
            {accountSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <section.icon className="size-3.5 shrink-0" />
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 space-y-6">
        <form
          className="space-y-6"
          onSubmit={userForm.handleSubmit((values) => userMutation.mutate(values))}
        >
          <section id="profile" className="scroll-mt-20 border-b border-border pb-6">
            <div className="mb-3 flex items-center gap-2">
              <UserRoundIcon className="size-4 text-muted-foreground" />
              <h1 className="text-xl font-semibold tracking-tight">Account</h1>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="size-14 ring-1 ring-border">
                  {avatarUrl ? (
                    <AvatarImage
                      src={avatarUrl}
                      alt={data.user.displayName ?? "GSTFY user"}
                    />
                  ) : null}
                  <AvatarFallback className="text-base font-medium">
                    {getUserInitials(data.user.displayName ?? data.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h2 className="text-sm font-medium">
                    {data.user.displayName ?? "GSTFY user"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {data.user.email ?? data.user.phoneE164 ?? "No login identifier"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={avatarMutation.isPending}
                onClick={() => avatarMutation.mutate()}
              >
                {avatarMutation.isPending ?
                  <Spinner />
                : <RefreshCwIcon className="size-4" />}
                {profileImageActionLabel}
              </Button>
            </div>

            <Field className="mt-4 max-w-md">
              <FieldLabel htmlFor="account-display-name">Display name</FieldLabel>
              <Input
                id="account-display-name"
                placeholder="How GSTFY should address you"
                {...userForm.register("displayName")}
              />
              <FieldError errors={[userForm.formState.errors.displayName]} />
            </Field>
          </section>

          <section id="login" className="scroll-mt-20 border-b border-border pb-6">
            <div className="mb-3 flex items-center gap-2">
              <LockKeyholeIcon className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Login</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-user-email">Email</FieldLabel>
                <Input
                  id="account-user-email"
                  value={data.user.email ?? "Email login not enabled"}
                  disabled
                />
              </Field>
              {!isCaAccount ? (
                <Field>
                  <FieldLabel htmlFor="account-user-phone">Phone</FieldLabel>
                  {data.user.phoneE164 ? (
                    <IndianPhoneInput
                      id="account-user-phone"
                      value={
                        data.user.phoneE164.startsWith("+91") ?
                          data.user.phoneE164.slice(3)
                        : data.user.phoneE164
                      }
                      disabled
                    />
                  ) : (
                    <>
                      {!phoneOtpWasSentForCurrentNumber ? (
                        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-150">
                          <IndianPhoneInput
                            id="account-user-phone"
                            value={normalizedPhoneLocal}
                            onChange={(event) => {
                              const nextPhone = event.target.value
                              userForm.setValue("phoneLocal", nextPhone, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                              if (phoneOtpSentTo && phoneOtpSentTo !== nextPhone) {
                                setPhoneOtpSentTo("")
                                setPhoneOtpToken("")
                              }
                              setPhoneVerificationError("")
                              setPhoneVerificationFeedback("")
                            }}
                            endAddon={
                              <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                  type="button"
                                  aria-disabled={sendPhoneOtpDisabled}
                                  className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                                  onClick={() => {
                                    if (sendPhoneOtpDisabled) {
                                      return
                                    }

                                    sendPhoneOtpMutation.mutate()
                                  }}
                                >
                                  {sendPhoneOtpMutation.isPending ? <Spinner /> : null}
                                  Send OTP
                                </InputGroupButton>
                              </InputGroupAddon>
                            }
                          />
                        </div>
                      ) : (
                        <div className="space-y-2 animate-in fade-in-0 slide-in-from-right-2 duration-150">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs text-muted-foreground">
                              OTP sent to{" "}
                              <span className="font-medium text-foreground">
                                +91 {phoneOtpSentTo}
                              </span>
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2 text-xs"
                              onClick={handleBackToPhoneEdit}
                            >
                              <ArrowLeftIcon className="size-3.5" />
                              Back to edit
                            </Button>
                          </div>
                          <InputOTP
                            id="account-phone-otp"
                            value={phoneOtpToken}
                            maxLength={6}
                            pattern={REGEXP_ONLY_DIGITS}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            containerClassName="justify-center"
                            onChange={(value) => {
                              setPhoneOtpToken(value.replace(/\D/g, "").slice(0, 6))
                              if (phoneVerificationError) {
                                setPhoneVerificationError("")
                              }
                            }}
                          >
                            <InputOTPGroup className="gap-1">
                              {Array.from({ length: 6 }).map((_, index) => (
                                <InputOTPSlot
                                  key={index}
                                  index={index}
                                  className="size-9 rounded-md border font-mono text-sm first:rounded-md last:rounded-md"
                                />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <Button
                              type="button"
                              size="sm"
                              className="w-full"
                              disabled={
                                phoneOtpToken.length !== 6 ||
                                verifyPhoneMutation.isPending
                              }
                              onClick={() => verifyPhoneMutation.mutate()}
                            >
                              {verifyPhoneMutation.isPending ? <Spinner /> : null}
                              Verify
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={sendPhoneOtpMutation.isPending}
                              onClick={() => sendPhoneOtpMutation.mutate()}
                            >
                              {sendPhoneOtpMutation.isPending ? <Spinner /> : null}
                              Resend
                            </Button>
                          </div>
                        </div>
                      )}
                      <FieldError errors={[userForm.formState.errors.phoneLocal]} />
                      {phoneVerificationError ? (
                        <FieldError>{phoneVerificationError}</FieldError>
                      ) : null}
                      {phoneVerificationFeedback ? (
                        <FieldDescription className="text-emerald-600 dark:text-emerald-400">
                          {phoneVerificationFeedback}
                        </FieldDescription>
                      ) : null}
                    </>
                  )}
                </Field>
              ) : null}
            </div>
          </section>

          <section id="preferences" className="scroll-mt-20 border-b border-border pb-6">
            <h2 className="mb-3 text-base font-semibold">Preferences</h2>
            <Field className="max-w-md">
              <FieldLabel htmlFor="account-locale">Preferred language</FieldLabel>
              <Controller
                control={userForm.control}
                name="locale"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as LanguageCode)}
                  >
                    <SelectTrigger
                      id="account-locale"
                      className="h-8 w-full min-w-[8.75rem] gap-2 pl-2.5 pr-3"
                    >
                      <Image
                        src="/india-flag.png"
                        alt="India"
                        width={16}
                        height={12}
                        className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                      />
                      <span className="flex flex-1 items-center text-left leading-none">
                        {localeLabels[field.value]}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      side="bottom"
                      sideOffset={8}
                      className="min-w-[8.75rem]"
                    >
                      {supportedLanguages.map((language) => (
                        <SelectItem key={language} value={language}>
                          <Image
                            src="/india-flag.png"
                            alt="India"
                            width={16}
                            height={12}
                            className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                          />
                          <span className="flex items-center leading-none">
                            {localeLabels[language]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[userForm.formState.errors.locale]} />
            </Field>
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={userMutation.isPending}>
                <SaveIcon className="size-4" />
                {userMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </section>
        </form>

        <section id="security" className="scroll-mt-20 pb-6">
          <div className="mb-3 flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Security</h2>
          </div>
          <form
            className="max-w-xl"
            onSubmit={passwordForm.handleSubmit((values) =>
              passwordMutation.mutate(values)
            )}
          >
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="account-current-password">
                  Current password
                </FieldLabel>
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register("currentPassword")}
                />
                <FieldError
                  errors={[passwordForm.formState.errors.currentPassword]}
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-new-password">New password</FieldLabel>
                  <Input
                    id="account-new-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("newPassword")}
                  />
                  <FieldError errors={[passwordForm.formState.errors.newPassword]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="account-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("confirmPassword")}
                  />
                  <FieldError
                    errors={[passwordForm.formState.errors.confirmPassword]}
                  />
                </Field>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => passwordForm.reset()}
                >
                  <EraserIcon className="size-4" />
                  Clear
                </Button>
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? <Spinner /> : <KeyRoundIcon />}
                  Change password
                </Button>
              </div>
            </FieldGroup>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Clock3Icon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Login activity</h3>
            </div>
            {data.securityActivity.recentSessions.length > 0 ? (
              <div className="space-y-2.5">
                {data.securityActivity.recentSessions.map((session, index) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-border/70 bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <MonitorSmartphoneIcon className="size-4 shrink-0 text-muted-foreground" />
                          <p className="truncate text-sm font-medium">
                            {getSessionDeviceLabel(session.userAgent)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock3Icon className="size-3.5" />
                            {formatAccountDateTime(session.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          session.revokedAt ?
                            "shrink-0 border-border bg-background text-muted-foreground"
                          : "shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }
                      >
                        {index === 0 ? "Latest" : session.revokedAt ? "Logged out" : "Active"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                Login activity will appear after your next sign in.
              </div>
            )}
          </div>
        </section>
      </main>

      <aside className="hidden xl:block">
        <div className="sticky top-20 space-y-3 border-l border-border/70 pl-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Knowledge base
            </p>
            <h2 className="mt-2 text-sm font-semibold">How login works</h2>
          </div>
          <div className="space-y-2.5">
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span aria-hidden="true" className="text-base">
                  📧
                </span>
                <p className="text-sm font-medium">Email first</p>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Your email is the primary login and receives password reset links.
              </p>
            </div>
            {!isCaAccount ? (
              <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span aria-hidden="true" className="text-base">
                    📱
                  </span>
                  <p className="text-sm font-medium">Phone after OTP</p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Mobile login turns on only after the number is verified here.
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span aria-hidden="true" className="text-base">
                  🔐
                </span>
                <p className="text-sm font-medium">Password stays protected</p>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Change it with your current password before saving a new one.
              </p>
            </div>
            {!isCaAccount ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span aria-hidden="true">✅</span>
                  Verified phone numbers can be used on the login screen.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function getUserInitials(value?: string | null) {
  if (!value) {
    return "GF"
  }

  const [first = "", second = ""] = value
    .replace(/@.+$/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean)

  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase() || "GF"
}

function getSessionDeviceLabel(userAgent?: string | null) {
  if (!userAgent) {
    return "Unknown device"
  }

  const browser =
    userAgent.includes("Edg/") ? "Edge"
    : userAgent.includes("Chrome/") ? "Chrome"
    : userAgent.includes("Firefox/") ? "Firefox"
    : userAgent.includes("Safari/") ? "Safari"
    : "Browser"
  const platform =
    /Android/i.test(userAgent) ? "Android"
    : /iPhone|iPad/i.test(userAgent) ? "iOS"
    : /Macintosh|Mac OS/i.test(userAgent) ? "macOS"
    : /Windows/i.test(userAgent) ? "Windows"
    : /Linux/i.test(userAgent) ? "Linux"
    : "Device"

  return `${browser} on ${platform}`
}

function formatAccountDateTime(value?: string | Date | null) {
  if (!value) {
    return "Not available"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

function AccountPageSkeleton() {
  return (
    <div className="grid w-full flex-1 p-3 pt-3 sm:p-4 lg:grid-cols-[164px_minmax(0,760px)] lg:gap-8 lg:p-5 lg:pt-4 xl:grid-cols-[176px_minmax(0,760px)_260px] xl:gap-7">
      <aside className="hidden lg:block">
        <div className="sticky top-20 border-r border-border/70 pr-4">
          <Skeleton className="mb-3 h-3 w-16" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-full rounded-md" />
            ))}
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-6">
        <section className="border-b border-border pb-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="max-w-md space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </section>

        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <section key={sectionIndex} className="border-b border-border pb-6 last:border-b-0">
            <Skeleton className="mb-3 h-5 w-28" />
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: sectionIndex === 2 ? 3 : 2 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <aside className="hidden xl:block">
        <div className="sticky top-20 border-l border-border/70 pl-5">
          <Skeleton className="mb-4 h-3 w-24" />
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      </aside>
    </div>
  )
}
