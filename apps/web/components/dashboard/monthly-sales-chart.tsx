"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { SalesPoint } from "@/lib/dashboard/mock-overview"

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

export function MonthlySalesChart({ data }: { data: SalesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
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
          cursor={{ fill: "var(--muted)", opacity: 0.25 }}
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
        <Bar dataKey="sales" radius={[10, 10, 4, 4]} fill="var(--chart-3)">
          {data.map((item, index) => (
            <Cell
              key={item.month}
              fill={index === data.length - 1 ? "var(--primary)" : "var(--chart-3)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
