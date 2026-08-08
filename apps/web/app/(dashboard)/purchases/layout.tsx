import type { ReactNode } from "react"

import { PurchasesProvider } from "@/components/purchases/purchases-provider"

export default function PurchasesLayout({
  children,
}: {
  children: ReactNode
}) {
  return <PurchasesProvider>{children}</PurchasesProvider>
}
