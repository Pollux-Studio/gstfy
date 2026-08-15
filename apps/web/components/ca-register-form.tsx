"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BriefcaseBusinessIcon,
  EyeIcon,
  EyeOffIcon,
  GalleryVerticalEndIcon,
  LockKeyholeIcon,
  MailIcon,
  UserRoundIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { caRegister } from "@/lib/auth/api"
import { setStoredAuthSession } from "@/lib/auth/session"
import { getAuthSubdomainUrl } from "@/lib/auth/workspace-url"
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

type CaRegisterValues = {
  fullName: string
  practiceName: string
  email: string
  password: string
  confirmPassword: string
}

export function CaRegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [caLoginHref, setCaLoginHref] = useState("/auth/ca/login")

  const schema = useMemo(
    () =>
      z
        .object({
          fullName: z
            .string()
            .trim()
            .min(2, "Enter the CA or accountant name."),
          practiceName: z
            .string()
            .trim()
            .min(2, "Enter the CA practice or firm name."),
          email: z.string().trim().email("Enter a valid email address."),
          password: z
            .string()
            .min(8, "Use at least 8 characters.")
            .regex(/\d/, "Use at least one number.")
            .regex(/[^A-Za-z0-9]/, "Use at least one special character."),
          confirmPassword: z.string().min(1, "Confirm your password."),
        })
        .refine((values) => values.password === values.confirmPassword, {
          path: ["confirmPassword"],
          message: "Passwords do not match.",
        }),
    []
  )

  const form = useForm<CaRegisterValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: "",
      practiceName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const values = useWatch({
    control: form.control,
  })
  const registerMutation = useMutation({
    mutationFn: caRegister,
  })

  useEffect(() => {
    setCaLoginHref(getAuthSubdomainUrl("/auth/ca/login"))
  }, [])

  async function handleSubmit(formValues: CaRegisterValues) {
    setSubmitError("")

    try {
      const response = await registerMutation.mutateAsync({
        fullName: formValues.fullName.trim(),
        practiceName: formValues.practiceName.trim(),
        email: formValues.email.trim().toLowerCase(),
        password: formValues.password,
        emailRedirectTo:
          typeof window !== "undefined" ?
            getAuthSubdomainUrl("/auth/ca/login")
          : undefined,
      })

      setStoredAuthSession({
        accountType: "ca",
        user: response.user,
        session: response.session,
      })

      navigateAfterCaAuth(response.redirectTo, router)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create CA account."
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
        <h1 className="text-xl font-bold">Create CA account</h1>
        <FieldDescription>
          Register a CA workspace to invite clients and manage GST filing access.
        </FieldDescription>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ca-full-name">CA / accountant name</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <UserRoundIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-full-name"
                placeholder="Prasanth Kumar"
                autoComplete="name"
                aria-invalid={!!form.formState.errors.fullName}
                {...form.register("fullName")}
              />
            </InputGroup>
            <FieldError errors={[form.formState.errors.fullName]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="ca-practice-name">Practice / firm name</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <BriefcaseBusinessIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-practice-name"
                placeholder="Prasanth & Co"
                autoComplete="organization"
                aria-invalid={!!form.formState.errors.practiceName}
                {...form.register("practiceName")}
              />
            </InputGroup>
            <FieldError errors={[form.formState.errors.practiceName]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="ca-register-email">Email</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <MailIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-register-email"
                type="email"
                placeholder="ca@gstfy.in"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
            </InputGroup>
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="ca-register-password">Password</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <LockKeyholeIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-register-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
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
          </Field>

          <Field>
            <FieldLabel htmlFor="ca-confirm-password">Confirm password</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <LockKeyholeIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                id="ca-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                aria-invalid={!!form.formState.errors.confirmPassword}
                {...form.register("confirmPassword")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Use at least 8 characters with one number and one special character.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.confirmPassword]} />
            {submitError ? (
              <FieldDescription className="text-destructive">
                {submitError}
              </FieldDescription>
            ) : null}
          </Field>

          <Field className="gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={
                !form.formState.isValid ||
                !values.fullName?.trim() ||
                !values.practiceName?.trim() ||
                !values.email?.trim() ||
                !values.password ||
                !values.confirmPassword ||
                registerMutation.isPending
              }
            >
              {registerMutation.isPending ? "Creating..." : "Create CA account"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              nativeButton={false}
              render={<Link href={caLoginHref} />}
            >
              Already have a CA account?
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}

function navigateAfterCaAuth(redirectTo: string, router: ReturnType<typeof useRouter>) {
  if (/^https?:\/\//.test(redirectTo)) {
    window.location.assign(redirectTo)
    return
  }

  router.push(redirectTo)
}
