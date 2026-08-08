"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardTopbar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
