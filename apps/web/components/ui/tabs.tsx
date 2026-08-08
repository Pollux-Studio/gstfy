"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs>.")
  }

  return context
}

function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string
  defaultValue: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = value ?? internalValue

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue)
      }
      onValueChange?.(nextValue)
    },
    [onValueChange, value]
  )

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div data-slot="tabs" className={cn("flex flex-col gap-4", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-muted/60 p-1",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  value: string
}) {
  const { value: currentValue, setValue } = useTabs()
  const isActive = currentValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-w-[6.5rem] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      onClick={() => setValue(value)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value: string
}) {
  const { value: currentValue } = useTabs()

  if (currentValue !== value) {
    return null
  }

  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
