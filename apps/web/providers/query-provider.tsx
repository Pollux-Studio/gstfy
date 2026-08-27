"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function AppQueryProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 1000 * 60,
            gcTime: 1000 * 60 * 10,
            refetchOnMount: true,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
