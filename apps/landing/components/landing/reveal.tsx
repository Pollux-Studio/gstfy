"use client"

import type { ReactNode } from "react"
import { motion, type HTMLMotionProps } from "motion/react"

import { cn } from "@/lib/utils"

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode
  delay?: number
}

export function Reveal({
  children,
  className,
  delay = 0,
  ...props
}: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
