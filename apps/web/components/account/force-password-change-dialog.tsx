"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { LoaderCircleIcon, LockKeyholeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { completeFirstLoginPasswordChange } from "@/lib/account/api"
import {
  setStoredAuthSession,
  type StoredAuthSession,
} from "@/lib/auth/session"

type ForcePasswordChangeDialogProps = {
  session: StoredAuthSession
  onComplete: (session: StoredAuthSession) => void
}

type FormErrors = {
  newPassword?: string
  confirmPassword?: string
}

export function ForcePasswordChangeDialog({
  session,
  onComplete,
}: ForcePasswordChangeDialogProps) {
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [errors, setErrors] = React.useState<FormErrors>({})

  const mutation = useMutation({
    mutationFn: () =>
      completeFirstLoginPasswordChange(
        {
          newPassword,
          confirmPassword,
        },
        session.session.accessToken
      ),
    onSuccess: () => {
      const nextSession: StoredAuthSession = {
        ...session,
        user: {
          ...session.user,
          mustChangePassword: false,
        },
      }

      setStoredAuthSession(nextSession)
      onComplete(nextSession)
      toast.success("Password updated.")
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validatePasswordChange(newPassword, confirmPassword)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
              <LockKeyholeIcon className="size-5" />
            </div>
            <DialogTitle>Create your own password</DialogTitle>
            <DialogDescription>
              This account was created with a temporary password. Set a new password
              before continuing to the workspace.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errors.newPassword) || undefined}>
              <FieldLabel htmlFor="first-login-password">New password</FieldLabel>
              <Input
                id="first-login-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value)
                  setErrors((currentErrors) => ({
                    ...currentErrors,
                    newPassword: undefined,
                  }))
                }}
                aria-invalid={Boolean(errors.newPassword)}
                autoFocus
              />
              <FieldError>{errors.newPassword}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.confirmPassword) || undefined}>
              <FieldLabel htmlFor="first-login-confirm-password">
                Confirm password
              </FieldLabel>
              <Input
                id="first-login-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setErrors((currentErrors) => ({
                    ...currentErrors,
                    confirmPassword: undefined,
                  }))
                }}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              <FieldError>{errors.confirmPassword}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                "Save password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function validatePasswordChange(newPassword: string, confirmPassword: string) {
  const errors: FormErrors = {}

  if (newPassword.length < 8) {
    errors.newPassword = "Password must be at least 8 characters."
  } else if (!/\d/.test(newPassword)) {
    errors.newPassword = "Password must include at least one number."
  } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
    errors.newPassword = "Password must include at least one special character."
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirm your new password."
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match."
  }

  return errors
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again."
}
