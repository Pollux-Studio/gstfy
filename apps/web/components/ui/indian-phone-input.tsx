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
  wrapperClassName?: string
}

function IndianPhoneInput({
  className,
  endAddon,
  inputClassName,
  wrapperClassName,
  onChange,
  maxLength = 10,
  inputMode = "numeric",
  autoComplete = "tel-national",
  placeholder = "0000000000",
  ...props
}: IndianPhoneInputProps) {
  return (
    <InputGroup className={cn(wrapperClassName)}>
      <InputGroupAddon>
        <InputGroupText>
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
        className={cn("font-mono", inputClassName, className)}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => {
          event.currentTarget.value = event.currentTarget.value
            .replace(/\D/g, "")
            .slice(0, 10)
          onChange?.(event)
        }}
        {...props}
      />
      {endAddon}
    </InputGroup>
  )
}

export { IndianPhoneInput }
