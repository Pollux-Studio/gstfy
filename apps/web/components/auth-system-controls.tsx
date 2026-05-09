import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

export function AuthSystemControls() {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  )
}
