import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3000"
  ),
  title: "GSTFY - GST billing made simple",
  description:
    "GST billing, product catalog, inventory, purchases, payments, and GST-ready reports for Indian small businesses.",
  openGraph: {
    title: "GSTFY - GST billing made simple",
    description:
      "GST billing, product catalog, inventory, purchases, payments, and GST-ready reports for Indian small businesses.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
