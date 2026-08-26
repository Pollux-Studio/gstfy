"use client"

import * as React from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  EyeIcon,
  FilePlus2Icon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
  listSalesInvoices,
  postSalesInvoice,
  type SalesInvoice,
} from "@/lib/sales/api"
import { cn } from "@/lib/utils"

const tablePageSize = 15

export function SalesInvoicesPage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")

  const invoicesQuery = useInfiniteQuery({
    queryKey: ["sales", "invoices", search],
    queryFn: ({ pageParam }) =>
      listSalesInvoices(accessToken, {
        search,
        page: pageParam,
        limit: tablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
  })
  const postMutation = useMutation({
    mutationFn: (invoiceId: string) => postSalesInvoice(accessToken, invoiceId),
    onSuccess: async () => {
      toast.success("Invoice posted to accounting.")
      await queryClient.invalidateQueries({ queryKey: ["sales", "invoices"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const invoices =
    invoicesQuery.data?.pages.flatMap((page) => page.invoices) ?? []
  const totalInvoicesCount =
    invoicesQuery.data?.pages[0]?.pagination.total ?? invoices.length

  function handleInvoicesTableScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const remainingScroll =
      target.scrollHeight - target.scrollTop - target.clientHeight

    if (
      remainingScroll < 160 &&
      invoicesQuery.hasNextPage &&
      !invoicesQuery.isFetchingNextPage
    ) {
      void invoicesQuery.fetchNextPage()
    }
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5">
              <ReceiptTextIcon className="size-3.5" />
              Sales accounting
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
              <p className="text-sm text-muted-foreground">
                Create tax invoices and post balanced sales journals automatically.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => invoicesQuery.refetch()}
              disabled={invoicesQuery.isFetching}
            >
              {invoicesQuery.isFetching ? <Spinner /> : <RefreshCcwIcon />}
              Refresh
            </Button>
            <Link className={buttonVariants()} href="/invoices/new">
                <FilePlus2Icon />
                New invoice
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice or customer"
              className="pl-8"
            />
          </div>
          <p className="text-sm text-muted-foreground">{invoices.length} invoices</p>
        </div>

        <div
          onScroll={handleInvoicesTableScroll}
          className="app-scrollbar max-h-[35rem] overflow-auto"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="w-36 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No sales invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    isPosting={postMutation.isPending}
                    onPost={() => postMutation.mutate(invoice.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
          {invoicesQuery.isFetchingNextPage ? (
            <div className="flex items-center justify-center gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground">
              <Spinner />
              Loading more invoices
            </div>
          ) : invoicesQuery.hasNextPage ? (
            <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
              Scroll to load more · {invoices.length} of {totalInvoicesCount}
            </div>
          ) : invoices.length > tablePageSize ? (
            <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
              All {totalInvoicesCount} invoices loaded
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

function InvoiceRow({
  invoice,
  isPosting,
  onPost,
}: {
  invoice: SalesInvoice
  isPosting: boolean
  onPost: () => void
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
      <TableCell className="font-medium">{invoice.customerName}</TableCell>
      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
      <TableCell>
        <StatusBadge status={invoice.status} />
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(invoice.totalAmount)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(invoice.amountDue)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          {invoice.status === "draft" || invoice.status === "quotation" ? (
            <Button size="sm" variant="outline" onClick={onPost} disabled={isPosting}>
              {isPosting ? <Spinner /> : "Post"}
            </Button>
          ) : null}
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={`/invoices/${invoice.id}`}
          >
            <EyeIcon />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  )
}

function StatusBadge({ status }: { status: SalesInvoice["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "posted" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "quotation" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
        status === "draft" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {status === "posted" ? "Posted"
      : status === "quotation" ? "Quotation"
      : status === "draft" ? "Draft"
      : "Cancelled"}
    </Badge>
  )
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}
