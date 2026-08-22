"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  clearPurchaseInvoicePdfCache,
  downloadBlob,
  fetchPurchaseInvoicePdf,
} from "@/lib/purchases/purchase-invoice-client"

export function PurchaseInvoiceViewerPage({ billId }: { billId: string }) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const forceNextFetchRef = React.useRef(false)
  const invoiceQuery = useQuery({
    queryKey: ["purchase-invoice-pdf", billId],
    queryFn: () => {
      const force = forceNextFetchRef.current
      forceNextFetchRef.current = false

      return fetchPurchaseInvoicePdf(accessToken, billId, { force })
    },
    enabled: accessToken.length > 0 && billId.length > 0,
    gcTime: 60 * 1000,
    staleTime: 0,
  })
  const invoiceBlob = invoiceQuery.data?.blob ?? null
  const objectUrl = React.useMemo(() => {
    if (!invoiceBlob) {
      return ""
    }

    return URL.createObjectURL(invoiceBlob)
  }, [invoiceBlob])

  React.useEffect(() => {
    if (!objectUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const hasPdfDocument = Boolean(invoiceQuery.data && objectUrl)
  const shouldShowSkeleton = !invoiceQuery.isError && !hasPdfDocument

  return (
    <main className="flex h-[calc(100vh-4rem)] min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-3 pt-3 sm:p-4 lg:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2"
          render={<Link href="/purchases" />}
        >
          <ArrowLeftIcon className="size-4" />
          Back to purchases
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 bg-background"
            disabled={invoiceQuery.isFetching}
            onClick={() => {
              forceNextFetchRef.current = true
              clearPurchaseInvoicePdfCache(accessToken, billId)
              void invoiceQuery.refetch()
            }}
          >
            {invoiceQuery.isFetching ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 bg-background"
            disabled={!objectUrl}
            onClick={() => {
              if (objectUrl) {
                window.open(objectUrl, "_blank", "noopener,noreferrer")
              }
            }}
          >
            <ExternalLinkIcon className="size-4" />
            Open
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
            disabled={!invoiceQuery.data}
            onClick={() => {
              if (invoiceQuery.data) {
                downloadBlob(invoiceQuery.data.fileName, invoiceQuery.data.blob)
              }
            }}
          >
            <DownloadIcon className="size-4" />
            Download
          </Button>
        </div>
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-background text-card-foreground">
        <div className="h-full overflow-hidden bg-background">
          {shouldShowSkeleton ? (
            <div className="flex h-full flex-col gap-3 p-4">
              <Skeleton className="h-10 shrink-0 rounded-lg" />
              <Skeleton className="min-h-0 flex-1 rounded-lg" />
            </div>
          ) : invoiceQuery.isError ? (
            <div className="flex h-full items-center justify-center p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>Invoice PDF could not load</EmptyTitle>
                  <EmptyDescription>
                    The document renderer could not fetch this purchase bill. Refresh and try again.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => void invoiceQuery.refetch()}
                  >
                    <RefreshCwIcon className="size-4" />
                    Retry
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <iframe
              src={objectUrl}
              title="Purchase invoice PDF"
              className="h-full w-full bg-background"
            />
          )}
        </div>
      </section>
    </main>
  )
}
