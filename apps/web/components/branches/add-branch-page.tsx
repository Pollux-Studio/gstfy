"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller, useWatch } from "react-hook-form"
import * as React from "react"
import { z } from "zod"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  MapPinIcon,
  PackageIcon,
  StoreIcon,
  TruckIcon,
  WarehouseIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getAllGstStates } from "@/lib/gst-state"
import { cn } from "@/lib/utils"

const branchTypes = ["retail_store", "warehouse", "office"] as const
const storageModels = ["main_warehouse", "independent"] as const
const yesNoOptions = ["yes", "no"] as const

const addBranchSchema = z.object({
  branchName: z.string().trim().min(1, "Enter the branch name."),
  branchCode: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters for the branch code.")
    .max(12, "Keep the branch code within 12 characters.")
    .regex(/^[A-Z0-9-]+$/, "Use only uppercase letters, numbers, or hyphens."),
  branchType: z.enum(branchTypes, {
    error: "Choose the branch type.",
  }),
  managerName: z.string().trim().min(1, "Enter the branch manager or point-of-contact name."),
  managerPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a valid 10-digit Indian mobile number."),
  managerEmail: z.union([
    z.literal(""),
    z.string().trim().email("Enter a valid email address."),
  ]),
  addressLine1: z.string().trim().min(1, "Enter the branch address."),
  addressLine2: z.string().trim(),
  locality: z.string().trim().min(1, "Enter the locality or area."),
  district: z.string().trim().min(1, "Enter the district."),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  stateCode: z.string().trim().min(1, "Choose the state."),
  storageModel: z.enum(storageModels, {
    error: "Choose how branch storage is managed.",
  }),
  canSellDirect: z.enum(yesNoOptions, {
    error: "Choose whether the branch can bill customers directly.",
  }),
  acceptsLocalTransfers: z.enum(yesNoOptions, {
    error: "Choose whether the branch can receive stock transfers directly.",
  }),
  notes: z.string().trim(),
})

type AddBranchValues = z.infer<typeof addBranchSchema>
type BranchStep = "identity" | "location" | "operations"

const branchTypeLabels: Record<(typeof branchTypes)[number], string> = {
  retail_store: "Retail store",
  warehouse: "Warehouse",
  office: "Office / service location",
}

const storageModelLabels: Record<(typeof storageModels)[number], string> = {
  main_warehouse: "Managed by main warehouse",
  independent: "Track stock independently",
}

const yesNoLabels: Record<(typeof yesNoOptions)[number], string> = {
  yes: "Yes",
  no: "No",
}

const stepFieldMap: Record<BranchStep, Array<keyof AddBranchValues>> = {
  identity: ["branchName", "branchCode", "branchType", "managerName", "managerPhone", "managerEmail"],
  location: ["addressLine1", "addressLine2", "locality", "district", "pincode", "stateCode"],
  operations: ["storageModel", "canSellDirect", "acceptsLocalTransfers", "notes"],
}

