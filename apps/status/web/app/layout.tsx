import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const jetbrainsMonoHeading = JetBrains_Mono({subsets:['latin'],variable:'--font-heading'});
const ibmPlexSans = IBM_Plex_Sans({weight: ["400", "500", "600", "700"], subsets:['latin'],variable:'--font-sans'});
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GSTfy Status",
  description: "Real-time status and uptime history for GSTfy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", ibmPlexSans.variable, jetbrainsMonoHeading.variable)}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col">
            <header className="flex items-center justify-between py-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center shadow-sm">
                  <span className="text-white dark:text-slate-900 font-bold text-lg leading-none">G</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight">Gstfy</h1>
              </div>
            </header>
            
            <main className="flex-1">
              {children}
            </main>
            
            <footer className="mt-16 py-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} GSTfy. All rights reserved.</p>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
