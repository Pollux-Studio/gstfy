"use client"

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts"

import type { OverallReportSlice } from "@/lib/dashboard/api"
import { cn } from "@/lib/utils"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function OverviewReportsPieChart({
  data,
  className,
  innerRadius = 58,
  minHeight = 280,
  minWidth = 260,
  outerRadius = 92,
}: {
  data: OverallReportSlice[]
  className?: string
  innerRadius?: number
  minHeight?: number
  minWidth?: number
  outerRadius?: number
}) {
  return (
    <div
      className={cn(
        "h-full min-w-0 [&_.recharts-layer:focus]:outline-none [&_.recharts-layer]:outline-none [&_.recharts-surface_*:focus-visible]:outline-none [&_.recharts-surface_*:focus]:outline-none [&_.recharts-surface:focus-visible]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper:focus-visible]:outline-none [&_.recharts-wrapper:focus]:outline-none [&_.recharts-wrapper]:outline-none",
        className
      )}
      style={{ minHeight, minWidth }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={minWidth}
        minHeight={minHeight}
      >
        <PieChart accessibilityLayer={false}>
          <Tooltip
            cursor={false}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid hsl(var(--border))",
              background: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 11,
              lineHeight: "14px",
              padding: "6px 8px",
            }}
            itemStyle={{ fontSize: 11, padding: 0 }}
            labelStyle={{ display: "none" }}
            separator=" "
            formatter={(value) =>
              typeof value === "number" ? formatCurrency(value) : String(value ?? "")
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