export function AddBranchPage() {
  const router = useRouter()
  const storedSession = getStoredAuthSession()
  const states = getAllGstStates().filter((state) => !["97", "99"].includes(state.code))
  const [step, setStep] = React.useState<BranchStep>("identity")

  React.useEffect(() => {
    if (!storedSession?.session.accessToken) {
      router.replace("/auth/login")
    }
  }, [router, storedSession?.session.accessToken])

  const form = useForm<AddBranchValues>({
    resolver: zodResolver(addBranchSchema),
    mode: "onChange",
    defaultValues: {
      branchName: "",
      branchCode: "",
      branchType: "retail_store",
      managerName: "",
      managerPhone: "",
      managerEmail: "",
      addressLine1: "",
      addressLine2: "",
      locality: "",
      district: "",
      pincode: "",
      stateCode: "",
      storageModel: "main_warehouse",
      canSellDirect: "yes",
      acceptsLocalTransfers: "yes",
      notes: "",
    },
  })

  const values = useWatch({
    control: form.control,
    defaultValue: form.getValues(),
  })
  const branchTypeLabel =
    branchTypeLabels[values.branchType ?? "retail_store"]
  const storageModelLabel =
    storageModelLabels[values.storageModel ?? "main_warehouse"]
  const stateLabel =
    states.find((state) => state.code === values.stateCode)?.name ?? "Choose state"

  async function goToNextStep(currentStep: BranchStep, nextStep: BranchStep) {
    const isValid = await form.trigger(stepFieldMap[currentStep])

    if (!isValid) {
      return
    }

    setStep(nextStep)
  }

  async function handleSubmit(valuesToSubmit: AddBranchValues) {
    const isValid = await form.trigger(stepFieldMap.operations)

    if (!isValid) {
      return
    }

    toast.success(`Branch ${valuesToSubmit.branchName} created in this demo.`)
    router.push("/dashboard")
  }

  if (!storedSession?.session.accessToken) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-3 pt-4 sm:p-4 lg:gap-6 lg:p-6 lg:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" render={<Link href="/dashboard" />}>
          <ArrowLeftIcon className="size-4" />
          Back to dashboard
        </Button>
        <Button type="button" variant="outline" render={<Link href="/dashboard" />}>
          Cancel
        </Button>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/80 px-4 py-5 text-card-foreground sm:px-5 lg:px-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Add Branch</p>
          <h1 className="text-2xl font-semibold tracking-tight">Create a new operational branch</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Set up the branch identity, location, and stock handling model. If storage is managed by the main warehouse, this branch will depend on central stock allocation instead of maintaining its own independent inventory pool.
          </p>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-6 rounded-2xl border border-border/70 bg-card/80 px-4 py-5 sm:px-5 lg:px-6">
        <div className="w-full max-w-3xl">
          <BranchStepIndicator currentStep={step} />
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-1 flex-col gap-6">
          {step === "identity" ? (
            <FieldGroup>
              <div className="flex flex-col items-center gap-1 text-center">
                <h2 className="text-2xl font-bold">Branch identity</h2>
                <p className="text-sm text-balance text-muted-foreground">
                  Capture the operational identity and the person responsible for this branch.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <RequiredFieldLabel htmlFor="branch-name">Branch name</RequiredFieldLabel>
                  <Input
                    id="branch-name"
                    placeholder="GSTFY Chennai Central"
                    {...form.register("branchName")}
                  />
                  <FieldError errors={[form.formState.errors.branchName]} />
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="branch-code">Branch code</RequiredFieldLabel>
                  <Input
                    id="branch-code"
                    placeholder="CHN-CEN"
                    {...form.register("branchCode", {
                      onChange: (event) => {
                        event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")
                      },
                    })}
                  />
                  <FieldDescription>
                    Use a short internal code for invoices, stock transfers, and staff references.
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.branchCode]} />
                </Field>
              </div>

              <Field>
                <RequiredFieldLabel htmlFor="branch-type">Branch type</RequiredFieldLabel>
                <Controller
                  control={form.control}
                  name="branchType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="branch-type" className="w-full">
                        <SelectValue>{branchTypeLabels[field.value]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        {branchTypes.map((branchType) => (
                          <SelectItem key={branchType} value={branchType}>
                            {branchTypeLabels[branchType]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[form.formState.errors.branchType]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <RequiredFieldLabel htmlFor="manager-name">Manager / contact</RequiredFieldLabel>
                  <Input
                    id="manager-name"
                    placeholder="Branch manager or supervisor"
                    {...form.register("managerName")}
                  />
                  <FieldError errors={[form.formState.errors.managerName]} />
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="manager-phone">Mobile number</RequiredFieldLabel>
                  <IndianPhoneInput
                    id="manager-phone"
                    {...form.register("managerPhone")}
                  />
                  <FieldError errors={[form.formState.errors.managerPhone]} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="manager-email">Manager email</FieldLabel>
                <Input
                  id="manager-email"
                  type="email"
                  placeholder="branch@gstfy.in"
                  {...form.register("managerEmail")}
                />
                <FieldDescription>
                  Optional. Use this if branch alerts or internal reports should go directly to the branch.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.managerEmail]} />
              </Field>
            </FieldGroup>
          ) : null}

          {step === "location" ? (
            <FieldGroup>
              <div className="flex flex-col items-center gap-1 text-center">
                <h2 className="text-2xl font-bold">Branch location</h2>
                <p className="text-sm text-balance text-muted-foreground">
                  Record the operational address used for dispatches, branch sales, and stock movements.
                </p>
              </div>

              <Field>
                <RequiredFieldLabel htmlFor="branch-address-line-1">Address line 1</RequiredFieldLabel>
                <Input
                  id="branch-address-line-1"
                  placeholder="Door / building / street"
                  {...form.register("addressLine1")}
                />
                <FieldError errors={[form.formState.errors.addressLine1]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="branch-address-line-2">Address line 2</FieldLabel>
                <Input
                  id="branch-address-line-2"
                  placeholder="Area, landmark, floor, etc."
                  {...form.register("addressLine2")}
                />
                <FieldError errors={[form.formState.errors.addressLine2]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <RequiredFieldLabel htmlFor="branch-locality">Locality / area</RequiredFieldLabel>
                  <Input
                    id="branch-locality"
                    placeholder="Eg. T Nagar"
                    {...form.register("locality")}
                  />
                  <FieldError errors={[form.formState.errors.locality]} />
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="branch-district">District</RequiredFieldLabel>
                  <Input
                    id="branch-district"
                    placeholder="Eg. Chennai"
                    {...form.register("district")}
                  />
                  <FieldError errors={[form.formState.errors.district]} />
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="branch-pincode">Pincode</RequiredFieldLabel>
                  <Input
                    id="branch-pincode"
                    inputMode="numeric"
                    placeholder="600001"
                    {...form.register("pincode", {
                      onChange: (event) => {
                        event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6)
                      },
                    })}
                  />
                  <FieldError errors={[form.formState.errors.pincode]} />
                </Field>
              </div>

              <Field>
                <RequiredFieldLabel htmlFor="branch-state">State / UT</RequiredFieldLabel>
                <Controller
                  control={form.control}
                  name="stateCode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="branch-state" className="w-full">
                        <SelectValue placeholder="Choose state">
                          {field.value ? stateLabel : "Choose state"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        {states.map((state) => (
                          <SelectItem key={`${state.code}-${state.name}`} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[form.formState.errors.stateCode]} />
              </Field>
            </FieldGroup>
          ) : null}

          {step === "operations" ? (
            <FieldGroup>
              <div className="flex flex-col items-center gap-1 text-center">
                <h2 className="text-2xl font-bold">Operations and storage</h2>
                <p className="text-sm text-balance text-muted-foreground">
                  Choose whether this branch depends on the main warehouse for stock or maintains inventory independently.
                </p>
              </div>

              <Field>
                <RequiredFieldLabel htmlFor="branch-storage-model">Storage model</RequiredFieldLabel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => form.setValue("storageModel", "main_warehouse", { shouldDirty: true, shouldValidate: true })}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors",
                      values.storageModel === "main_warehouse"
                        ? "border-foreground bg-muted/50"
                        : "border-border bg-background hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-border bg-background p-2 text-muted-foreground">
                        <WarehouseIcon className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">Managed by main warehouse</p>
                        <p className="text-sm text-muted-foreground">
                          Use this when the branch sells or dispatches stock, but the actual storage pool and replenishment control stay with the main warehouse.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => form.setValue("storageModel", "independent", { shouldDirty: true, shouldValidate: true })}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors",
                      values.storageModel === "independent"
                        ? "border-foreground bg-muted/50"
                        : "border-border bg-background hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-border bg-background p-2 text-muted-foreground">
                        <PackageIcon className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">Track stock independently</p>
                        <p className="text-sm text-muted-foreground">
                          Use this when the branch keeps its own inventory balance, receives transfers directly, and should appear as a separate stock-holding location.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
                <FieldError errors={[form.formState.errors.storageModel]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <RequiredFieldLabel htmlFor="branch-can-sell">Can bill customers directly?</RequiredFieldLabel>
                  <Controller
                    control={form.control}
                    name="canSellDirect"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="branch-can-sell" className="w-full">
                          <SelectValue>{yesNoLabels[field.value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {yesNoOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {yesNoLabels[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>
                    Enable this if this branch creates customer invoices or POS bills directly.
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.canSellDirect]} />
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="branch-transfers">Can receive stock transfers directly?</RequiredFieldLabel>
                  <Controller
                    control={form.control}
                    name="acceptsLocalTransfers"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="branch-transfers" className="w-full">
                          <SelectValue>{yesNoLabels[field.value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {yesNoOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {yesNoLabels[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>
                    Keep this on if stock movements can be booked directly against this branch location.
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.acceptsLocalTransfers]} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="branch-notes">Operational notes</FieldLabel>
                <Textarea
                  id="branch-notes"
                  placeholder="Eg. Daily replenishment from central warehouse, weekend-only sales counter, or local pickup constraints."
                  className="min-h-28"
                  {...form.register("notes")}
                />
                <FieldDescription>
                  Optional. Capture anything ops or finance should know before this branch goes live.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.notes]} />
              </Field>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Building2Icon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Branch summary</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem
                    icon={<StoreIcon className="size-4" />}
                    label="Branch"
                    value={`${values.branchName || "New branch"} • ${branchTypeLabel}`}
                  />
                  <SummaryItem
                    icon={<MapPinIcon className="size-4" />}
                    label="Location"
                    value={values.stateCode ? `${values.district || "District"}, ${stateLabel}` : "State not selected"}
                  />
                  <SummaryItem
                    icon={<WarehouseIcon className="size-4" />}
                    label="Storage model"
                    value={storageModelLabel}
                  />
                  <SummaryItem
                    icon={<TruckIcon className="size-4" />}
                    label="Direct sales"
                    value={values.canSellDirect === "yes" ? "Branch can bill customers" : "Billing stays centralized"}
                  />
                </div>
              </div>
            </FieldGroup>
          ) : null}

          <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {step !== "identity" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setStep(step === "operations" ? "location" : "identity")
                  }
                >
                  <ArrowLeftIcon className="size-4" />
                  Back
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" render={<Link href="/dashboard" />}>
                Cancel
              </Button>

              {step === "identity" ? (
                <Button type="button" onClick={() => void goToNextStep("identity", "location")}>
                  Continue
                  <ArrowRightIcon className="size-4" />
                </Button>
              ) : null}

              {step === "location" ? (
                <Button type="button" onClick={() => void goToNextStep("location", "operations")}>
                  Continue
                  <ArrowRightIcon className="size-4" />
                </Button>
              ) : null}

              {step === "operations" ? (
                <Button type="submit">
                  <CheckIcon className="size-4" />
                  Create branch
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function RequiredFieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {children}
      <span className="ml-1 text-destructive">*</span>
    </FieldLabel>
  )
}

function BranchStepIndicator({ currentStep }: { currentStep: BranchStep }) {
  const steps: Array<{ id: BranchStep; label: string }> = [
    { id: "identity", label: "Branch" },
    { id: "location", label: "Location" },
    { id: "operations", label: "Operations" },
  ]
  const currentIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <div className="grid grid-cols-3 gap-3">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex
        const isComplete = index < currentIndex

        return (
          <div key={step.id} className="space-y-2">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                isComplete && "bg-emerald-500",
                isCurrent && "bg-foreground",
                !isCurrent && !isComplete && "bg-border"
              )}
            />
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  isComplete &&
                    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
                  isCurrent && "border-foreground bg-foreground text-background",
                  !isCurrent &&
                    !isComplete &&
                    "border-border bg-background text-muted-foreground"
                )}
              >
                {isComplete ? <CheckIcon className="size-3.5" /> : index + 1}
              </div>
              <p
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
