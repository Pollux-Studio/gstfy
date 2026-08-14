"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LockKeyholeIcon, SaveIcon, Settings2Icon, UserRoundIcon } from "lucide-react"
import * as React from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredAuthSession } from "@/lib/auth/session"
import { supportedLanguages, type LanguageCode } from "@/lib/i18n/languages"
import {
  getSettings,
  updateUserSettings,
} from "@/lib/settings/api"
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

const localeLabels: Record<LanguageCode, string> = {
  en: "English (IN)",
  ta: "தமிழ்",
  hi: "हिन्दी",
}

export function AccountPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
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
      updateUserSettings(
        {
          displayName: values.displayName.trim() || null,
          ...(values.phoneLocal.trim() ? { phoneE164: `+91${values.phoneLocal.trim()}` } : {}),
          locale: values.locale,
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(["settings"], nextSettings)
      dispatch(setLanguage(nextSettings.user.locale))
      void queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] })
      toast.success("Account details updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  if (isLoading) {
    return <AccountPageSkeleton />
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card/80 p-6">
          <h1 className="text-lg font-semibold">Account unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load your account details right now."}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5 border-border/70 bg-background/60">
              <Settings2Icon className="size-3.5" />
              Account
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Manage your login identity, display name, preferred language, and password recovery options.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-border/70 bg-background/60">
              <UserRoundIcon className="size-3.5" />
              {data.user.displayName ?? "GSTFY user"}
            </Badge>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  <UserRoundIcon className="size-4" />
                </span>
                <h2 className="text-base font-semibold">Profile settings</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Update how GSTFY identifies you across the workspace without changing the underlying login identifier.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-4 py-4 sm:px-5 lg:px-6">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <LockKeyholeIcon className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Login identifiers</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-user-email">Login email</FieldLabel>
                <Input
                  id="account-user-email"
                  value={data.user.email ?? "Email login not enabled"}
                  disabled
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-user-phone">Login phone</FieldLabel>
                {data.user.phoneE164 ? (
                  <Input
                    id="account-user-phone"
                    value={data.user.phoneE164}
                    disabled
                  />
                ) : (
                  <>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>+91</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="account-user-phone"
                        maxLength={10}
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="0000000000"
                        {...userForm.register("phoneLocal")}
                      />
                    </InputGroup>
                    <FieldDescription>
                      Add a login phone number for OTP-based sign-in.
                    </FieldDescription>
                    <FieldError errors={[userForm.formState.errors.phoneLocal]} />
                  </>
                )}
              </Field>
            </div>
          </div>

          <form onSubmit={userForm.handleSubmit((values) => userMutation.mutate(values))}>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="account-display-name">Display name</FieldLabel>
                  <Input
                    id="account-display-name"
                    placeholder="How GSTFY should address you"
                    {...userForm.register("displayName")}
                  />
                  <FieldDescription>
                    Used in the sidebar profile, account menu, and workspace surfaces.
                  </FieldDescription>
                  <FieldError errors={[userForm.formState.errors.displayName]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="account-locale">Preferred language</FieldLabel>
                  <Controller
                    control={userForm.control}
                    name="locale"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value as LanguageCode)}
                      >
                        <SelectTrigger id="account-locale" className="w-full">
                          <SelectValue placeholder="Choose language">
                            {localeLabels[field.value]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {supportedLanguages.map((language) => (
                            <SelectItem key={language} value={language}>
                              {localeLabels[language]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[userForm.formState.errors.locale]} />
                </Field>
              </div>

              <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  render={<Link href="/auth/forgot-password" />}
                >
                  Reset password
                </Button>
                <Button type="submit" disabled={userMutation.isPending}>
                  <SaveIcon className="size-4" />
                  {userMutation.isPending ? "Saving..." : "Save account details"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </div>
      </section>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function AccountPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-[22rem] max-w-full" />
            <Skeleton className="h-4 w-[26rem] max-w-full" />
          </div>
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5 lg:px-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-[28rem] max-w-full" />
          </div>
        </div>

        <div className="space-y-6 px-4 py-4 sm:px-5 lg:px-6">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <Skeleton className="mb-4 h-5 w-32" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>
      </section>
    </div>
  )
}
