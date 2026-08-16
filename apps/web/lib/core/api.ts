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

export function getVouchers(accessToken: string, limit = 50) {
  return apiRequest<{ vouchers: VoucherListItem[] }>(`/core/vouchers?limit=${limit}`, {
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
