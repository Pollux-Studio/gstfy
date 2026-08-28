"use client"

import * as React from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  MailIcon,
  PlusIcon,
  TimerIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import {
  getStoredAuthSession,
  subscribeToAuthSessionChange,
} from "@/lib/auth/session"
import {
  createCaClient,
  getCaInviteCreationToast,
  getCaDashboard,
  type CaClientInviteRecord,
} from "@/lib/ca/api"

type ReferralFormState = {
  clientName: string
  clientEmail: string
  clientGstin: string
}

const initialFormState: ReferralFormState = {
  clientName: "",
  clientEmail: "",
  clientGstin: "",
}
const caTablePageSize = 15

export function CaReferralCodesPage() {
  const queryClient = useQueryClient()
  const storedSession = React.useSyncExternalStore(
    subscribeToAuthSessionChange,
    getStoredAuthSession,
    () => null
  )
  const userId = storedSession?.user.id ?? ""
  const accessToken = storedSession?.session.accessToken ?? ""
  const [formState, setFormState] =
    React.useState<ReferralFormState>(initialFormState)
  const [latestInvite, setLatestInvite] = React.useState<CaClientInviteRecord | null>(null)

  const invitesQuery = useInfiniteQuery({
    queryKey: ["ca", "dashboard", userId, "invites"],
    queryFn: ({ pageParam }) =>
      getCaDashboard(accessToken, {
        clientsLimit: 1,
        invitesPage: pageParam,
        invitesLimit: caTablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.invitesPagination.hasMore ?
        lastPage.invitesPagination.page + 1
        : undefined,
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60 * 3,
  })
  const data = invitesQuery.data?.pages[0]
  const invites = invitesQuery.data?.pages.flatMap((page) => page.invites) ?? []
  const error = invitesQuery.error
  const totalInvitesCount = data?.invitesPagination.total ?? invites.length

  const createMutation = useMutation({
    mutationFn: () =>
      createCaClient(
        {
          clientName: formState.clientName.trim(),
          ...(formState.clientEmail.trim() ?
            { clientEmail: formState.clientEmail.trim() }
            : {}),
          ...(formState.clientGstin.trim() ?
            { clientGstin: formState.clientGstin.trim().toUpperCase() }
            : {}),
        },
        accessToken
      ),
    onSuccess: async (nextData) => {
      await queryClient.invalidateQueries({ queryKey: ["ca", "dashboard"] })
      setLatestInvite(nextData.invites[0] ?? null)
      setFormState(initialFormState)
      const inviteToast = getCaInviteCreationToast(nextData.createdInvite)

      if (inviteToast.type === "warning") {
        toast.warning(inviteToast.title, {
          description: inviteToast.description,
        })
      } else {
        toast.success(inviteToast.title)
      }
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  function updateFormValue(key: keyof ReferralFormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }))
  }

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  }

  const handleInvitesTableScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!invitesQuery.hasNextPage || invitesQuery.isFetchingNextPage) {
        return
      }

      const target = event.currentTarget
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight

      if (remaining < 160) {
        void invitesQuery.fetchNextPage()
      }
    },
    [invitesQuery]
  )

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formState.clientName.trim()) {
      toast.error("Enter the client business name.")
      return
    }

    createMutation.mutate()
  }

  if (!storedSession || invitesQuery.isLoading) {
    return <CaReferralCodesSkeleton />
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-lg font-semibold">Referral codes unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load referral codes right now."}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit gap-1.5 bg-background">
              <KeyRoundIcon className="size-3.5" />
              Referral codes
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Client onboarding codes
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Generate and share one-time referral codes so businesses can link
                their GST workspace to this CA practice.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-56">
            <MiniMetric label="Pending" value={data.summary.pendingInvitesTotal} />
            <MiniMetric label="Accepted" value={data.summary.acceptedInvitesTotal} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
          onSubmit={handleSubmit}
        >
          <FieldGroup>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Generate code</h2>
              <FieldDescription>
                Use email when available. If not, copy the code and share it with
                the client manually.
              </FieldDescription>
            </div>
            <Field>
              <FieldLabel htmlFor="ca-referral-client-name">Business name</FieldLabel>
              <Input
                id="ca-referral-client-name"
                value={formState.clientName}
                onChange={(event) => updateFormValue("clientName", event.target.value)}
                placeholder="Client business name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ca-referral-client-email">Client email</FieldLabel>
              <Input
                id="ca-referral-client-email"
                type="email"
                value={formState.clientEmail}
                onChange={(event) => updateFormValue("clientEmail", event.target.value)}
                placeholder="owner@example.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ca-referral-client-gstin">GSTIN</FieldLabel>
              <Input
                id="ca-referral-client-gstin"
                value={formState.clientGstin}
                onChange={(event) =>
                  updateFormValue("clientGstin", event.target.value.toUpperCase())
                }
                placeholder="33ABCDE1234F1Z5"
                maxLength={15}
                className="font-mono uppercase tracking-[0.18em]"
              />
            </Field>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner /> : <PlusIcon className="size-4" />}
              Generate referral code
            </Button>
          </FieldGroup>

          {latestInvite ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="text-sm font-medium">Latest code</p>
              <p className="mt-1 font-mono text-sm">{latestInvite.referralCode}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(latestInvite.referralCode, "Referral code")}
                >
                  <CopyIcon className="size-3.5" />
                  Code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(latestInvite.inviteUrl, "Invite link")}
                >
                  <CopyIcon className="size-3.5" />
                  Link
                </Button>
              </div>
            </div>
          ) : null}
        </form>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Referral code history</h2>
                <p className="text-sm text-muted-foreground">
                  Track generated codes and copy links for client onboarding.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/clients" />}
              >
                Clients
                <ExternalLinkIcon className="size-3.5" />
              </Button>
            </div>
          </div>
          <div
            className="app-scrollbar max-h-[35rem] overflow-auto"
            onScroll={handleInvitesTableScroll}
          >
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-44 text-right">Copy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length > 0 ?
                  invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{invite.clientName}</p>
                          {invite.clientEmail ? (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MailIcon className="size-3.5" />
                              {invite.clientEmail}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Manual sharing
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {invite.referralCode}
                      </TableCell>
                      <TableCell className="font-mono text-xs uppercase tracking-[0.18em]">
                        {invite.clientGstin ?? "Not locked"}
                      </TableCell>
                      <TableCell>
                        <InviteStatusBadge status={invite.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(invite.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              copyText(invite.referralCode, "Referral code")
                            }
                          >
                            <CopyIcon className="size-3.5" />
                            Code
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyText(invite.inviteUrl, "Invite link")}
                          >
                            Link
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                  : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No referral codes generated yet.
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>
          {invites.length > 0 ? (
            <div className="flex items-center justify-center border-t px-4 py-3 text-xs text-muted-foreground">
              {invitesQuery.isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-3.5" />
                  Loading more referral codes
                </span>
              ) : invitesQuery.hasNextPage ? (
                <span>Scroll to load more referral codes</span>
              ) : (
                <span>
                  Showing {invites.length} of {totalInvitesCount} referral codes
                </span>
              )}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  )
}

function InviteStatusBadge({ status }: { status: CaClientInviteRecord["status"] }) {
  if (status === "accepted") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <CheckCircle2Icon className="size-3.5" />
        Accepted
      </Badge>
    )
  }

  if (status === "pending") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <TimerIcon className="size-3.5" />
        Pending
      </Badge>
    )
  }

  return <Badge variant="outline">{status}</Badge>
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function CaReferralCodesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
