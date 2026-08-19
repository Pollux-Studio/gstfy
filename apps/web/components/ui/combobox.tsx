"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type ComboboxOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
  searchValue?: string
}

type ComboboxProps = {
  className?: string
  contentClassName?: string
  disabled?: boolean
  displayValue?: React.ReactNode
  emptyMessage?: React.ReactNode
  loading?: boolean
  loadingMessage?: React.ReactNode
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder: string
  searchValue: string
  value?: string
  onSearchValueChange: (value: string) => void
  onValueChange: (value: string) => void
  renderOption?: (
    option: ComboboxOption,
    state: { selected: boolean },
  ) => React.ReactNode
}

function Combobox({
  className,
  contentClassName,
  disabled,
  displayValue,
  emptyMessage = "No results found.",
  loading,
  loadingMessage = "Searching...",
  options,
  placeholder,
  searchPlaceholder,
  searchValue,
  value,
  onSearchValueChange,
  onValueChange,
  renderOption,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const triggerLabel = displayValue ?? selectedOption?.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !triggerLabel && "text-muted-foreground",
          )}
        >
          {triggerLabel ?? placeholder}
        </span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className={cn("overflow-hidden p-0", contentClassName)}
        initialFocus={false}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={searchValue}
            onValueChange={onSearchValueChange}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-72">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                <span>{loadingMessage}</span>
              </div>
            ) : null}
            {!loading && options.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : null}
            {options.length > 0 ? (
              <CommandGroup>
                {options.map((option) => {
                  const selected = option.value === value

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.searchValue ?? option.value}
                      disabled={option.disabled}
                      onSelect={() => {
                        onValueChange(option.value)
                        setOpen(false)
                      }}
                    >
                      {renderOption ? (
                        renderOption(option, { selected })
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate">
                            {option.label}
                          </span>
                          {selected ? (
                            <CheckIcon className="size-4 text-primary" />
                          ) : null}
                        </>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }
