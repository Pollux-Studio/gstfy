"use client"

import { Provider } from "react-redux"
import { useState } from "react"

import { makeStore, type AppStore } from "@/lib/store/store"

export function StoreProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [store] = useState<AppStore>(makeStore)

  return <Provider store={store}>{children}</Provider>
}
