import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  IndianRupee,
  LockKeyhole,
  PackageCheck,
  ReceiptIndianRupee,
  Store,
  Tags,
  Users,
  WalletCards,
  Warehouse,
  type LucideIcon,
} from "lucide-react"

import { MegaNav } from "@/components/landing/mega-nav"
import { CustomerCoverage } from "@/components/landing/customer-coverage"
import { MegaFooter } from "@/components/landing/mega-footer"
import { Reveal } from "@/components/landing/reveal"
import { GradientWaveText } from "@/components/gradient-wave-text"
import Rays from "@/components/light-rays"
import { TextMarquee } from "@/components/text-marquee"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const webAppUrl =
  process.env.NEXT_PUBLIC_WEB_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000"
const registerHref = `${webAppUrl}/auth/register`

type Feature = {
  title: string
  description: string
  icon: LucideIcon
}

const features: Feature[] = [
  {
    title: "Sales bills, returns, and credit notes",
    description:
      "Create GST sales bills from one workspace, with CGST, SGST, and IGST visible on every line.",
    icon: ReceiptIndianRupee,
  },
  {
    title: "Product master with GST built in",
    description:
      "Maintain SKU, HSN/SAC, GST rate, unit, barcode, category, brand, image, and final price details.",
    icon: Tags,
  },
  {
    title: "Stock control by warehouse",
    description:
      "Track opening balances, item ledger movement, low stock, adjustments, and warehouse transfers.",
    icon: Warehouse,
  },
  {
    title: "Purchase bills and ITC tracking",
    description:
      "Record supplier bills, ITC eligibility, payment status, and GSTR-2B reconciliation context.",
    icon: PackageCheck,
  },
  {
    title: "Money in and money out",
    description:
      "Track receipts, payments, allocations, unallocated amounts, and overdue customer balances.",
    icon: WalletCards,
  },
  {
    title: "GST-ready business records",
    description:
      "Keep tax splits, HSN summaries, e-invoice context, e-way bill context, and reports ready when filing time comes.",
    icon: ClipboardCheck,
  },
]

const workflow = [
  {
    title: "Set up products once",
    description:
      "Add goods and services with SKU, HSN/SAC, GST rate, unit, price, barcode, category, brand, and stock rules.",
  },
  {
    title: "Run daily billing",
    description:
      "Create sales bills, returns, credit notes, purchase bills, receipts, and payments while stock and party balances stay connected.",
  },
  {
    title: "Use GST records when needed",
    description:
      "When it is time to file, use clean GST summaries and review checks from the same billing and purchase data.",
  },
]

const heroMarqueeItems = [
  "Sales billing",
  "Product master",
  "Inventory",
  "Purchases",
  "Money workspace",
  "GST reports",
  "POS",
  "E-way bill",
]

const pricing = [
  {
    name: "Micro",
    price: "₹299",
    audience: "Freelancers and solo traders",
    features: ["Sales billing", "Parties and dues", "GST-ready reports"],
  },
  {
    name: "Small Business",
    price: "₹699",
    audience: "Retailers and growing SMBs",
    features: ["Product master", "Inventory", "Purchases", "Money workspace"],
  },
  {
    name: "Business+",
    price: "₹1,499",
    audience: "Multi-branch businesses",
    features: ["POS", "Multi-GSTIN", "Advanced reports"],
  },
  {
    name: "CA Partner",
    price: "₹2,999",
    audience: "CAs managing up to 15 clients",
    features: ["CA dashboard", "Client onboarding", "Review workflow"],
  },
  {
    name: "CA Pro",
    price: "₹5,999",
    audience: "CAs managing up to 50 clients",
    features: ["More clients", "Priority support", "Team workflows"],
  },
]

const paths: Feature[] = [
  {
    title: "Business owner workspace",
    description:
      "Shop owners, traders, and service businesses can bill, manage products, track stock, collect dues, and keep GST records current.",
    icon: Store,
  },
  {
    title: "CA-managed workspace",
    description:
      "Chartered Accountants can work from the same sales, purchase, product, and GST data without rebuilding client records.",
    icon: Users,
  },
]

const trustItems: Feature[] = [
  {
    title: "Product tax profiles",
    description: "HSN/SAC, GST rate, unit, and price live with the item.",
    icon: Tags,
  },
  {
    title: "Stock-aware billing",
    description: "Sales, purchases, and transfers can update stock context.",
    icon: Boxes,
  },
  {
    title: "Indian money format",
    description: "Amounts use Indian number grouping across records.",
    icon: IndianRupee,
  },
  {
    title: "Role-ready access",
    description: "Owner, staff, accountant, and CA access patterns are planned.",
    icon: LockKeyhole,
  },
]

