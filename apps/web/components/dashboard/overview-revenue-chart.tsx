"use client"

import {
  CartesianGrid,
  ComposedChart,
  Bar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { RevenueStatisticPoint } from "@/lib/dashboard/mock-overview"

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

export function OverviewRevenueChart({
  data,
}: {
  data: RevenueStatisticPoint[]
}) {
  return (
    <div className="h-full min-h-[280px] min-w-[280px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            height={24}
            fontSize={12}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            width={72}
            fontSize={12}
            tickFormatter={(value) => compactFormatter.format(value)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.2 }}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--card-foreground)",
            }}
            formatter={(value) =>
              typeof value === "number" ? formatCurrency(value) : String(value ?? "")
            }
          />
          <Bar
            dataKey="sales"
            name="Sales"
            radius={[8, 8, 0, 0]}
            fill="var(--chart-1)"
            barSize={18}
          />
          <Bar
            dataKey="purchases"
            name="Purchase"
            radius={[8, 8, 0, 0]}
            fill="var(--chart-2)"
            barSize={18}
          />
          <Line
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="var(--chart-4)"
            strokeWidth={3}
            dot={{ r: 3, fill: "var(--chart-4)" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
