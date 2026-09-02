import * as React from "react"
import { cn } from "@/lib/utils"

export const Timeline = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent dark:before:via-slate-700", className)} {...props} />
))
Timeline.displayName = "Timeline"

export const TimelineItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active", className)} {...props} />
))
TimelineItem.displayName = "TimelineItem"

export const TimelineIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 dark:border-slate-900 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm", className)} {...props} />
))
TimelineIcon.displayName = "TimelineIcon"

export const TimelineContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm", className)} {...props} />
))
TimelineContent.displayName = "TimelineContent"

export const TimelineTime = React.forwardRef<HTMLTimeElement, React.TimeHTMLAttributes<HTMLTimeElement>>(({ className, ...props }, ref) => (
  <time ref={ref} className={cn("text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block", className)} {...props} />
))
TimelineTime.displayName = "TimelineTime"

export const TimelineTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h4 ref={ref} className={cn("font-semibold text-lg text-slate-900 dark:text-slate-100", className)} {...props} />
))
TimelineTitle.displayName = "TimelineTitle"

export const TimelineDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-slate-600 dark:text-slate-300 mt-2 text-sm", className)} {...props} />
))
TimelineDescription.displayName = "TimelineDescription"
