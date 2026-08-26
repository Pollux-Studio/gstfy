"use client"

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts"

import type { OverallReportSlice } from "@/lib/dashboard/mock-overview"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function OverviewReportsPieChart({
  data,
}: {
  data: OverallReportSlice[]
}) {
  return (
    <div className="h-full min-h-[280px] min-w-[260px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={280}>
        <PieChart>
          <Tooltip
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
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={92}
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
