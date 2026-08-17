import { apiRequest } from "@/lib/api/client"

export type VoucherType =
  | "SALES"
  | "PURCHASE"
  | "RECEIPT"
  | "PAYMENT"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "EXPENSE"
  | "JOURNAL"
  | "STOCK_TRANSFER"
  | "STOCK_ADJUSTMENT"

export type VoucherListItem = {
  id: string
  voucherType: VoucherType
  voucherNumber: string
  voucherDate: string
  status: string
  gstRegistrationId: string | null
  branchId: string | null
  warehouseId: string | null
  financialYearId: string
  postedAt: string | null
  createdAt: string
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export function getVouchers(
  accessToken: string,
  filters: { page?: number; limit?: number } = {}
) {
  const params = new URLSearchParams()

  if (filters.page) {
    params.set("page", String(filters.page))
  }

  if (filters.limit) {
    params.set("limit", String(filters.limit))
  }

  const query = params.size ? `?${params.toString()}` : ""

  return apiRequest<{ vouchers: VoucherListItem[]; pagination: PaginationMeta }>(`/core/vouchers${query}`, {
    method: "GET",
    accessToken,
  })
}

export function getVoucher(voucherId: string, accessToken: string) {
  return apiRequest<unknown>(`/core/vouchers/${voucherId}`, {
    method: "GET",
    accessToken,
  })
}
