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
}: {
  overview: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
  }
  categories: {
    title: string
    items: {
      title: string
      url: string
      icon?: React.ReactNode
    }[]
  }[]
}) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<a href={overview.url} />}
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
                <SidebarMenuButton render={<a href={item.url} />} tooltip={item.title}>
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
