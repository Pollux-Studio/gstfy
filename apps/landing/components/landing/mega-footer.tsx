"use client"

import { useMemo, useState } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronDown,
  Globe2,
  Languages,
  Mail,
  MapPin,
  Phone,
} from "lucide-react"

import { Button } from "@/components/ui/button"

type FooterLink = {
  label: string
  href: string
}

type FooterGroup = {
  title: string
  links: FooterLink[]
}

const footerGroups: FooterGroup[] = [
  {
    title: "Products",
    links: [
      { label: "Sales billing", href: "#features" },
      { label: "Product master", href: "#features" },
      { label: "Inventory control", href: "#features" },
      { label: "Purchase bills", href: "#features" },
      { label: "Money workspace", href: "#features" },
      { label: "GST-ready reports", href: "#workflow" },
    ],
  },
  {
    title: "Workflows",
    links: [
      { label: "Retail and kirana", href: "#paths" },
      { label: "Traders and distributors", href: "#paths" },
      { label: "Service businesses", href: "#pricing" },
      { label: "Small manufacturers", href: "#pricing" },
      { label: "CA-managed clients", href: "#paths" },
      { label: "POS and multi-GSTIN", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Product workflow", href: "#workflow" },
      { label: "Pricing", href: "#pricing" },
      { label: "Compare software", href: "#comparison" },
      { label: "Customer areas", href: "#customers" },
      { label: "GST billing basics", href: "#features" },
      { label: "Implementation checklist", href: "#workflow" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About GSTFY", href: "#" },
      { label: "Contact", href: "mailto:hello@gstfy.in" },
      { label: "Partner with CAs", href: "#paths" },
      { label: "Security", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
]

const followLinks: FooterLink[] = [
  { label: "LinkedIn", href: "#" },
  { label: "X", href: "#" },
  { label: "YouTube", href: "#" },
  { label: "Instagram", href: "#" },
]

const locations = [
  {
    value: "india",
    label: "India",
    line: "National GST billing workspace",
    detail: "CGST, SGST, IGST, GSTIN, HSN/SAC, e-invoice, e-way bill context",
  },
  {
    value: "north",
    label: "North India",
    line: "Delhi NCR, Jaipur, Lucknow",
    detail: "Retail billing, trader ledgers, customer dues, and GST summaries",
  },
  {
    value: "west",
    label: "West India",
    line: "Mumbai, Pune, Ahmedabad",
    detail: "Distributor billing, purchase bills, stock movement, and payments",
  },
  {
    value: "south",
    label: "South India",
    line: "Bengaluru, Chennai, Hyderabad, Kochi",
    detail: "Service billing, inventory, POS, and GST-ready records",
  },
  {
    value: "east",
    label: "East and Northeast India",
    line: "Kolkata, Guwahati",
    detail: "Trade, services, supplier bills, and receivable tracking",
  },
]

export function MegaFooter({ registerHref }: { registerHref: string }) {
  const [selectedLocation, setSelectedLocation] = useState("india")
  const activeLocation = useMemo(
    () =>
      locations.find((location) => location.value === selectedLocation) ??
      locations[0],
    [selectedLocation]
  )

  return (
    <footer className="border-t border-neutral-200 bg-neutral-950 px-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1.9fr]">
          <div>
            <a href="#" className="flex items-center gap-2" aria-label="GSTFY home">
              <div className="flex size-9 items-center justify-center rounded-md bg-white text-xs font-semibold text-neutral-950">
                GF
              </div>
              <div>
                <span className="block text-sm font-semibold leading-none">
                  GSTFY
                </span>
                <span className="mt-1 block text-[0.68rem] text-neutral-400">
                  GST billing for Indian small businesses
                </span>
              </div>
            </a>

            <p className="mt-5 max-w-sm text-sm leading-6 text-neutral-300">
              One workspace for sales billing, product master, purchases,
              inventory, payments, and GST-ready business records.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                render={<a href={registerHref} />}
                nativeButton={false}
                size="lg"
                className="h-10 bg-white px-4 text-xs text-neutral-950 hover:bg-neutral-200"
              >
                Start billing
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
              <Button
                render={<a href="#comparison" />}
                nativeButton={false}
                variant="outline"
                size="lg"
                className="h-10 border-white/15 px-4 text-xs text-white hover:bg-white/10"
              >
                Compare options
              </Button>
            </div>

            <div className="mt-8 rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-white">
                <MapPin className="size-4 text-teal-300" />
                Location switch
              </div>
              <div className="relative mt-3">
                <select
                  aria-label="Choose GSTFY location coverage"
                  value={selectedLocation}
                  onChange={(event) => setSelectedLocation(event.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-white/10 bg-neutral-900 px-3 pr-9 text-xs text-white outline-none transition-colors hover:bg-neutral-800 focus:border-teal-300"
                >
                  {locations.map((location) => (
                    <option key={location.value} value={location.value}>
                      {location.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              </div>
              <div className="mt-4 rounded-md bg-neutral-900 p-3 ring-1 ring-white/10">
                <p className="text-xs font-medium text-white">
                  {activeLocation.line}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  {activeLocation.detail}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-semibold text-white">
                    {group.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {group.links.map((link) => (
                      <li key={`${group.title}-${link.label}`}>
                        <a
                          href={link.href}
                          className="group inline-flex items-center gap-1 text-xs leading-5 text-neutral-400 transition-colors hover:text-white"
                        >
                          {link.label}
                          {link.href.startsWith("http") ||
                          link.href.startsWith("mailto") ? (
                            <ArrowUpRight className="size-3 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          ) : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 rounded-md border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <Globe2 className="mt-0.5 size-4 text-teal-300" />
                <div>
                  <p className="text-xs font-medium text-white">Market</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    India-first GST billing, with region-specific coverage.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Languages className="mt-0.5 size-4 text-teal-300" />
                <div>
                  <p className="text-xs font-medium text-white">Language</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    English now. Indian language support can follow by region.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-4 text-teal-300" />
                <div>
                  <p className="text-xs font-medium text-white">For</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    Shops, traders, services, manufacturers, and CA clients.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-5 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium text-white">Follow GSTFY</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {followLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 px-3 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 text-xs text-neutral-400 sm:grid-cols-2">
                <a
                  href="mailto:hello@gstfy.in"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <Mail className="size-3.5" />
                  hello@gstfy.in
                </a>
                <a
                  href="tel:+910000000000"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <Phone className="size-3.5" />
                  Sales support
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-neutral-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 GSTFY. GST billing software for Indian small businesses.</p>
          <p>Built for GST-ready bills, products, stock, purchases, and dues.</p>
        </div>
      </div>
    </footer>
  )
}
