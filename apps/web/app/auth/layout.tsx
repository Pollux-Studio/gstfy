import { AuthLayoutShell } from "@/components/auth-layout-shell"

export default function PublicAuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>
}