const comparisonProducts = [
  {
    name: "GSTFY",
    plan: "Micro",
    price: "₹299/month",
    note: "Billing-first plan for sales bills, parties, dues, and GST-ready reports.",
    sourceHref: "#pricing",
    sourceLabel: "GSTFY pricing",
    highlighted: true,
  },
  {
    name: "TallyPrime",
    plan: "Silver",
    price: "₹750/month + GST",
    note: "Also lists ₹22,500 lifetime + 18% GST for single-user Silver.",
    sourceHref: "https://tallysolutions.com/buy-tally/",
    sourceLabel: "Tally pricing",
    highlighted: false,
  },
  {
    name: "Zoho Books",
    plan: "Standard",
    price: "₹899/month",
    note: "Also lists ₹749/org/month when billed annually; taxes extra.",
    sourceHref: "https://www.zoho.com/in/books/pricing/",
    sourceLabel: "Zoho pricing",
    highlighted: false,
  },
]

const comparisonRows = [
  {
    feature: "Best fit",
    gstfy: "Daily billing, product, stock, money, and GST records for Indian small businesses",
    tally: "Deep accounting, inventory, statutory compliance, and reporting for SMBs",
    zoho: "Cloud accounting with GST, banking, inventory, reports, and operations workflows",
  },
  {
    feature: "Entry paid price",
    gstfy: "₹299/month",
    tally: "₹750/month + 18% GST",
    zoho: "₹899/month, or ₹749/month billed annually",
  },
  {
    feature: "Billing workflow",
    gstfy: "Sales bills, sales returns, credit notes, customer dues, and GST tax split stay in one workspace",
    tally: "Strong billing and accounting voucher workflows with broader configuration depth",
    zoho: "Invoices, quotes, sales orders, payment reminders, and customer portal workflows",
  },
  {
    feature: "Product master",
    gstfy: "Designed around SKU, HSN/SAC, GST rate, unit, barcode, category, brand, image, and final price",
    tally: "Stock items and GST details can be configured through masters and reports",
    zoho: "Items support GST/tax setup and inventory tracking within Zoho Books plans",
  },
  {
    feature: "Inventory and stock",
    gstfy: "Warehouse stock, item ledger, opening balances, adjustments, low stock, and transfers",
    tally: "Mature inventory reports, godowns, stock movements, batches, and manufacturing workflows",
    zoho: "Inventory in Standard; advanced inventory, warehouses, batches, and composite items in higher plans",
  },
  {
    feature: "Purchases and ITC",
    gstfy: "Supplier bills, payment tracking, ITC eligibility, and GSTR-2B reconciliation status",
    tally: "Purchase registers, GST reports, ITC summaries, and reconciliation workflows",
    zoho: "Bills, expenses, purchase orders, GST reports, and GSTR reconciliation workflows",
  },
  {
    feature: "Payments and dues",
    gstfy: "Money in/out, allocations, unallocated balances, customer dues, and supplier payments",
    tally: "Receivables, payables, ageing, banking, and cash/bank reports",
    zoho: "Online payments, reminders, banking, reconciliation, and receivables reports",
  },
  {
    feature: "GST workflow",
    gstfy: "GST-ready reports and review checks generated from billing, product, purchase, and payment records",
    tally: "GST returns, e-invoice, e-way bill, reconciliation, and direct upload/filing workflows",
    zoho: "GST reports and filing workflows, including online filing setup and approval options",
  },
]

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">
        {eyebrow}
      </Badge>
      <h2 className="mt-4 text-3xl font-semibold leading-tight text-neutral-950 md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-6 text-neutral-600 md:text-base">
        {description}
      </p>
    </div>
  )
}

