"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  BadgeIndianRupeeIcon,
  BanknoteIcon,
  BarcodeIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CreditCardIcon,
  FileChartColumnIcon,
  FilePlus2Icon,
  FileSignatureIcon,
  FileTextIcon,
  HandCoinsIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  NotebookTextIcon,
  PackageIcon,
  PrinterIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PermissionModuleKey } from "@/lib/dashboard/modules"
import { cn } from "@/lib/utils"

type DashboardCommandMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountType?: "business" | "ca"
  canManageBusinessWorkspace?: boolean
  visibleModules?: Partial<Record<PermissionModuleKey, boolean>>
}

type DashboardCommand = {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  badge: string
  shortcut?: string
  keywords: string[]
  accountType?: "business" | "ca"
  module?: PermissionModuleKey
  requiresBusinessManager?: boolean
}

type DashboardCommandGroup = {
  heading: string
  commands: DashboardCommand[]
}

const commandGroups: DashboardCommandGroup[] = [
  {
    heading: "Services",
    commands: [
      {
        id: "overview",
        label: "Overview dashboard",
        description: "Sales, GST, inventory, collections, and filing readiness.",
        href: "/dashboard",
        icon: LayoutDashboardIcon,
        badge: "Dashboard",
        shortcut: "G D",
        keywords: ["home", "dashboard", "overview", "summary", "stats"],
        module: "overview",
      },
      {
        id: "sales",
        label: "Sales workspace",
        description: "Sales bills, returns, credit notes, and invoice PDFs.",
        href: "/sales",
        icon: CreditCardIcon,
        badge: "Billing",
        shortcut: "G S",
        keywords: ["sales", "invoice", "bill", "credit note", "return"],
        accountType: "business",
        module: "invoices",
      },
      {
        id: "pos",
        label: "POS counter",
        description: "Fast counter billing with products, customer, and payment mode.",
        href: "/pos",
        icon: Building2Icon,
        badge: "Counter",
        keywords: ["pos", "counter", "billing", "cashier", "sale"],
        accountType: "business",
        module: "pos",
      },
      {
        id: "purchases",
        label: "Purchase workspace",
        description: "Supplier bills, purchase returns, and debit notes.",
        href: "/purchases",
        icon: ShoppingCartIcon,
        badge: "Purchases",
        shortcut: "G P",
        keywords: ["purchase", "supplier bill", "debit note", "input tax"],
        accountType: "business",
        module: "purchases",
      },
      {
        id: "money",
        label: "Money overview",
        description: "Receipts, payments, outstanding, and bank matching.",
        href: "/money",
        icon: BadgeIndianRupeeIcon,
        badge: "Cash flow",
        keywords: ["money", "cash", "bank", "receipt", "payment"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "inventory",
        label: "Inventory",
        description: "Warehouse stock, item ledger, movements, and transfers.",
        href: "/inventory",
        icon: WarehouseIcon,
        badge: "Stock",
        keywords: ["inventory", "warehouse", "stock", "movement", "transfer"],
        accountType: "business",
        module: "inventory",
      },
      {
        id: "products",
        label: "Products",
        description: "Product master, HSN, GST, pricing, barcode, and stock defaults.",
        href: "/products",
        icon: PackageIcon,
        badge: "Master",
        keywords: ["product", "item", "sku", "hsn", "barcode", "price"],
        accountType: "business",
        module: "inventory",
      },
      {
        id: "parties",
        label: "Parties",
        description: "Customers, suppliers, GSTINs, contacts, addresses, and ledger.",
        href: "/parties",
        icon: UsersIcon,
        badge: "Contacts",
        keywords: ["party", "customer", "supplier", "gstin", "ledger"],
        accountType: "business",
        module: "parties",
      },
      {
        id: "gst",
        label: "GST workspace",
        description: "GSTR summaries, ITC reconciliation, filing checks, and exports.",
        href: "/gst",
        icon: ReceiptTextIcon,
        badge: "Compliance",
        shortcut: "G G",
        keywords: ["gst", "gstr", "itc", "filing", "reconciliation"],
        accountType: "business",
        module: "gstr",
      },
      {
        id: "accounting",
        label: "Accounting",
        description: "Ledger accounts, trial balance, P&L, balance sheet, and day book.",
        href: "/accounting",
        icon: NotebookTextIcon,
        badge: "Books",
        keywords: ["accounting", "ledger", "trial balance", "profit", "day book"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "einvoice",
        label: "E-Invoice",
        description: "IRN eligibility, generation queue, cancellation, and retry status.",
        href: "/e-invoices",
        icon: FileSignatureIcon,
        badge: "IRN",
        keywords: ["e invoice", "einvoice", "irn", "qr", "nic"],
        accountType: "business",
        module: "einvoice",
      },
      {
        id: "ca-dashboard",
        label: "CA filing dashboard",
        description: "Client readiness, filing risk, deadlines, and GST review state.",
        href: "/dashboard",
        icon: BriefcaseBusinessIcon,
        badge: "CA",
        shortcut: "G D",
        keywords: ["ca", "filing", "dashboard", "clients", "practice"],
        accountType: "ca",
      },
      {
        id: "ca-clients",
        label: "Clients",
        description: "Open CA clients and inspect GST filing data.",
        href: "/dashboard/clients",
        icon: UsersIcon,
        badge: "CA",
        keywords: ["clients", "dealer", "business", "ca clients"],
        accountType: "ca",
      },
      {
        id: "ca-referral-codes",
        label: "Referral codes",
        description: "Create and manage business onboarding referral codes.",
        href: "/dashboard/referral-codes",
        icon: KeyRoundIcon,
        badge: "Invite",
        keywords: ["referral", "invite", "code", "client onboarding"],
        accountType: "ca",
      },
    ],
  },
  {
    heading: "Quick actions",
    commands: [
      {
        id: "action-create-sale",
        label: "Create counter bill",
        description: "Open POS and create a sales bill.",
        href: "/pos",
        icon: FilePlus2Icon,
        badge: "Sales",
        keywords: ["create invoice", "new sale", "counter bill", "pos"],
        accountType: "business",
        module: "pos",
      },
      {
        id: "action-add-purchase",
        label: "Add purchase bill",
        description: "Open purchase workspace to enter a supplier bill.",
        href: "/purchases",
        icon: ShoppingCartIcon,
        badge: "Purchase",
        keywords: ["add purchase", "supplier invoice", "bill entry"],
        accountType: "business",
        module: "purchases",
      },
      {
        id: "action-record-receipt",
        label: "Record receipt",
        description: "Collect customer money and allocate against receivables.",
        href: "/receipts",
        icon: WalletIcon,
        badge: "Money in",
        keywords: ["receipt", "payment received", "money in", "collection"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "action-record-payment",
        label: "Record payment",
        description: "Pay suppliers and allocate against payables.",
        href: "/payments",
        icon: HandCoinsIcon,
        badge: "Money out",
        keywords: ["payment", "supplier payment", "money out"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "action-add-product",
        label: "Add product",
        description: "Create item, GST, pricing, barcode, and warehouse defaults.",
        href: "/products",
        icon: PackageIcon,
        badge: "Product",
        keywords: ["add product", "new item", "sku", "hsn"],
        accountType: "business",
        module: "inventory",
      },
      {
        id: "action-add-party",
        label: "Add party",
        description: "Create customer or supplier with GSTIN and addresses.",
        href: "/parties",
        icon: UsersIcon,
        badge: "Party",
        keywords: ["add customer", "add supplier", "new party", "gstin"],
        accountType: "business",
        module: "parties",
      },
      {
        id: "action-manage-users",
        label: "Manage users and roles",
        description: "Invite staff and set branch/module permissions.",
        href: "/users",
        icon: ShieldCheckIcon,
        badge: "Admin",
        keywords: ["users", "roles", "permissions", "cashier", "manager"],
        accountType: "business",
        requiresBusinessManager: true,
      },
      {
        id: "action-invite-client",
        label: "Invite CA client",
        description: "Create a referral code for a business client.",
        href: "/dashboard/referral-codes",
        icon: KeyRoundIcon,
        badge: "CA",
        keywords: ["invite client", "referral code", "ca client"],
        accountType: "ca",
      },
    ],
  },
  {
    heading: "Reports and review",
    commands: [
      {
        id: "receivables",
        label: "Receivables",
        description: "Customer outstanding, status, and receipt action.",
        href: "/receivables",
        icon: WalletIcon,
        badge: "AR",
        keywords: ["receivable", "customer due", "outstanding", "collection"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "payables",
        label: "Payables",
        description: "Supplier outstanding and payment follow-up.",
        href: "/payables",
        icon: HandCoinsIcon,
        badge: "AP",
        keywords: ["payable", "supplier due", "outstanding", "vendor"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "payment-reports",
        label: "Payment reports",
        description: "Aging, cash-flow, and collection/payment report exports.",
        href: "/payment-reports",
        icon: FileChartColumnIcon,
        badge: "Reports",
        keywords: ["payment reports", "aging", "cash flow", "export"],
        accountType: "business",
        module: "accounting",
      },
      {
        id: "bank-reconciliation",
        label: "Bank reconciliation",
        description: "Import statements, auto-match entries, and close bank status.",
        href: "/bank-reconciliation",
        icon: BanknoteIcon,
        badge: "Bank",
        keywords: ["bank", "reconciliation", "statement", "auto match"],
        accountType: "business",
        module: "accounting",
      },
    ],
  },
  {
    heading: "Settings",
    commands: [
      {
        id: "account-settings",
        label: "Account settings",
        description: "Profile, login identity, password, sessions, and preferences.",
        href: "/account",
        icon: SlidersHorizontalIcon,
        badge: "Account",
        shortcut: "G A",
        keywords: ["account", "profile", "password", "language", "sessions"],
      },
      {
        id: "business-settings",
        label: "Business settings",
        description: "GST identity, workspace URL, contact details, and CA referral.",
        href: "/settings?tab=business",
        icon: Building2Icon,
        badge: "Settings",
        keywords: ["settings", "business", "gstin", "workspace", "ca referral"],
        accountType: "business",
        requiresBusinessManager: true,
      },
      {
        id: "invoice-settings",
        label: "Invoice settings",
        description: "Invoice number, watermark, and sales/purchase templates.",
        href: "/settings?tab=invoice",
        icon: FileTextIcon,
        badge: "Settings",
        keywords: ["settings", "invoice", "template", "watermark", "prefix"],
        accountType: "business",
        requiresBusinessManager: true,
      },
      {
        id: "gst-rate-settings",
        label: "GST rate settings",
        description: "Enabled GST slabs and cess presets for product selection.",
        href: "/settings?tab=gst",
        icon: ReceiptTextIcon,
        badge: "Settings",
        keywords: ["settings", "gst rate", "slab", "cess", "tax"],
        accountType: "business",
        requiresBusinessManager: true,
      },
      {
        id: "printer-settings",
        label: "Printer settings",
        description: "Paper size, orientation, compact print layout, and auto print.",
        href: "/settings?tab=printer",
        icon: PrinterIcon,
        badge: "Settings",
        keywords: ["settings", "printer", "print", "paper", "a4"],
        accountType: "business",
        requiresBusinessManager: true,
      },
      {
        id: "inventory-settings",
        label: "Inventory policy settings",
        description: "Negative stock policy and valuation method.",
        href: "/settings?tab=inventory",
        icon: WarehouseIcon,
        badge: "Settings",
        keywords: ["settings", "inventory", "negative stock", "valuation", "warehouse"],
        accountType: "business",
        requiresBusinessManager: true,
      },
      {
        id: "connector-settings",
        label: "Connector settings",
        description: "Barcode scanner keyboard-wedge setup and scan test.",
        href: "/settings?tab=connectors",
        icon: BarcodeIcon,
        badge: "Settings",
        keywords: ["settings", "connector", "barcode", "scanner", "device"],
        accountType: "business",
        requiresBusinessManager: true,
      },
    ],
  },
]

export function DashboardCommandMenu({
  open,
  onOpenChange,
  accountType = "business",
  canManageBusinessWorkspace = false,
  visibleModules = {},
}: DashboardCommandMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const visibleCommandGroups = React.useMemo(
    () =>
      commandGroups
        .map((group) => ({
          ...group,
          commands: group.commands.filter((command) =>
            isCommandVisible(command, {
              accountType,
              canManageBusinessWorkspace,
              visibleModules,
            })
          ),
        }))
        .filter((group) => group.commands.length > 0),
    [accountType, canManageBusinessWorkspace, visibleModules]
  )

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(!open)
        return
      }

      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault()
        onOpenChange(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open])

  function runCommand(command: DashboardCommand) {
    onOpenChange(false)
    router.push(command.href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] max-h-[78vh] max-w-2xl translate-y-0 gap-0 overflow-hidden rounded-2xl border-border/80 bg-popover p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and open GSTFY services, actions, reports, and settings.
        </DialogDescription>
        <Command className="rounded-none" loop>
          <CommandInput placeholder="Search services, settings, actions..." />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No matching results.</CommandEmpty>
            {visibleCommandGroups.map((group, index) => (
              <React.Fragment key={group.heading}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group.heading}>
                  {group.commands.map((command) => (
                    <CommandItem
                      key={command.id}
                      value={buildCommandSearchValue(command)}
                      onSelect={() => runCommand(command)}
                      className={cn(
                        "items-center gap-2 px-3 py-2",
                        isCurrentCommand(pathname, command.href) && "bg-accent/60"
                      )}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                        <command.icon className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate font-medium">{command.label}</span>
                        <span className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {command.badge}
                        </span>
                      </span>
                      <CommandShortcut>
                        {command.shortcut ?? normalizeCommandPath(command.href)}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function isCommandVisible(
  command: DashboardCommand,
  context: Pick<
    DashboardCommandMenuProps,
    "accountType" | "canManageBusinessWorkspace" | "visibleModules"
  >
) {
  if (command.accountType && command.accountType !== context.accountType) {
    return false
  }

  if (command.requiresBusinessManager && !context.canManageBusinessWorkspace) {
    return false
  }

  if (context.accountType === "business" && command.module) {
    return Boolean(context.visibleModules?.[command.module])
  }

  return true
}

function buildCommandSearchValue(command: DashboardCommand) {
  return [
    command.label,
    command.description,
    command.href,
    command.badge,
    ...command.keywords,
  ].join(" ")
}

function isCurrentCommand(pathname: string, href: string) {
  const [hrefPath] = href.split("?")
  return hrefPath === pathname
}

function normalizeCommandPath(href: string) {
  const [path, query] = href.split("?")
  const shortPath = path === "/dashboard" ? "Home" : path.replace(/^\//, "")

  if (!query) {
    return shortPath
  }

  const tab = new URLSearchParams(query).get("tab")
  return tab ? `${shortPath} · ${tab}` : shortPath
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  )
}
