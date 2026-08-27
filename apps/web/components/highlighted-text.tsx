"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type From = "left" | "right" | "top" | "bottom";

interface HighlightedTextProps {
  children: React.ReactNode;
  className?: string;
  from?: From;
  delay?: number;
  inView?: boolean;
  once?: boolean;
}

const fromVariants = {
  left: {
    hidden: { x: "-100%" },
    visible: { x: "0%" },
  },
  right: {
    hidden: { x: "100%" },
    visible: { x: "0%" },
  },
  top: {
    hidden: { y: "-100%" },
    visible: { y: "0%" },
  },
  bottom: {
    hidden: { y: "100%" },
    visible: { y: "0%" },
  },
};

export function HighlightedText({
  children,
  className,
  from = "bottom",
  delay = 0,
  inView = false,
  once = true,
}: HighlightedTextProps) {
  const variants = fromVariants[from];

  return (
    <motion.span
      className={cn(
        "relative inline-flex overflow-hidden rounded-md align-baseline",
        className,
      )}
      initial="hidden"
      whileInView={inView ? "visible" : undefined}
      animate={inView ? undefined : "visible"}
      viewport={{ once }}
    >
      <motion.span
        className="absolute inset-0 -left-[0.15em] -right-[0.18em] z-0 bg-emerald-600 dark:bg-emerald-300"
        variants={variants}
        transition={{
          type: "spring",
          damping: 30,
          stiffness: 300,
          delay,
        }}
      />
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-0 z-10 w-8 -skew-x-12 bg-white/45"
        initial={{ x: "-160%" }}
        animate={{ x: "340%" }}
        transition={{
          duration: 1.7,
          delay: delay + 0.35,
          repeat: Infinity,
          repeatDelay: 1.2,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
      <span className="relative z-20 px-[0.18em] text-white dark:text-emerald-950">
        {children}
      </span>
    </motion.span>
  );
}

export default HighlightedText;
