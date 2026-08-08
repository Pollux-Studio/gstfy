"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CopyPlusIcon,
  EyeIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  Trash2Icon,
  FileDownIcon,
  PlusIcon,
} from "lucide-react"

import { PurchaseActionDialogs, type PurchaseActionDialogState } from "@/components/purchases/purchase-action-dialogs"
import {
  PurchaseGstrBadge,
  PurchaseItcBadge,
  PurchasePaymentBadge,
  PurchaseStatusBadge,
} from "@/components/purchases/purchase-badges"
import { PurchaseNotice } from "@/components/purchases/purchase-notice"
import { usePurchases } from "@/components/purchases/purchases-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Gstr2bStatus, PaymentStatus, PurchaseBillStatus } from "@/lib/purchases/types"
import { formatCurrency, formatDisplayDate } from "@/lib/purchases/utils"

type FilterState = {
  query: string
  status: PurchaseBillStatus | "all"
  gstr2bStatus: Gstr2bStatus | "all"
  paymentStatus: PaymentStatus | "all"
}

export function PurchaseListPage() {
  const router = useRouter()
  const {
    bills,
    notice,
    setNotice,
    duplicateBill,
    deleteBill,
    updateGstr2bStatus,
    markAsReconciled,
  } = usePurchases()
  const [filters, setFilters] = React.useState<FilterState>({
    query: "",
    status: "all",
    gstr2bStatus: "all",
    paymentStatus: "all",
  })
  const [actionDialog, setActionDialog] =
    React.useState<PurchaseActionDialogState>(null)

  const filteredBills = React.useMemo(() => {
    const normalizedQuery = filters.query.trim().toLowerCase()

    return bills.filter((bill) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        bill.billNumber.toLowerCase().includes(normalizedQuery) ||
        bill.supplierName.toLowerCase().includes(normalizedQuery) ||
        bill.supplierInvoiceNumber.toLowerCase().includes(normalizedQuery)
      const matchesStatus =
        filters.status === "all" || bill.status === filters.status
      const matchesGstr =
        filters.gstr2bStatus === "all" || bill.gstr2bStatus === filters.gstr2bStatus
      const matchesPayment =
        filters.paymentStatus === "all" || bill.paymentStatus === filters.paymentStatus

      return matchesQuery && matchesStatus && matchesGstr && matchesPayment
    })
  }, [bills, filters])

  function setFilterValue<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }))
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        {notice ? <PurchaseNotice notice={notice} onDismiss={() => setNotice(null)} /> : null}

        <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="space-y-2">
              <Badge variant="outline" className="gap-1.5 bg-background/70">
                <ReceiptTextIcon className="size-3.5" />
                Purchases
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Purchase bills</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Record supplier bills, track ITC eligibility, and monitor GSTR-2B reconciliation from one purchase register.
                </p>
              </div>
            </div>
            <Button type="button" className="h-10 rounded-xl" onClick={() => router.push("/purchases/add")}>
              <PlusIcon className="size-4" />
              Add Purchase Bill
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Purchase register</h2>
                <p className="text-sm text-muted-foreground">
                  Search by supplier, internal bill number, or supplier invoice number.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Input
                  value={filters.query}
                  onChange={(event) => setFilterValue("query", event.target.value)}
                  placeholder="Search purchases..."
                  className="min-w-[15rem]"
                />
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilterValue("status", (value as PurchaseBillStatus | "all" | null) ?? "all")
                  }
                >
                  <SelectTrigger className="w-full min-w-[11rem]">
                    <SelectValue placeholder="Bill status" />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={8}>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="saved">Saved</SelectItem>
                    <SelectItem value="reconciled">Reconciled</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.gstr2bStatus}
                  onValueChange={(value) =>
                    setFilterValue("gstr2bStatus", (value as Gstr2bStatus | "all" | null) ?? "all")
                  }
                >
                  <SelectTrigger className="w-full min-w-[11rem]">
                    <SelectValue placeholder="GSTR-2B" />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={8}>
                    <SelectItem value="all">All GSTR-2B</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="unmatched">Unmatched</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="not_applicable">RCM / N.A.</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.paymentStatus}
                  onValueChange={(value) =>
                    setFilterValue("paymentStatus", (value as PaymentStatus | "all" | null) ?? "all")
                  }
                >
                  <SelectTrigger className="w-full min-w-[11rem]">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={8}>
                    <SelectItem value="all">All payment</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="app-scrollbar overflow-x-auto">
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bill</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Supplier invoice no.</TableHead>
                  <TableHead>Invoice date</TableHead>
                  <TableHead>Entry date</TableHead>
                  <TableHead className="text-right">Bill total</TableHead>
                  <TableHead>ITC</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>GSTR-2B</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{bill.billNumber}</p>
                        <p className="text-xs text-muted-foreground">{bill.purchaseType}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{bill.supplierName}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {bill.isUnregisteredSupplier ? "Unregistered supplier" : bill.supplierGstin}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{bill.supplierInvoiceNumber}</TableCell>
                    <TableCell>{formatDisplayDate(bill.invoiceDate)}</TableCell>
                    <TableCell>{formatDisplayDate(bill.billEntryDate)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(bill.totalAmount)}
                    </TableCell>
                    <TableCell><PurchaseItcBadge eligibility={bill.itcEligibility} /></TableCell>
                    <TableCell><PurchasePaymentBadge status={bill.paymentStatus} /></TableCell>
                    <TableCell><PurchaseGstrBadge status={bill.gstr2bStatus} /></TableCell>
                    <TableCell><PurchaseStatusBadge status={bill.status} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="aria-expanded:bg-muted"
                            />
                          }
                        >
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">Open purchase actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8} className="w-52">
                          <DropdownMenuItem onClick={() => router.push(`/purchases/view/${bill.id}`)}>
                            <EyeIcon className="text-muted-foreground" />
                            <span>View</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/purchases/edit/${bill.id}`)}>
                            <PencilLineIcon className="text-muted-foreground" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActionDialog({ type: "print", bill })}>
                            <PrinterIcon className="text-muted-foreground" />
                            <span>Print</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActionDialog({ type: "pdf", bill })}>
                            <FileDownIcon className="text-muted-foreground" />
                            <span>Download PDF</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActionDialog({ type: "email", bill })}>
                            <MailIcon className="text-muted-foreground" />
                            <span>Send Email</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              const duplicatedBill = duplicateBill(bill.id)
                              if (duplicatedBill) {
                                router.push(`/purchases/edit/${duplicatedBill.id}`)
                              }
                            }}
                          >
                            <CopyPlusIcon className="text-muted-foreground" />
                            <span>Duplicate bill</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActionDialog({ type: "gstr2b", bill })}>
                            <RefreshCcwIcon className="text-muted-foreground" />
                            <span>Update GSTR-2B status</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActionDialog({ type: "reconcile", bill })}>
                            <ReceiptTextIcon className="text-muted-foreground" />
                            <span>Mark as reconciled</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={bill.status !== "draft"}
                            onClick={() => bill.status === "draft" && setActionDialog({ type: "delete", bill })}
                          >
                            <Trash2Icon className="text-muted-foreground" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <PurchaseActionDialogs
        state={actionDialog}
        onClose={() => setActionDialog(null)}
        onDelete={(bill) => deleteBill(bill.id)}
        onUpdateGstr2bStatus={(bill, status) => updateGstr2bStatus(bill.id, status)}
        onMarkAsReconciled={(bill) => markAsReconciled(bill.id)}
      />
    </>
  )
}
