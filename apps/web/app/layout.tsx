import type { Metadata } from "next"

import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/providers/i18n-provider"
import { AppQueryProvider } from "@/providers/query-provider"
import { StoreProvider } from "@/providers/store-provider"
import { ThemeProvider } from "@/providers/theme-provider"

import "./globals.css"

export const metadata: Metadata = {
  title: "GSTFY",
  description: "GST compliance and filing for Indian businesses",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <StoreProvider>
          <AppQueryProvider>
            <I18nProvider>
              <ThemeProvider>
                <TooltipProvider>
                  {children}
                  <Toaster />
                </TooltipProvider>
              </ThemeProvider>
            </I18nProvider>
          </AppQueryProvider>
        </StoreProvider>
      </body>
    </html>
  )
}
