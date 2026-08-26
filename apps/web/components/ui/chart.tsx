"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  id?: string
  config: ChartConfig
  children: React.ReactNode
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video min-h-[260px] min-w-0 justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer minWidth={260} minHeight={260}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, item]) => item.color)

  if (colorEntries.length === 0) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
[data-chart=${id}] {
${colorEntries
  .map(([key, item]) => `  --color-${key}: ${item.color};`)
  .join("\n")}
}
`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayloadItem = {
  dataKey?: string | number
  name?: string | number
  value?: string | number
  color?: string
  payload?: Record<string, unknown>
}

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter,
  labelFormatter,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  className?: string
  formatter?: (
    value: string | number,
    name: string | number,
    item: TooltipPayloadItem
  ) => React.ReactNode
  labelFormatter?: (label: string | number) => React.ReactNode
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "grid min-w-36 gap-1.5 rounded-xl border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow-md",
        className
      )}
    >
      {label !== undefined ? (
        <p className="font-medium">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const dataKey = String(item.dataKey ?? item.name ?? "")
          const chartItem = config[dataKey]
          const name = chartItem?.label ?? item.name ?? dataKey
          const value = item.value ?? ""

          return (
            <div
              key={`${dataKey}-${item.name ?? ""}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      chartItem?.color ?? item.color ?? "var(--muted-foreground)",
                  }}
                />
                <span className="truncate text-muted-foreground">{name}</span>
              </div>
              <span className="font-mono font-medium">
                {formatter ?
                  formatter(value, item.name ?? dataKey, item)
                : value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
