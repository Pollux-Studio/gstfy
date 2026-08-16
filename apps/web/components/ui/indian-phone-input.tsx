"use client"

import Image from "next/image"
import * as React from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type IndianPhoneInputProps = React.ComponentProps<typeof InputGroupInput> & {
  endAddon?: React.ReactNode
  inputClassName?: string
  numericOnly?: boolean
  showPrefix?: boolean
  wrapperClassName?: string
}

function IndianPhoneInput({
  className,
  endAddon,
  inputClassName,
  maxLength,
  numericOnly = true,
  showPrefix = true,
  wrapperClassName,
  onChange,
  inputMode,
  autoComplete,
  placeholder,
  ...props
}: IndianPhoneInputProps) {
  const computedMaxLength = maxLength ?? (numericOnly ? 10 : undefined)

  return (
    <InputGroup className={cn(wrapperClassName)}>
      <InputGroupAddon
        aria-hidden={!showPrefix}
        className={cn(
          "overflow-hidden transition-all",
          showPrefix ? "w-auto pl-2 opacity-100" : "w-0 gap-0 overflow-hidden p-0 opacity-0"
        )}
      >
        <InputGroupText
          className={cn(
            "whitespace-nowrap transition-opacity",
            !showPrefix && "opacity-0"
          )}
        >
          <Image
            src="/india-flag.png"
            alt="India"
            width={16}
            height={12}
            className="h-3 w-4 rounded-[2px] object-cover"
          />
          <span>+91</span>
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        className={cn(numericOnly && "font-mono", inputClassName, className)}
        maxLength={computedMaxLength}
        inputMode={inputMode ?? (numericOnly ? "numeric" : undefined)}
        autoComplete={autoComplete ?? (numericOnly ? "tel-national" : undefined)}
        placeholder={placeholder ?? (numericOnly ? "0000000000" : undefined)}
        onChange={(event) => {
          if (numericOnly) {
            event.currentTarget.value = event.currentTarget.value
              .replace(/\D/g, "")
              .slice(0, 10)
          }
          onChange?.(event)
        }}
        {...props}
      />
      {endAddon}
    </InputGroup>
  )
}

export { IndianPhoneInput }
