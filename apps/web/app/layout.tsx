import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"

import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/providers/i18n-provider"
import { AppQueryProvider } from "@/providers/query-provider"
import { StoreProvider } from "@/providers/store-provider"
import { ThemeProvider } from "@/providers/theme-provider"

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <StoreProvider>
          <AppQueryProvider>
            <I18nProvider>
              <ThemeProvider>
                <TooltipProvider>
                  {children}
                  <Toaster richColors position="top-right" />
                </TooltipProvider>
              </ThemeProvider>
            </I18nProvider>
          </AppQueryProvider>
        </StoreProvider>
      </body>
    </html>
  )
}
