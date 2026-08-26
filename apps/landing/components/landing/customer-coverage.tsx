"use client"

import {
  BriefcaseBusiness,
  Building2,
  Factory,
  MapPin,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Marquee } from "@/components/marquee"
import {
  Globe,
  GlobeGlow,
  GlobePin,
  GlobeSvg,
} from "@/components/systaliko-ui/globe"

type CustomerItem = {
  label: string
  meta: string
  icon: LucideIcon
}

const customerItems: CustomerItem[] = [
  { label: "Kirana stores", meta: "Sales billing", icon: Store },
  { label: "Traders", meta: "Purchases + dues", icon: Building2 },
  { label: "Services", meta: "GST invoices", icon: BriefcaseBusiness },
  { label: "Manufacturers", meta: "Stock control", icon: Factory },
  { label: "CA clients", meta: "Shared records", icon: Users },
]

const cityPins = [
  { name: "Delhi NCR", x: 899, y: 164 },
  { name: "Ahmedabad", x: 883, y: 178 },
  { name: "Mumbai", x: 884, y: 188 },
  { name: "Hyderabad", x: 904, y: 193 },
  { name: "Bengaluru", x: 901, y: 204 },
  { name: "Chennai", x: 910, y: 204 },
  { name: "Kolkata", x: 939, y: 179 },
]

export function CustomerCoverage() {
  return (
    <div className="mx-auto max-w-7xl overflow-hidden rounded-md border border-neutral-200 bg-white shadow-2xl shadow-neutral-950/8">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between border-b border-neutral-200 p-6 lg:border-b-0 lg:border-r">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
              <MapPin className="size-3.5" />
              India focus
            </div>
            <h3 className="mt-4 text-2xl font-semibold leading-tight text-neutral-950 md:text-3xl">
              Built for businesses across India
            </h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
              GST-ready billing for shops, traders, services, manufacturers, and
              CA-managed clients.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["7", "city hubs"],
              ["5", "business types"],
              ["1", "GST workspace"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-md border border-neutral-200 bg-neutral-50 p-3"
              >
                <p className="font-mono text-xl font-semibold text-neutral-950">
                  {value}
                </p>
                <p className="mt-1 text-[0.68rem] text-neutral-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-[360px] flex-col justify-between bg-neutral-50 p-5">
          <div className="absolute inset-x-8 top-8 h-48 rounded-full bg-teal-100/50 blur-3xl" />
          <Globe className="relative mx-auto mt-3 max-w-2xl">
            <GlobeGlow className="bg-teal-200/40" />
            <GlobeSvg className="text-neutral-950">
              {cityPins.map((pin) => (
                <GlobePin key={pin.name} x={pin.x} y={pin.y}>
                  <title>{pin.name}</title>
                </GlobePin>
              ))}
            </GlobeSvg>
          </Globe>

          <div className="relative mt-4 rounded-md border border-neutral-200 bg-white/90 py-3 shadow-sm backdrop-blur">
            <Marquee duration={24} pauseOnHover fadeAmount={12}>
              {customerItems.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className="mx-2 flex min-w-48 items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2"
                  >
                    <div className="flex size-8 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-neutral-950">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] text-neutral-500">
                        {item.meta}
                      </p>
                    </div>
                  </div>
                )
              })}
            </Marquee>
          </div>
        </div>
      </div>
    </div>
  )
}
