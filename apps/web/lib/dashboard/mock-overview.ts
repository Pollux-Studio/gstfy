export type OverviewMetric = {
  label: string
  value: number
  note: string
  trend: string
}

export type SalesPoint = {
  month: string
  sales: number
}

export type TopCustomer = {
  name: string
  revenue: number
  invoiceCount: number
}

export type RecentTransaction = {
  id: string
  type: "Sale" | "Payment" | "Refund"
  party: string
  amount: number
  date: string
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
  executiveSummary: {
    heading: string
    note: string
    collections: {
      label: string
      value: number
      trend: string
    }
    paidRatio: {
      label: string
      value: string
      note: string
    }
    filingSummary: {
      label: string
      value: string
      note: string
    }
    salesChannels: {
      label: string
      items: {
        name: string
        share: number
      }[]
    }
  }
  gstOwed: OverviewMetric
  filingDeadline: {
    dueDate: string
    daysRemaining: number
    note: string
  }
  outstandingInvoices: {
    count: number
    amount: number
    note: string
  }
  monthlySales: SalesPoint[]
  shopify: {
    connected: boolean
    note: string
  }
  topCustomers: TopCustomer[]
  recentTransactions: RecentTransaction[]
}

export const overviewDashboardData: OverviewDashboardData = {
  business: {
    name: "Vicky Pvt Ltd",
    gstin: "33AFSPB9500E1ZY",
  },
  intro: {
    title: "Overview Dashboard",
    description:
      "Track sales, taxes, filing deadlines, and business activity from one clear home screen.",
  },
  executiveSummary: {
    heading: "Your business snapshot is healthy and filing-ready.",
    note:
      "Collections are steady, filing is on track, and digital channels are contributing consistently this month.",
    collections: {
      label: "Net collections",
      value: 396800,
      trend: "+12.4% vs last month",
    },
    paidRatio: {
      label: "Invoice paid ratio",
      value: "78%",
      note: "42 of 54 invoices settled this month",
    },
    filingSummary: {
      label: "Upcoming filings",
      value: "2 due this month",
      note: "GSTR-1 on 11 May, GSTR-3B on 20 May",
    },
    salesChannels: {
      label: "Sales channel split",
      items: [
        { name: "Retail", share: 46 },
        { name: "Wholesale", share: 34 },
        { name: "Online", share: 20 },
      ],
    },
  },
  gstOwed: {
    label: "GST owed this month",
    value: 84250,
    note: "After available input tax credit",
    trend: "+8.2% vs last month",
  },
  filingDeadline: {
    dueDate: "20 May 2026",
    daysRemaining: 10,
    note: "GSTR-3B filing window is open",
  },
  outstandingInvoices: {
    count: 14,
    amount: 218900,
    note: "5 invoices are overdue by more than 7 days",
  },
  monthlySales: [
    { month: "Jan", sales: 315000 },
    { month: "Feb", sales: 352000 },
    { month: "Mar", sales: 401500 },
    { month: "Apr", sales: 438000 },
    { month: "May", sales: 462500 },
    { month: "Jun", sales: 429000 },
    { month: "Jul", sales: 488500 },
    { month: "Aug", sales: 521000 },
    { month: "Sep", sales: 498000 },
    { month: "Oct", sales: 556500 },
    { month: "Nov", sales: 604000 },
    { month: "Dec", sales: 648500 },
  ],
  shopify: {
    connected: false,
    note: "Connect Shopify to compare marketplace sales with your GST books.",
  },
  topCustomers: [
    { name: "Sri Lakshmi Traders", revenue: 182500, invoiceCount: 8 },
    { name: "Madurai Wholesale Mart", revenue: 146200, invoiceCount: 5 },
    { name: "Urban Fresh Retail", revenue: 121800, invoiceCount: 4 },
    { name: "Kaveri Foods", revenue: 98750, invoiceCount: 3 },
  ],
  recentTransactions: [
    {
      id: "txn-1",
      type: "Sale",
      party: "Sri Lakshmi Traders",
      amount: 28500,
      date: "10 May 2026",
    },
    {
      id: "txn-2",
      type: "Payment",
      party: "Urban Fresh Retail",
      amount: 18500,
      date: "09 May 2026",
    },
    {
      id: "txn-3",
      type: "Sale",
      party: "Madurai Wholesale Mart",
      amount: 43200,
      date: "09 May 2026",
    },
    {
      id: "txn-4",
      type: "Refund",
      party: "Kaveri Foods",
      amount: 4200,
      date: "08 May 2026",
    },
    {
      id: "txn-5",
      type: "Payment",
      party: "Vetri Stores",
      amount: 22000,
      date: "08 May 2026",
    },
  ],
}
