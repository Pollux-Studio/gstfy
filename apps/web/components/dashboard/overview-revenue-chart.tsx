"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { RevenueStatisticPoint } from "@/lib/dashboard/api"

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

const revenueSeries = [
  { key: "purchases", color: "var(--chart-2)", label: "Purchases" },
  { key: "sales", color: "var(--chart-1)", label: "Sales" },
  { key: "income", color: "var(--chart-4)", label: "Income" },
] as const

function CrosshatchPattern() {
  return (
    <>
      {revenueSeries.map((series) => (
        <pattern
          key={series.key}
          id={`dashboard-revenue-crosshatch-${series.key}`}
          x="0"
          y="0"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0,8 L8,0" stroke={series.color} strokeWidth="0.8" opacity="0.42" />
          <path d="M0,0 L8,8" stroke={series.color} strokeWidth="0.8" opacity="0.2" />
        </pattern>
      ))}
    </>
  )
}

export function OverviewRevenueChart({
  data,
}: {
  data: RevenueStatisticPoint[]
}) {
  return (
    <div className="h-full min-h-[260px] w-full min-w-0 overflow-hidden [&_.recharts-layer:focus]:outline-none [&_.recharts-layer]:outline-none [&_.recharts-surface_*:focus-visible]:outline-none [&_.recharts-surface_*:focus]:outline-none [&_.recharts-surface:focus-visible]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper:focus-visible]:outline-none [&_.recharts-wrapper:focus]:outline-none [&_.recharts-wrapper]:outline-none">
      <ResponsiveContainer width="100%" height="100%" debounce={80}>
        <AreaChart
          accessibilityLayer={false}
          data={data}
          margin={{ top: 16, right: 8, left: -18, bottom: 12 }}
        >
          <defs>
            <CrosshatchPattern />
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.5} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            height={34}
            fontSize={11}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={4}
            width={48}
            fontSize={11}
            tickFormatter={(value) => compactFormatter.format(value)}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 12,
              padding: "8px 10px",
            }}
            formatter={(value) =>
              typeof value === "number" ? formatCurrency(value) : String(value ?? "")
            }
          />
          {revenueSeries.map((series) => (
            <Area
              key={series.key}
              dataKey={series.key}
              name={series.label}
              type="monotone"
              fill={`url(#dashboard-revenue-crosshatch-${series.key})`}
              fillOpacity={0.48}
              stroke={series.color}
              strokeWidth={1.4}
              activeDot={{ r: 3 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
