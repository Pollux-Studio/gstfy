"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getStoredAuthSession } from "@/lib/auth/session"
import { acceptCaInvite } from "@/lib/ca/api"

export function AcceptCaInvitePage() {
  const searchParams = useSearchParams()
  const initialCode = searchParams.get("code") ?? ""
  const [referralCode, setReferralCode] = React.useState(initialCode)
  const [accepted, setAccepted] = React.useState(false)
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const loginHref = `/auth/login?next=${encodeURIComponent(
    `/ca/accept?code=${encodeURIComponent(referralCode.trim())}`
  )}`

  const acceptMutation = useMutation({
    mutationFn: () => acceptCaInvite(referralCode.trim(), accessToken),
    onSuccess: () => {
      setAccepted(true)
      toast.success("CA access linked to this business.")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to accept this code.")
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!accessToken) {
      toast.error("Sign in before accepting this CA referral code.")
      return
    }

    if (!referralCode.trim()) {
      toast.error("Enter the referral code shared by your CA.")
      return
    }

    acceptMutation.mutate()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 lg:p-6">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
        {accepted ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <ShieldCheckIcon className="size-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">CA access linked</h1>
              <p className="text-sm text-muted-foreground">
                Your CA can now access the GST filing workspace for this business.
              </p>
            </div>
            <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              render={<Link href={accessToken ? "/dashboard" : "/auth/login"} />}
            >
              <ArrowLeftIcon className="size-4" />
              {accessToken ? "Dashboard" : "Login"}
            </Button>
            <div className="space-y-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <KeyRoundIcon className="size-5" />
              </div>
              <h1 className="text-xl font-semibold">Accept CA referral code</h1>
              <p className="text-sm text-muted-foreground">
                Enter the one-time code shared by your CA or accountant to give GST filing access.
              </p>
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ca-referral-code">Referral code</FieldLabel>
                <Input
                  id="ca-referral-code"
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                  placeholder="GSTFY-XXXXXXXX"
                  className="font-mono uppercase tracking-[0.18em]"
                />
                <FieldDescription>
                  The code can be used once and must be accepted by an owner or admin.
                </FieldDescription>
              </Field>
              {accessToken ? (
                <Button type="submit" disabled={acceptMutation.isPending}>
                  {acceptMutation.isPending ? "Linking..." : "Accept access"}
                </Button>
              ) : (
                <Button type="button" render={<Link href={loginHref} />}>
                  Sign in to accept
                </Button>
              )}
            </FieldGroup>
          </form>
        )}
      </section>
    </div>
  )
}
