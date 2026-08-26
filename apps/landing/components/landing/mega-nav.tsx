"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRight,
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Menu,
  PackageCheck,
  ReceiptIndianRupee,
  ShieldCheck,
  Store,
  Tags,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MegaNavItem = {
  title: string
  description: string
  href: string
  icon: LucideIcon
}

type MegaNavSection = {
  label: string
  summary: string
  items: MegaNavItem[]
  spotlight: {
    title: string
    description: string
    href: string
  }
}

const sections: MegaNavSection[] = [
  {
    label: "Product",
    summary: "Billing, products, stock, purchases, payments, and GST records.",
    spotlight: {
      title: "Sales bill workspace",
      description:
        "Create the bill first, then keep product tax details, stock impact, dues, and GST records connected.",
      href: "#features",
    },
    items: [
      {
        title: "Sales billing",
        description: "Sales bills, returns, credit notes, dues, and GST tax split.",
        href: "#features",
        icon: ReceiptIndianRupee,
      },
      {
        title: "Product master",
        description: "SKU, HSN/SAC, GST rate, unit, barcode, category, and price.",
        href: "#features",
        icon: Tags,
      },
      {
        title: "Inventory control",
        description: "Warehouse stock, opening balances, transfers, and item ledger.",
        href: "#features",
        icon: Warehouse,
      },
      {
        title: "Purchases and ITC",
        description: "Supplier bills, payments, ITC eligibility, and GSTR-2B context.",
        href: "#features",
        icon: PackageCheck,
      },
    ],
  },
  {
    label: "Solutions",
    summary: "Designed for Indian businesses that need simple daily operations.",
    spotlight: {
      title: "Owner-run or CA-managed",
      description:
        "The same records support a business owner working directly or a CA managing the books and GST review.",
      href: "#paths",
    },
    items: [
      {
        title: "Kirana and retail",
        description: "Fast bills, product lists, customer dues, and stock visibility.",
        href: "#paths",
        icon: Store,
      },
      {
        title: "Traders and distributors",
        description: "Sales, purchases, party balances, stock movement, and GST records.",
        href: "#paths",
        icon: Boxes,
      },
      {
        title: "Service businesses",
        description: "SAC-based service bills, collections, and monthly GST summaries.",
        href: "#pricing",
        icon: BriefcaseBusiness,
      },
      {
        title: "Small manufacturers",
        description: "Inventory, purchase bills, e-way bill context, and reports as needed.",
        href: "#pricing",
        icon: Building2,
      },
    ],
  },
  {
    label: "Compare",
    summary: "Compare GSTFY with broader accounting products.",
    spotlight: {
      title: "GSTFY vs TallyPrime vs Zoho Books",
      description:
        "Compare entry pricing, billing, product master, inventory, purchases, payments, and GST workflow.",
      href: "#comparison",
    },
    items: [
      {
        title: "Pricing comparison",
        description: "GSTFY starts at ₹299/month for billing and GST-ready records.",
        href: "#comparison",
        icon: BadgeIndianRupee,
      },
      {
        title: "Billing coverage",
        description: "Compare bills, returns, credit notes, dues, and reports.",
        href: "#comparison",
        icon: BarChart3,
      },
      {
        title: "Stock and products",
        description: "Compare product master and inventory workflow depth.",
        href: "#comparison",
        icon: Warehouse,
      },
      {
        title: "GST records",
        description: "See how each product handles GST reports and review flows.",
        href: "#comparison",
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: "Resources",
    summary: "Quick paths for pricing, workflow, setup, and money tracking.",
    spotlight: {
      title: "Start with billing",
      description:
        "Launch the business workspace around sales bills, products, stock, purchases, and payments.",
      href: "#pricing",
    },
    items: [
      {
        title: "Pricing",
        description: "Monthly plans for businesses and CA partners.",
        href: "#pricing",
        icon: BadgeIndianRupee,
      },
      {
        title: "Workflow",
        description: "Set up products, run daily billing, then use GST records.",
        href: "#workflow",
        icon: ClipboardCheck,
      },
      {
        title: "Tax display",
        description: "CGST, SGST, IGST, and Indian money formatting stay visible.",
        href: "#features",
        icon: Calculator,
      },
      {
        title: "Money tracking",
        description: "Receipts, payments, allocations, and dues stay connected.",
        href: "#features",
        icon: CreditCard,
      },
    ],
  },
]

export function MegaNav({ registerHref }: { registerHref: string }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeSection = sections.find((section) => section.label === activeMenu)

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-xl">
      <div className="border-b border-neutral-200/70 bg-neutral-950 text-white">
        <div className="mx-auto flex min-h-8 max-w-7xl items-center justify-center px-4 text-center text-[0.68rem] font-medium sm:px-6 lg:px-8">
          GSTFY is billing software for Indian small businesses: sales,
          products, stock, purchases, payments, and GST-ready records.
        </div>
      </div>
      <nav
        className="relative"
        onMouseLeave={() => setActiveMenu(null)}
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-2" aria-label="GSTFY home">
            <div className="flex size-8 items-center justify-center rounded-md bg-neutral-950 text-xs font-semibold text-white">
              GF
            </div>
            <div>
              <span className="block text-sm font-semibold leading-none">GSTFY</span>
              <span className="hidden text-[0.64rem] text-neutral-500 sm:block">
                GST billing made simple
              </span>
            </div>
          </a>

          <div className="hidden items-center gap-1 lg:flex">
            {sections.map((section) => (
              <button
                key={section.label}
                type="button"
                onMouseEnter={() => setActiveMenu(section.label)}
                onFocus={() => setActiveMenu(section.label)}
                onClick={() =>
                  setActiveMenu((current) =>
                    current === section.label ? null : section.label
                  )
                }
                aria-expanded={activeMenu === section.label}
                className={cn(
                  "flex h-9 items-center gap-1 rounded-md px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:outline-none",
                  activeMenu === section.label &&
                    "bg-neutral-100 text-neutral-950"
                )}
              >
                {section.label}
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    activeMenu === section.label && "rotate-180"
                  )}
                />
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <a
              href="#comparison"
              className="rounded-md px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
            >
              Compare
            </a>
            <Button
              render={<a href={registerHref} />}
              nativeButton={false}
              size="lg"
              className="h-9 px-3 text-xs"
            >
              Start billing
              <ArrowRight data-icon="inline-end" className="size-3.5" />
            </Button>
          </div>

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>

        <AnimatePresence>
          {activeSection ? (
            <motion.div
              key={activeSection.label}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute left-1/2 top-full hidden w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 pt-3 lg:block"
            >
              <div className="grid overflow-hidden rounded-md border border-neutral-200 bg-white shadow-2xl shadow-neutral-950/12 ring-1 ring-neutral-950/5 lg:grid-cols-[1fr_300px]">
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {activeSection.items.map((item) => {
                    const Icon = item.icon

                    return (
                      <a
                        key={item.title}
                        href={item.href}
                        className="group rounded-md p-4 transition-colors hover:bg-neutral-50"
                        onClick={() => setActiveMenu(null)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-950">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-neutral-500">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
                <div className="border-l border-neutral-200 bg-neutral-950 p-5 text-white">
                  <Badge variant="outline" className="border-white/20 text-white">
                    {activeSection.label}
                  </Badge>
                  <h3 className="mt-4 text-xl font-semibold leading-tight">
                    {activeSection.spotlight.title}
                  </h3>
                  <p className="mt-3 text-xs leading-5 text-neutral-300">
                    {activeSection.spotlight.description}
                  </p>
                  <a
                    href={activeSection.spotlight.href}
                    onClick={() => setActiveMenu(null)}
                    className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-teal-200"
                  >
                    Explore section
                    <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="border-t border-neutral-200 bg-white lg:hidden"
            >
              <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                <div className="space-y-4">
                  {sections.map((section) => (
                    <div
                      key={section.label}
                      className="rounded-md border border-neutral-200 p-3"
                    >
                      <p className="text-sm font-medium text-neutral-950">
                        {section.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        {section.summary}
                      </p>
                      <div className="mt-3 grid gap-2">
                        {section.items.slice(0, 2).map((item) => (
                          <a
                            key={item.title}
                            href={item.href}
                            className="text-xs font-medium text-neutral-700"
                            onClick={() => setMobileOpen(false)}
                          >
                            {item.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  render={<a href={registerHref} />}
                  nativeButton={false}
                  size="lg"
                  className="mt-4 h-10 w-full text-sm"
                >
                  Start billing
                  <ArrowRight data-icon="inline-end" className="size-4" />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
    </header>
  )
}
