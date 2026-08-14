import Link from "next/link"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  overview,
  categories,
  workspaceLabel = "Workspace",
}: {
  overview: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
  }
  workspaceLabel?: string
  categories: {
    title: string
    items: {
      title: string
      url: string
      icon?: React.ReactNode
      isActive?: boolean
      disabled?: boolean
    }[]
  }[]
}) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>{workspaceLabel}</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={overview.url} />}
              tooltip={overview.title}
              isActive={overview.isActive}
            >
              {overview.icon}
              <span>{overview.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      {categories.map((category) => (
        <SidebarGroup key={category.title}>
          <SidebarGroupLabel>{category.title}</SidebarGroupLabel>
          <SidebarMenu>
            {category.items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={item.disabled ? undefined : <Link href={item.url} />}
                  tooltip={item.title}
                  isActive={item.isActive}
                  disabled={item.disabled}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