function ProductPreview() {
  const previewNav = ["Sales", "Products", "Inventory", "Purchases", "Money"]
  const billLines = [
    ["LED bulbs 12W", "HSN 8539", "18%", "24 in stock"],
    ["Copper wire coil", "HSN 8544", "18%", "8 in stock"],
    ["Delivery charge", "SAC 9965", "18%", "Service"],
  ]
  const checks = [
    {
      title: "Product tax profile",
      status: "HSN and GST rates applied",
      icon: BadgeCheck,
      tone: "teal",
    },
    {
      title: "Stock impact",
      status: "2 goods items will reduce stock",
      icon: Warehouse,
      tone: "teal",
    },
    {
      title: "Customer due",
      status: "Payment reminder ready",
      icon: CircleAlert,
      tone: "amber",
    },
  ]

  return (
    <div
      aria-label="GSTFY billing and inventory product preview"
      className="mx-auto mt-10 w-full max-w-6xl overflow-hidden rounded-md border border-neutral-200 bg-white shadow-2xl shadow-neutral-950/10"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-neutral-950 text-[0.65rem] font-semibold text-white">
            GF
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-950">
              Sales bill workspace
            </p>
            <p className="text-[0.68rem] text-neutral-500">
              INV-2026-0042 - 25 Aug 2026
            </p>
          </div>
        </div>
        <Badge className="bg-teal-700 text-white">Stock and GST ready</Badge>
      </div>

      <div className="grid gap-0 md:grid-cols-[250px_1fr]">
        <aside className="hidden border-r border-neutral-200 bg-neutral-50/70 p-4 md:block">
          {previewNav.map((item, index) => (
            <div
              key={item}
              className={`mb-2 rounded-md px-3 py-2 text-xs ${
                index === 0 ? "bg-neutral-950 text-white" : "text-neutral-600"
              }`}
            >
              {item}
            </div>
          ))}
        </aside>

        <div className="p-4 md:p-6">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Sales this month", "₹8,42,000"],
              ["Customer due", "₹1,26,480"],
              ["Stock value", "₹3,74,220"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-neutral-200 bg-white p-4"
              >
                <p className="text-[0.68rem] text-neutral-500">{label}</p>
                <p className="mt-2 font-mono text-lg font-semibold text-neutral-950">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <p className="text-xs font-medium text-neutral-950">
                  Bill items
                </p>
                <Badge variant="outline" className="border-neutral-200">
                  3 lines
                </Badge>
              </div>
              <div className="divide-y divide-neutral-200">
                {billLines.map(([name, code, gst, stock]) => (
                  <div
                    key={name}
                    className="grid gap-3 px-4 py-3 text-xs sm:grid-cols-[1fr_90px_60px_90px]"
                  >
                    <span className="font-medium text-neutral-950">{name}</span>
                    <span className="font-mono text-neutral-500">{code}</span>
                    <span className="font-mono text-neutral-700">{gst}</span>
                    <span className="text-neutral-500">{stock}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 border-t border-neutral-200 bg-neutral-50 p-4 md:grid-cols-3">
                {checks.map((item) => {
                  const Icon = item.icon

                  return (
                    <div
                      key={item.title}
                      className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3"
                    >
                      <div
                        className={`flex size-8 items-center justify-center rounded-md ${
                          item.tone === "amber"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-teal-50 text-teal-700"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-950">
                          {item.title}
                        </p>
                        <p className="text-[0.68rem] text-neutral-500">
                          {item.status}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-950 p-4 text-white">
              <p className="text-xs font-medium">Bill total</p>
              <p className="mt-3 font-mono text-3xl font-semibold">₹12,460</p>
              <div className="mt-5 space-y-3">
                {[
                  ["Taxable value", "₹10,559", "w-[72%]", "bg-white"],
                  ["CGST", "₹950.50", "w-[34%]", "bg-teal-400"],
                  ["SGST", "₹950.50", "w-[34%]", "bg-teal-400"],
                  ["Due after receipt", "₹7,460", "w-[58%]", "bg-amber-300"],
                ].map(([label, amount, width, color]) => (
                  <div key={label}>
                    <div className="flex justify-between text-[0.68rem] text-neutral-300">
                      <span>{label}</span>
                      <span>{amount}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${width} ${color}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="border-y border-neutral-200 bg-neutral-50 px-4 py-20 sm:px-6 lg:px-8"
    >
      <Reveal>
        <SectionHeading
          eyebrow="Compare"
          title="GSTFY vs TallyPrime vs Zoho Books"
          description="A practical comparison for Indian businesses choosing billing, product, inventory, payments, and GST software."
        />
      </Reveal>

      <div className="mx-auto mt-10 grid max-w-7xl gap-4 lg:grid-cols-3">
        {comparisonProducts.map((product, index) => (
          <Reveal key={product.name} delay={index * 0.04}>
            <Card
              className={`h-full rounded-md shadow-none ${
                product.highlighted
                  ? "border-teal-300 bg-teal-50/60"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>{product.plan}</CardDescription>
                  </div>
                  {product.highlighted ? (
                    <Badge className="bg-teal-700 text-white">
                      Billing-first
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold text-neutral-950">
                  {product.price}
                </p>
                <p className="mt-3 text-xs leading-5 text-neutral-600">
                  {product.note}
                </p>
                <a
                  href={product.sourceHref}
                  target={product.sourceHref.startsWith("http") ? "_blank" : undefined}
                  rel={
                    product.sourceHref.startsWith("http")
                      ? "noreferrer noopener"
                      : undefined
                  }
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-neutral-950"
                >
                  {product.sourceLabel}
                  {product.sourceHref.startsWith("http") ? (
                    <ExternalLink className="size-3" />
                  ) : null}
                </a>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.12}>
        <div className="mx-auto mt-6 max-w-7xl overflow-hidden rounded-md border border-neutral-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] text-left text-xs">
              <thead className="bg-neutral-950 text-white">
                <tr>
                  <th className="w-[190px] px-4 py-4 font-medium">Feature</th>
                  <th className="px-4 py-4 font-medium">GSTFY</th>
                  <th className="px-4 py-4 font-medium">TallyPrime</th>
                  <th className="px-4 py-4 font-medium">Zoho Books</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-t border-neutral-200">
                    <th className="bg-neutral-50 px-4 py-4 align-top font-medium text-neutral-950">
                      {row.feature}
                    </th>
                    <td className="px-4 py-4 align-top leading-5 text-neutral-700">
                      {row.gstfy}
                    </td>
                    <td className="px-4 py-4 align-top leading-5 text-neutral-700">
                      {row.tally}
                    </td>
                    <td className="px-4 py-4 align-top leading-5 text-neutral-700">
                      {row.zoho}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <p className="mx-auto mt-4 max-w-7xl text-xs leading-5 text-neutral-500">
        Competitor pricing checked on 25 Aug 2026 from official India pricing
        pages. Vendor taxes, discounts, billing periods, and plan rules can
        change; verify the linked source before purchase.
      </p>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <MegaNav registerHref={registerHref} />

      <section className="gstfy-product-grid relative isolate overflow-hidden border-b border-neutral-200 bg-white">
        <Rays
          className="pointer-events-none opacity-45"
          backgroundColor="transparent"
          intensity={9}
          rays={26}
          reach={20}
          position={12}
          radius="0px"
          animation={{ animate: true, speed: 1.8 }}
          raysColor={{ mode: "multi", color1: "#14b8a6", color2: "#f59e0b" }}
          style={{ zIndex: 0 }}
        />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.12),transparent_34%),linear-gradient(to_bottom,rgba(255,255,255,0.7),rgba(250,250,250,0.96)_64%,white)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 md:pb-20 md:pt-20 lg:px-8">
          <Reveal className="mx-auto max-w-4xl text-center">
            <div className="mx-auto flex w-fit items-center rounded-full border border-neutral-200 bg-white/85 px-2 py-1 text-xs text-neutral-600 shadow-sm shadow-neutral-950/5 backdrop-blur">
              <TextMarquee
                height={40}
                speed={1.05}
                prefix={
                  <span className="mr-2 rounded-full bg-teal-700 px-3 py-1.5 text-xs font-medium text-white">
                    GSTFY
                  </span>
                }
                className="items-center"
              >
                {heroMarqueeItems.map((item) => (
                  <span
                    key={item}
                    className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-800 ring-1 ring-neutral-200"
                  >
                    {item}
                  </span>
                ))}
              </TextMarquee>
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-tight text-neutral-950 md:text-6xl">
              Billing, products, stock, and payments
              <span className="sr-only"> in one GST-ready workspace</span>
            </h1>
            <div
              aria-hidden="true"
              className="mx-auto mt-1 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl"
            >
              <GradientWaveText
                align="center"
                speed={0.7}
                repeat
                bandGap={5}
                bandCount={7}
                bottomOffset={12}
                customColors={["#0f766e", "#14b8a6", "#f59e0b", "#111827"]}
              >
                in one GST-ready workspace
              </GradientWaveText>
            </div>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-600 md:text-lg">
              GSTFY helps shop owners, traders, service businesses, and small
              manufacturers create sales bills, manage product masters, track
              purchases and stock, collect dues, and keep GST records ready from
              day-to-day work.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                render={<a href={registerHref} />}
                nativeButton={false}
                size="lg"
                className="h-11 w-full px-5 text-sm sm:w-auto"
              >
                Start billing
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
              <Button
                render={<a href="#comparison" />}
                nativeButton={false}
                variant="outline"
                size="lg"
                className="h-11 w-full px-5 text-sm sm:w-auto"
              >
                Compare options
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <ProductPreview />
          </Reveal>
        </div>
      </section>

      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            ["Billing first", "Sales bills, returns, credits, and dues"],
            ["Products stay tax-ready", "HSN/SAC, GST rate, price, barcode"],
            [
              "Stock and money connected",
              "Purchases, inventory, receipts, payments",
            ],
          ].map(([title, description]) => (
            <div key={title} className="flex items-start gap-3">
              <Check className="mt-0.5 size-4 shrink-0 text-teal-700" />
              <div>
                <p className="text-sm font-medium text-neutral-950">{title}</p>
                <p className="mt-1 text-xs text-neutral-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="customers" className="px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Customers"
            title="Built for India"
            description="A focused GST billing workspace for shops, traders, services, manufacturers, and CA-managed clients."
          />
        </Reveal>
        <Reveal delay={0.12}>
          <div className="mx-auto mt-10 max-w-7xl">
            <CustomerCoverage />
          </div>
        </Reveal>
      </section>

      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Billing system"
            title="Everything around the bill, not just the return"
            description="GSTFY starts with the daily work: products, sales, purchases, stock, collections, payments, and the GST records created from them."
          />
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon

            return (
              <Reveal key={feature.title} delay={index * 0.04}>
                <Card className="h-full rounded-md border-neutral-200 shadow-none">
                  <CardHeader>
                    <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                      <Icon className="size-4" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section
        id="workflow"
        className="bg-neutral-950 px-4 py-20 text-white sm:px-6 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <Badge variant="outline" className="border-white/20 text-white">
              Product workflow
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
              Build the system around daily business, then GST becomes cleaner
            </h2>
            <p className="mt-4 text-sm leading-6 text-neutral-300 md:text-base">
              The product is not only a filing checklist. It is the operating
              layer where products, bills, stock, purchases, money movement, and
              tax records are created in the same flow.
            </p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.06}>
                <div className="h-full rounded-md border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex size-8 items-center justify-center rounded-md bg-white text-sm font-semibold text-neutral-950">
                    {index + 1}
                  </div>
                  <p className="mt-5 text-sm font-medium leading-6">
                    {step.title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-300">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="paths" className="px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Two paths"
            title="Works for owner-run and CA-managed businesses"
            description="A business can run billing itself and still invite a CA later. The sales, products, purchases, payments, stock, and GST records stay intact."
          />
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
          {paths.map((path) => {
            const Icon = path.icon

            return (
              <Reveal key={path.title}>
                <Card className="h-full rounded-md border-neutral-200 shadow-none">
                  <CardHeader>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-neutral-950 text-white">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-base">{path.title}</CardTitle>
                    <CardDescription>{path.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-4">
          {trustItems.map((item) => {
            const Icon = item.icon

            return (
              <Reveal key={item.title}>
                <div className="rounded-md border border-neutral-200 bg-white p-5">
                  <Icon className="size-5 text-teal-700" />
                  <p className="mt-4 text-sm font-medium text-neutral-950">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Start with billing, then unlock operations as you grow"
            description="The entry plan keeps sales billing and GST records simple. Growing businesses can add product master, inventory, purchases, POS, and CA workflows by tier."
          />
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
          {pricing.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.04}>
              <Card
                className={`h-full rounded-md border-neutral-200 shadow-none ${
                  plan.name === "Micro" ? "border-teal-300 bg-teal-50/40" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {plan.name === "Micro" ? (
                      <Badge className="bg-teal-700 text-white">Starter</Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>{plan.audience}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-semibold text-neutral-950">
                    {plan.price}
                    <span className="ml-1 font-sans text-xs font-normal text-neutral-500">
                      /month
                    </span>
                  </p>
                  <ul className="mt-5 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-xs text-neutral-600"
                      >
                        <Check className="size-3.5 shrink-0 text-teal-700" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <ComparisonSection />

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto flex max-w-5xl flex-col items-center rounded-md border border-neutral-200 bg-neutral-950 px-6 py-12 text-center text-white">
            <Badge variant="outline" className="border-white/20 text-white">
              Ready for daily billing
            </Badge>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">
              Start with the bill. Keep products, stock, money, and GST in sync.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-300">
              GSTFY gives Indian small businesses one clean workspace for sales,
              products, purchases, inventory, payments, and GST-ready records.
            </p>
            <Button
              render={<a href={registerHref} />}
              nativeButton={false}
              size="lg"
              className="mt-8 h-11 bg-white px-5 text-sm text-neutral-950 hover:bg-neutral-200"
            >
              Start billing
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        </Reveal>
      </section>

      <MegaFooter registerHref={registerHref} />
    </main>
  )
}
