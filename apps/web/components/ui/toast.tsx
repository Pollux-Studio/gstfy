"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import type { ToastManagerAddOptions } from "@base-ui/react/toast"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  XIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const toastManager = ToastPrimitive.createToastManager()

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed right-4 bottom-4 z-[9999] w-[calc(100vw-2rem)] max-w-sm outline-none sm:w-full",
        className
      )}
      {...props}
    />
  )
}

function getToastVariantClass(type: string | undefined) {
  if (type === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-950/10 [&_[data-slot=toast-close]]:text-emerald-700/70 [&_[data-slot=toast-close]:hover]:text-emerald-950 [&_[data-slot=toast-description]]:text-emerald-900/75 [&_[data-slot=toast-icon]]:text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-50 dark:shadow-emerald-950/30 dark:[&_[data-slot=toast-close]]:text-emerald-200/70 dark:[&_[data-slot=toast-close]:hover]:text-emerald-50 dark:[&_[data-slot=toast-description]]:text-emerald-100/75 dark:[&_[data-slot=toast-icon]]:text-emerald-300"
  }

  if (type === "error") {
    return "border-red-200 bg-red-50 text-red-950 shadow-red-950/10 [&_[data-slot=toast-close]]:text-red-700/70 [&_[data-slot=toast-close]:hover]:text-red-950 [&_[data-slot=toast-description]]:text-red-900/75 [&_[data-slot=toast-icon]]:text-red-600 dark:border-red-900/60 dark:bg-red-950 dark:text-red-50 dark:shadow-red-950/30 dark:[&_[data-slot=toast-close]]:text-red-200/70 dark:[&_[data-slot=toast-close]:hover]:text-red-50 dark:[&_[data-slot=toast-description]]:text-red-100/75 dark:[&_[data-slot=toast-icon]]:text-red-300"
  }

  if (type === "warning") {
    return "border-orange-200 bg-orange-50 text-orange-950 shadow-orange-950/10 [&_[data-slot=toast-close]]:text-orange-700/70 [&_[data-slot=toast-close]:hover]:text-orange-950 [&_[data-slot=toast-description]]:text-orange-900/75 [&_[data-slot=toast-icon]]:text-orange-600 dark:border-orange-900/60 dark:bg-orange-950 dark:text-orange-50 dark:shadow-orange-950/30 dark:[&_[data-slot=toast-close]]:text-orange-200/70 dark:[&_[data-slot=toast-close]:hover]:text-orange-50 dark:[&_[data-slot=toast-description]]:text-orange-100/75 dark:[&_[data-slot=toast-icon]]:text-orange-300"
  }

  if (type === "info") {
    return "border-blue-200 bg-blue-50 text-blue-950 shadow-blue-950/10 [&_[data-slot=toast-close]]:text-blue-700/70 [&_[data-slot=toast-close]:hover]:text-blue-950 [&_[data-slot=toast-description]]:text-blue-900/75 [&_[data-slot=toast-icon]]:text-blue-600 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-50 dark:shadow-blue-950/30 dark:[&_[data-slot=toast-close]]:text-blue-200/70 dark:[&_[data-slot=toast-close]:hover]:text-blue-50 dark:[&_[data-slot=toast-description]]:text-blue-100/75 dark:[&_[data-slot=toast-icon]]:text-blue-300"
  }

  return ""
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-2xl border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={render}
      className={cn(
        "relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
        className
      )}
      {...props}
    >
      {children ?? (
        <XIcon aria-hidden="true" />
      )}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  let icon: React.ReactNode = null

  if (type === "success") {
    icon = (
      <CircleCheckIcon aria-hidden="true" />
    )
  }

  if (type === "info") {
    icon = (
      <InfoIcon aria-hidden="true" />
    )
  }

  if (type === "warning") {
    icon = (
      <TriangleAlertIcon aria-hidden="true" />
    )
  }

  if (type === "error") {
    icon = (
      <OctagonXIcon aria-hidden="true" />
    )
  }

  if (type === "loading") {
    icon = (
      <Loader2Icon className="animate-spin" aria-hidden="true" />
    )
  }

  if (!icon) {
    return null
  }

  return (
    <span
      data-slot="toast-icon"
      className="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast
      key={toastItem.id}
      toast={toastItem}
      className={getToastVariantClass(toastItem.type)}
    >
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ))
}

function Toaster({
  children,
  toastManager = toast,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager
type ToastMessage = React.ReactNode
type ToastOptions = Omit<
  ToastManagerAddOptions<object>,
  "title" | "type"
> & {
  description?: React.ReactNode
}

function addToast(type: string, title: ToastMessage, options: ToastOptions = {}) {
  return toastManager.add({
    ...options,
    title,
    type,
  })
}

const toast = Object.assign(toastManager, {
  success: (title: ToastMessage, options?: ToastOptions) =>
    addToast("success", title, options),
  error: (title: ToastMessage, options?: ToastOptions) =>
    addToast("error", title, {
      priority: "high",
      ...options,
    }),
  info: (title: ToastMessage, options?: ToastOptions) =>
    addToast("info", title, options),
  warning: (title: ToastMessage, options?: ToastOptions) =>
    addToast("warning", title, options),
  loading: (title: ToastMessage, options?: ToastOptions) =>
    addToast("loading", title, {
      timeout: 0,
      ...options,
    }),
})

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
}
