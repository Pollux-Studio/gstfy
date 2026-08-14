"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BriefcaseBusinessIcon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  MailIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  createCaClient,
  getCaDashboard,
  revokeCaClient,
  type CaClientInviteRecord,
} from "@/lib/ca/api"

type ClientFormState = {
  clientName: string
  clientEmail: string
  clientGstin: string
}

const initialFormState: ClientFormState = {
  clientName: "",
  clientEmail: "",
  clientGstin: "",
}

export function CaDashboardPage() {
  const queryClient = useQueryClient()
  const storedSession = getStoredAuthSession()
  const userId = storedSession?.user.id ?? ""
  const accessToken = storedSession?.session.accessToken ?? ""
  const [formState, setFormState] = React.useState<ClientFormState>(initialFormState)
  const [latestInvite, setLatestInvite] = React.useState<CaClientInviteRecord | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["ca", "dashboard", userId],
    queryFn: () => getCaDashboard(accessToken),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60 * 3,
  })

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
    onSuccess: (nextData) => {
      queryClient.setQueryData(["ca", "dashboard", userId], nextData)
      setFormState(initialFormState)
      setLatestInvite(nextData.invites[0] ?? null)
      toast.success("Client invite created.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (businessId: string) => revokeCaClient(businessId, accessToken),
    onSuccess: (nextData) => {
      queryClient.setQueryData(["ca", "dashboard", userId], nextData)
      toast.success("CA access revoked for this client.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  function updateFormValue(key: keyof ClientFormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }))
  }

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formState.clientName.trim()) {
      toast.error("Enter the client business name.")
      return
    }

    createMutation.mutate()
  }

  if (isLoading) {
    return <CaDashboardSkeleton />
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-lg font-semibold">CA dashboard unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load CA clients right now."}
          </p>
        </section>
      </div>
    )
  }

  const pendingInvites = data.invites.filter((invite) => invite.status === "pending")

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border bg-card text-card-foreground">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5 bg-background/70">
              <BriefcaseBusinessIcon className="size-3.5" />
              CA Workspace
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {data.practice.name}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Manage client invites and open accepted client workspaces for GST filing review.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <Metric label="Active clients" value={data.clients.filter((client) => client.status === "active").length} />
            <Metric label="Pending codes" value={pendingInvites.length} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          className="rounded-2xl border border-border bg-card p-4 sm:p-5"
          onSubmit={handleSubmit}
        >
          <FieldGroup>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Add client</h2>
              <FieldDescription>
                Create an invite. Email is optional; the referral code is always generated.
              </FieldDescription>
            </div>
            <Field>
              <FieldLabel htmlFor="ca-client-name">Business name</FieldLabel>
              <Input
                id="ca-client-name"
                value={formState.clientName}
                onChange={(event) => updateFormValue("clientName", event.target.value)}
                placeholder="Vicky Retail Private Limited"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ca-client-email">Client email</FieldLabel>
              <Input
                id="ca-client-email"
                type="email"
                value={formState.clientEmail}
                onChange={(event) => updateFormValue("clientEmail", event.target.value)}
                placeholder="owner@example.com"
              />
              <FieldDescription>
                If email is empty, share the generated code manually.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="ca-client-gstin">GSTIN</FieldLabel>
              <Input
                id="ca-client-gstin"
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
              <UserPlusIcon className="size-4" />
              {createMutation.isPending ? "Creating..." : "Create invite"}
            </Button>
          </FieldGroup>
        </form>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Referral codes</h2>
                <p className="text-sm text-muted-foreground">
                  One-time codes for clients who need to link their business.
                </p>
              </div>
              <Badge variant="outline">{pendingInvites.length} pending</Badge>
            </div>
          </div>
          <div className="divide-y divide-border">
            {pendingInvites.length > 0 ?
              pendingInvites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  isLatest={latestInvite?.id === invite.id}
                  onCopy={copyText}
                />
              ))
            : (
              <div className="p-5 text-sm text-muted-foreground">
                No pending referral codes.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Accepted clients</h2>
              <p className="text-sm text-muted-foreground">
                Active businesses linked to this CA workspace.
              </p>
            </div>
            <Badge variant="outline">{data.clients.length} clients</Badge>
          </div>
        </div>
        <div className="app-scrollbar overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Business</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.clients.length > 0 ?
                data.clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{client.businessName}</p>
                        <p className="text-xs text-muted-foreground">{client.tradeName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs uppercase tracking-[0.18em]">
                      {client.gstin ?? "Not added"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1.5">
                        <ShieldCheckIcon className="size-3.5" />
                        GST read/write
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(client.acceptedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {client.businessId ?
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            render={<Link href={`/ca/clients/${client.businessId}`} />}
                          >
                            Open
                            <ExternalLinkIcon className="size-3.5" />
                          </Button>
                        : (
                          <Button type="button" variant="outline" size="sm" disabled>
                            Open
                            <ExternalLinkIcon className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={revokeMutation.isPending || !client.businessId}
                          onClick={() => revokeMutation.mutate(client.businessId)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No accepted clients yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function InviteRow({
  invite,
  isLatest,
  onCopy,
}: {
  invite: CaClientInviteRecord
  isLatest: boolean
  onCopy: (value: string, label: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{invite.clientName}</p>
          {isLatest ? <Badge>New</Badge> : null}
          {invite.clientEmail ? (
            <Badge variant="outline" className="gap-1.5">
              <MailIcon className="size-3.5" />
              Email queued
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Expires {formatDate(invite.expiresAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5 font-mono">
          <KeyRoundIcon className="size-3.5" />
          {invite.referralCode}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy(invite.referralCode, "Referral code")}
        >
          <CopyIcon className="size-3.5" />
          Code
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onCopy(invite.inviteUrl, "Invite link")}
        >
          <CopyIcon className="size-3.5" />
          Link
        </Button>
      </div>
    </div>
  )
}

function CaDashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
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
