export type OverviewTotal = {
  id:
    | "sales"
    | "purchase"
    | "income"
    | "expenses"
    | "customers"
    | "suppliers"
    | "salesReturns"
    | "purchaseReturns"
  label: string
  value: number
  kind: "currency" | "count"
  note: string
}

export type RevenueStatisticPoint = {
  month: string
  sales: number
  purchases: number
  income: number
}

export type OverallReportSlice = {
  label: string
  value: number
  fill: string
}

export type LowStockItem = {
  hsnCode: string
  productName: string
  currentStock: number
}

export type RecentLedgerRow = {
  id: string
  date: string
  invoiceNumber: string
  party: string
  total: number
  paid: number
  due: number
}

export type OverviewDashboardData = {
  business: {
    name: string
    gstin: string
  }
  intro: {
    title: string
    description: string
  }
  totals: OverviewTotal[]
  revenueStatistics: RevenueStatisticPoint[]
  overallReports: OverallReportSlice[]
  lowStockItems: LowStockItem[]
  recentSales: RecentLedgerRow[]
  recentPurchases: RecentLedgerRow[]
}

export const overviewDashboardData: OverviewDashboardData = {
  business: {
    name: "Vicky Pvt Ltd",
    gstin: "33AFSPB9500E1ZY",
  },
  intro: {
    title: "Overview Dashboard",
    description:
      "Monitor sales, purchases, income, stock pressure, and recent activity from one business summary.",
  },
  totals: [
    {
      id: "sales",
      label: "Total Sales",
      value: 1824500,
      kind: "currency",
      note: "Across all channels this month",
    },
    {
      id: "purchase",
      label: "Total Purchase",
      value: 1178200,
      kind: "currency",
      note: "Supplier bills booked this month",
    },
    {
      id: "income",
      label: "Total Income",
      value: 428400,
      kind: "currency",
      note: "Net income after purchase and expense impact",
    },
    {
      id: "expenses",
      label: "Total Expenses",
      value: 217900,
      kind: "currency",
      note: "Operating expenses and business spend",
    },
    {
      id: "customers",
      label: "Total Customers",
      value: 146,
      kind: "count",
      note: "Active customers in current books",
    },
    {
      id: "suppliers",
      label: "Total Suppliers",
      value: 38,
      kind: "count",
      note: "Suppliers with recent transactions",
    },
    {
      id: "salesReturns",
      label: "Sales Return",
      value: 28600,
      kind: "currency",
      note: "Returned outward supplies this month",
    },
    {
      id: "purchaseReturns",
      label: "Purchase Returns",
      value: 19400,
      kind: "currency",
      note: "Returned inward supplies this month",
    },
  ],
  revenueStatistics: [
    { month: "Jan", sales: 312000, purchases: 214000, income: 64200 },
    { month: "Feb", sales: 346000, purchases: 227000, income: 78400 },
    { month: "Mar", sales: 389000, purchases: 244000, income: 96200 },
    { month: "Apr", sales: 421000, purchases: 262000, income: 108700 },
    { month: "May", sales: 458000, purchases: 281000, income: 122400 },
    { month: "Jun", sales: 447000, purchases: 274000, income: 118600 },
    { month: "Jul", sales: 486000, purchases: 298000, income: 133900 },
    { month: "Aug", sales: 509000, purchases: 312000, income: 142500 },
    { month: "Sep", sales: 497000, purchases: 308000, income: 137800 },
    { month: "Oct", sales: 548000, purchases: 329000, income: 156400 },
    { month: "Nov", sales: 581000, purchases: 341000, income: 171300 },
    { month: "Dec", sales: 612000, purchases: 356000, income: 184600 },
  ],
  overallReports: [
    { label: "Sales", value: 1824500, fill: "var(--chart-1)" },
    { label: "Purchase", value: 1178200, fill: "var(--chart-2)" },
    { label: "Expenses", value: 217900, fill: "var(--chart-4)" },
  ],
  lowStockItems: [
    { hsnCode: "210690", productName: "Protein Mix 500g", currentStock: 8 },
    { hsnCode: "190531", productName: "Butter Cookies Box", currentStock: 11 },
    { hsnCode: "330499", productName: "Herbal Face Wash", currentStock: 9 },
    { hsnCode: "392410", productName: "Kitchen Storage Jar", currentStock: 6 },
    { hsnCode: "950300", productName: "Learning Blocks Set", currentStock: 7 },
    { hsnCode: "481920", productName: "Printed Gift Box", currentStock: 10 },
    { hsnCode: "220299", productName: "Energy Drink Can", currentStock: 5 },
    { hsnCode: "090240", productName: "Premium Tea Pack", currentStock: 12 },
    { hsnCode: "340111", productName: "Bath Soap Combo", currentStock: 9 },
    { hsnCode: "821599", productName: "Steel Cutlery Set", currentStock: 4 },
  ],
  recentSales: [
    {
      id: "sale-1",
      date: "11 May 2026",
      invoiceNumber: "INV-2026-0182",
      party: "Sri Lakshmi Traders",
      total: 28500,
      paid: 18500,
      due: 10000,
    },
    {
      id: "sale-2",
      date: "10 May 2026",
      invoiceNumber: "INV-2026-0181",
      party: "Urban Fresh Retail",
      total: 41200,
      paid: 41200,
      due: 0,
    },
    {
      id: "sale-3",
      date: "10 May 2026",
      invoiceNumber: "INV-2026-0180",
      party: "Madurai Wholesale Mart",
      total: 36200,
      paid: 24000,
      due: 12200,
    },
    {
      id: "sale-4",
      date: "09 May 2026",
      invoiceNumber: "INV-2026-0179",
      party: "Vetri Stores",
      total: 19400,
      paid: 9400,
      due: 10000,
    },
    {
      id: "sale-5",
      date: "08 May 2026",
      invoiceNumber: "INV-2026-0178",
      party: "Kaveri Foods",
      total: 22800,
      paid: 22800,
      due: 0,
    },
  ],
  recentPurchases: [
    {
      id: "purchase-1",
      date: "11 May 2026",
      invoiceNumber: "PUR-2026-0087",
      party: "Arun Packaging Co",
      total: 26400,
      paid: 12000,
      due: 14400,
    },
    {
      id: "purchase-2",
      date: "10 May 2026",
      invoiceNumber: "PUR-2026-0086",
      party: "Om Traders",
      total: 38100,
      paid: 38100,
      due: 0,
    },
    {
      id: "purchase-3",
      date: "09 May 2026",
      invoiceNumber: "PUR-2026-0085",
      party: "South Coast Supplies",
      total: 19500,
      paid: 9500,
      due: 10000,
    },
    {
      id: "purchase-4",
      date: "09 May 2026",
      invoiceNumber: "PUR-2026-0084",
      party: "Elite Wholesale Hub",
      total: 44200,
      paid: 22000,
      due: 22200,
    },
    {
      id: "purchase-5",
      date: "08 May 2026",
      invoiceNumber: "PUR-2026-0083",
      party: "Nila Distributors",
      total: 17300,
      paid: 17300,
      due: 0,
    },
  ],
}
