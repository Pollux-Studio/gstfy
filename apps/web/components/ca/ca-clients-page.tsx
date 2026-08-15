"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CopyIcon,
  ExternalLinkIcon,
  MailIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersRoundIcon,
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
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  createCaClient,
  getCaInviteCreationToast,
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

export function CaClientsPage() {
  const queryClient = useQueryClient()
  const [storedSession, setStoredSession] = React.useState<ReturnType<
    typeof getStoredAuthSession
  >>(null)
  const userId = storedSession?.user.id ?? ""
  const accessToken = storedSession?.session.accessToken ?? ""
  const [formState, setFormState] = React.useState<ClientFormState>(initialFormState)
  const [latestInvite, setLatestInvite] = React.useState<CaClientInviteRecord | null>(null)

  React.useEffect(() => {
    setStoredSession(getStoredAuthSession())
  }, [])

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

  if (!storedSession || isLoading) {
    return <CaClientsSkeleton />
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-lg font-semibold">Clients unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load CA clients right now."}
          </p>
        </section>
      </div>
    )
  }

  const activeClients = data.clients.filter((client) => client.status === "active")

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit gap-1.5 bg-background">
              <UsersRoundIcon className="size-3.5" />
              CA clients
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Client access
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Add business clients, track accepted workspaces, and open client
                data for GST filing preparation.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-56">
            <MiniMetric label="Active" value={activeClients.length} />
            <MiniMetric label="Total" value={data.clients.length} />
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
              <h2 className="text-base font-semibold">Add client</h2>
              <FieldDescription>
                Create an invite for a business. Email is optional; the referral
                code can be shared manually.
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
              {createMutation.isPending ?
                <Spinner />
              : <UserPlusIcon className="size-4" />}
              Create invite
            </Button>
          </FieldGroup>

          {latestInvite ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="text-sm font-medium">Referral code created</p>
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
                <h2 className="text-base font-semibold">Accepted clients</h2>
                <p className="text-sm text-muted-foreground">
                  Businesses that have linked this CA practice for filing access.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/dashboard/referral-codes" />}
              >
                Referral codes
                <ExternalLinkIcon className="size-3.5" />
              </Button>
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
                          <p className="text-xs text-muted-foreground">
                            {client.tradeName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs uppercase tracking-[0.18em]">
                        {client.gstin ?? "Not added"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1.5 bg-background">
                          <ShieldCheckIcon className="size-3.5" />
                          GST filing
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
                              nativeButton={false}
                              render={
                                <Link href={`/dashboard/clients/${client.businessId}`} />
                              }
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
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No accepted clients yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </section>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function CaClientsSkeleton() {
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
