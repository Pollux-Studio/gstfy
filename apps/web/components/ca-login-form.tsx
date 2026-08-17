"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  EyeIcon,
  EyeOffIcon,
  GalleryVerticalEndIcon,
  LockKeyholeIcon,
  MailIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { caLogin } from "@/lib/auth/api"
import { clearStoredAuthSession, setStoredAuthSession } from "@/lib/auth/session"
import { getAuthSubdomainUrl, getCaAppSubdomainUrl } from "@/lib/auth/workspace-url"
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
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type CaLoginValues = {
  email: string
  password: string
}

export function CaLoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = sanitizeNextPath(searchParams.get("next"))
  const registered = searchParams.get("registered") === "1"
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState("")
  const caRegisterHref = getAuthSubdomainUrl("/auth/ca/register")

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email("Enter a valid CA account email."),
        password: z.string().min(1, "Enter your password."),
      }),
    []
  )

  const form = useForm<CaLoginValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const rawEmail = useWatch({
    control: form.control,
    name: "email",
    defaultValue: "",
  })
  const rawPassword = useWatch({
    control: form.control,
    name: "password",
    defaultValue: "",
  })
  const loginMutation = useMutation({
    mutationFn: caLogin,
  })

  async function handleSubmit(values: CaLoginValues) {
    setAuthError("")

    try {
      const response = await loginMutation.mutateAsync({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })

      setStoredAuthSession({
        accountType: "ca",
        user: response.user,
        session: response.session,
      })

      navigateAfterCaAuth(nextPath ?? response.redirectTo, router)
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to sign in right now."
      )
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
        <h1 className="text-xl font-bold">CA login</h1>
        <FieldDescription>
          Sign in to manage referred clients and GST filing workspaces.
        </FieldDescription>
        {registered ? (
          <FieldDescription className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            CA account created. Verify your email if required, then sign in.
          </FieldDescription>
        ) : null}
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ca-email">Email</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <MailIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-email"
                type="email"
                autoComplete="email"
                placeholder="ca@gstfy.in"
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
                onChange={(event) => {
                  form.setValue("email", event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                  setAuthError("")
                }}
              />
            </InputGroup>
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="ca-password">Password</FieldLabel>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <InputGroup>
              <InputGroupAddon>
                <LockKeyholeIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
                onChange={(event) => {
                  form.setValue("password", event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                  setAuthError("")
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
            <FieldError errors={[form.formState.errors.password]} />
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
              disabled={
                !form.formState.isValid ||
                rawEmail.trim().length === 0 ||
                rawPassword.length === 0 ||
                loginMutation.isPending
              }
            >
              {loginMutation.isPending ? (
                <Spinner />
              ) : (
                "Login as CA"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href={caRegisterHref} />}
            >
              Create CA account
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              nativeButton={false}
              render={<Link href="/auth/login" />}
            >
              Business login
            </Button>
            <FieldDescription className="px-4 text-center text-xs">
              By clicking Login as CA, you agree to our{" "}
              <a href="/terms">Terms of Service</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null
  }

  return value
}

function navigateAfterCaAuth(redirectTo: string, router: ReturnType<typeof useRouter>) {
  if (/^https?:\/\//.test(redirectTo)) {
    assignAuthTarget(redirectTo)
    return
  }

  const normalizedRedirect = normalizeCaRedirectPath(redirectTo)

  if (
    normalizedRedirect === "/dashboard" ||
    normalizedRedirect.startsWith("/dashboard/clients") ||
    normalizedRedirect.startsWith("/dashboard/referral-codes")
  ) {
    assignAuthTarget(getCaAppSubdomainUrl(normalizedRedirect))
    return
  }

  router.push(normalizedRedirect)
}

function normalizeCaRedirectPath(path: string) {
  if (path === "/ca") {
    return "/dashboard"
  }

  if (path.startsWith("/ca/clients")) {
    return path.replace(/^\/ca\/clients/, "/dashboard/clients")
  }

  if (path.startsWith("/ca/referral-codes")) {
    return path.replace(/^\/ca\/referral-codes/, "/dashboard/referral-codes")
  }

  return path
}

function assignAuthTarget(target: string) {
  const targetUrl = new URL(target, window.location.href)

  if (targetUrl.origin !== window.location.origin) {
    clearStoredAuthSession()
  }

  window.location.assign(targetUrl.toString())
}
