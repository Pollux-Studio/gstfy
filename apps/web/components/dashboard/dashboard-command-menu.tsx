"use client"

import { useEffect } from "react"
import { FileTextIcon, ReceiptTextIcon, SearchIcon, UserPlusIcon, WalletIcon } from "lucide-react"
import { useRouter } from "next/navigation"

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

type DashboardCommandMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DashboardCommandMenu({
  open,
  onOpenChange,
}: DashboardCommandMenuProps) {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(!open)
      }

      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-24 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close command menu"
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        <Command>
          <CommandInput placeholder="Search invoices, parties, filings..." />
          <CommandList>
            <CommandEmpty>No matching results.</CommandEmpty>
            <CommandGroup heading="Jump to">
              <CommandItem
                value="overview dashboard"
                onSelect={() => {
                  router.push("/dashboard")
                  onOpenChange(false)
                }}
              >
                <SearchIcon />
                <span>Overview Dashboard</span>
                <CommandShortcut>Enter</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Quick actions">
              <CommandItem
                value="create invoice"
                onSelect={() => onOpenChange(false)}
              >
                <FileTextIcon />
                <span>Create invoice</span>
              </CommandItem>
              <CommandItem
                value="record payment"
                onSelect={() => onOpenChange(false)}
              >
                <WalletIcon />
                <span>Record payment</span>
              </CommandItem>
              <CommandItem
                value="review gstr"
                onSelect={() => onOpenChange(false)}
              >
                <ReceiptTextIcon />
                <span>Review GSTR</span>
              </CommandItem>
              <CommandItem
                value="add party"
                onSelect={() => onOpenChange(false)}
              >
                <UserPlusIcon />
                <span>Add party</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  )
}
