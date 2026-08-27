import { apiRequest } from "@/lib/api/client"

export type DashboardPeriod = {
  from: string
  to: string
  label: string
}

export type RevenueStatisticPoint = {
  month: string
  monthKey: string
  sales: number
  purchases: number
  receipts: number
  payments: number
  income: number
}

export type OverallReportSlice = {
  label: string
  value: number
  fill: string
}

export type DashboardLowStockItem = {
  itemId: string
  name: string
  sku: string
  hsnCode: string
  quantityOnHand: string
  reorderLevel: string
  inventoryValue: number
}

export type DashboardRecentDocument = {
  id: string
  date: string
  documentNumber: string
  party: string
  total: number
  paid: number
  due: number
  status: string
}

export type BusinessDashboardOverview = {
  business: {
    id: string
    name: string
    legalName: string
    gstin: string | null
    stateCode: string | null
  }
  period: DashboardPeriod
  summary: {
    sales: number
    purchases: number
    netProfit: number
    expenses: number
    outputGst: number
    inputGst: number
    estimatedTaxPayable: number
    receivables: number
    payables: number
    salesReturns: number
    purchaseReturns: number
    inventoryValue: number
    skuCount: number
    negativeStockCount: number
    lowStockCount: number
    customers: number
    suppliers: number
  }
  trend: RevenueStatisticPoint[]
  mix: OverallReportSlice[]
  lowStockItems: DashboardLowStockItem[]
  recentSales: DashboardRecentDocument[]
  recentPurchases: DashboardRecentDocument[]
  filingReadiness: {
    runId: string | null
    period: string | null
    status: string
    generatedAt: string | null
    openExceptions: number
    blockingExceptions: number
    nextAction: string
  }
}

export type CaDashboardClientReadiness = {
  client: {
    id: string
    businessId: string
    businessName: string
    tradeName: string
    gstin: string | null
    accessScope: string
    status: "active"
    acceptedAt: string
  }
  period: string
  readinessStatus: "ready" | "review" | "blocked" | "missing-gstin" | "no-data"
  latestReport: {
    id: string | null
    period: string | null
    status: string | null
  }
  salesAmount: number
  purchaseAmount: number
  estimatedTaxPayable: number
  openExceptions: number
  blockingExceptions: number
}

export type CaDashboardOverview = {
  practice: {
    id: string
    name: string
    contactEmail: string | null
    contactPhone: string | null
    status: string
  }
  period: DashboardPeriod
  summary: {
    clientsTotal: number
    activeClientsTotal: number
    pendingInvitesTotal: number
    acceptedInvitesTotal: number
    readyClientsTotal: number
    needsActionTotal: number
    returnsDueTotal: number
    totalSales: number
    totalPurchases: number
    estimatedTaxPayable: number
  }
  deadlines: {
    gstr1: string
    gstr3b: string
  }
  clientReadiness: CaDashboardClientReadiness[]
}

export type DashboardRangeQuery = {
  from?: string
  to?: string
}

export function getBusinessDashboard(
  accessToken: string,
  query: DashboardRangeQuery = {}
) {
  return apiRequest<BusinessDashboardOverview>(
    `/dashboard/overview${toQueryString(query)}`,
    {
      method: "GET",
      accessToken,
    }
  )
}

export function getCaDashboardOverview(
  accessToken: string,
  query: DashboardRangeQuery = {}
) {
  return apiRequest<CaDashboardOverview>(`/ca/dashboard${toQueryString(query)}`, {
    method: "GET",
    accessToken,
  })
}

function toQueryString(query: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }

  return params.size ? `?${params.toString()}` : ""
}
