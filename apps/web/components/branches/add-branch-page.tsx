"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  Building2Icon,
  CheckIcon,
  MapPinIcon,
  StoreIcon,
  UsersIcon,
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
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getAllGstStates } from "@/lib/gst-state"
import {
  assignBranchUser,
  createBranch,
  createLocation,
  createWarehouse,
  getGstRegistrations,
  getLocations,
  getWarehouses,
  linkBranchWarehouse,
  type BusinessLocationRecord,
  type GstRegistrationRecord,
  type WarehouseRecord,
} from "@/lib/organization/api"
import { getUsers, type UserRecord } from "@/lib/users/api"
import { cn } from "@/lib/utils"

const branchTypes = ["retail_store", "office", "service_location"] as const
const locationModes = ["create", "existing"] as const
const warehouseModes = ["none", "create", "existing"] as const
const warehouseTypes = [
  "central",
  "branch",
  "distribution",
  "transit",
  "returns",
  "damaged",
] as const

const addBranchSchema = z
  .object({
    branchName: z.string().trim().min(1, "Enter the branch name."),
    branchCode: z
      .string()
      .trim()
      .min(2, "Use at least 2 characters for the branch code.")
      .max(12, "Keep the branch code within 12 characters.")
      .regex(/^[A-Z0-9-]+$/, "Use only uppercase letters, numbers, or hyphens."),
    branchType: z.enum(branchTypes),
    managerName: z.string().trim(),
    managerPhone: z.union([
      z.literal(""),
      z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit Indian mobile number."),
    ]),
    managerEmail: z.union([
      z.literal(""),
      z.string().trim().email("Enter a valid email address."),
    ]),
    openingDate: z.union([
      z.literal(""),
      z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date."),
    ]),
    locationMode: z.enum(locationModes),
    existingLocationId: z.string().trim(),
    addressLine1: z.string().trim(),
    addressLine2: z.string().trim(),
    locality: z.string().trim(),
    city: z.string().trim(),
    district: z.string().trim(),
    pincode: z.string().trim(),
    stateCode: z.string().trim(),
    gstRegistrationId: z.string().trim().min(1, "Choose the GST registration."),
    warehouseMode: z.enum(warehouseModes),
    existingWarehouseId: z.string().trim(),
    warehouseName: z.string().trim(),
    warehouseCode: z.string().trim(),
    warehouseType: z.enum(warehouseTypes),
    warehouseCapacity: z.string().trim(),
    notes: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.locationMode === "existing" && !value.existingLocationId) {
      context.addIssue({
        code: "custom",
        path: ["existingLocationId"],
        message: "Choose the location to use.",
      })
    }

    if (value.locationMode === "create") {
      if (!value.addressLine1) {
        context.addIssue({
          code: "custom",
          path: ["addressLine1"],
          message: "Enter the branch address.",
        })
      }

      if (!value.city) {
        context.addIssue({
          code: "custom",
          path: ["city"],
          message: "Enter the city.",
        })
      }

      if (!value.district) {
        context.addIssue({
          code: "custom",
          path: ["district"],
          message: "Enter the district.",
        })
      }

      if (!/^\d{6}$/.test(value.pincode)) {
        context.addIssue({
          code: "custom",
          path: ["pincode"],
          message: "Enter a valid 6-digit pincode.",
        })
      }

      if (!value.stateCode) {
        context.addIssue({
          code: "custom",
          path: ["stateCode"],
          message: "Choose the state.",
        })
      }
    }

    if (value.warehouseMode === "existing" && !value.existingWarehouseId) {
      context.addIssue({
        code: "custom",
        path: ["existingWarehouseId"],
        message: "Choose the warehouse to link.",
      })
    }

    if (value.warehouseMode === "create") {
      if (!value.warehouseName) {
        context.addIssue({
          code: "custom",
          path: ["warehouseName"],
          message: "Enter the warehouse name.",
        })
      }

      if (!/^[A-Z0-9-]{2,24}$/.test(value.warehouseCode)) {
        context.addIssue({
          code: "custom",
          path: ["warehouseCode"],
          message: "Use 2 to 24 uppercase letters, numbers, or hyphens.",
        })
      }
    }
  })

type AddBranchValues = z.infer<typeof addBranchSchema>
type BranchStep = "identity" | "location" | "gst" | "warehouse" | "users" | "review"

const stepFieldMap: Record<BranchStep, Array<keyof AddBranchValues>> = {
  identity: [
    "branchName",
    "branchCode",
    "branchType",
    "managerPhone",
    "managerEmail",
    "openingDate",
  ],
  location: [
    "locationMode",
    "existingLocationId",
    "addressLine1",
    "addressLine2",
    "locality",
    "city",
    "district",
    "pincode",
    "stateCode",
  ],
  gst: ["gstRegistrationId"],
  warehouse: [
    "warehouseMode",
    "existingWarehouseId",
    "warehouseName",
    "warehouseCode",
    "warehouseType",
    "warehouseCapacity",
  ],
  users: [],
  review: [],
}

const branchTypeLabels: Record<(typeof branchTypes)[number], string> = {
  retail_store: "Retail store",
  office: "Office",
  service_location: "Service location",
}

const warehouseModeLabels: Record<(typeof warehouseModes)[number], string> = {
  none: "No dedicated warehouse",
  create: "Create new warehouse",
  existing: "Use existing warehouse",
}

const locationModeLabels: Record<(typeof locationModes)[number], string> = {
  create: "Create new location",
  existing: "Use existing location",
}

const warehouseTypeLabels: Record<(typeof warehouseTypes)[number], string> = {
  central: "Central",
  branch: "Branch",
  distribution: "Distribution",
  transit: "Transit",
  returns: "Returns",
  damaged: "Damaged",
}

const branchSteps: Array<{ id: BranchStep; label: string }> = [
  { id: "identity", label: "Branch" },
  { id: "location", label: "Location" },
  { id: "gst", label: "GST" },
  { id: "warehouse", label: "Warehouse" },
  { id: "users", label: "Users" },
  { id: "review", label: "Review" },
]

export function AddBranchPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const states = getAllGstStates().filter((state) => !["97", "99"].includes(state.code))
  const [step, setStep] = React.useState<BranchStep>("identity")
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
  const dummyFillCounterRef = React.useRef(0)

  const gstRegistrationsQuery = useQuery({
    queryKey: ["gst-registrations"],
    queryFn: () => getGstRegistrations(accessToken),
    enabled: accessToken.length > 0,
  })
  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: () => getLocations(accessToken),
    enabled: accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: accessToken.length > 0,
  })
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(accessToken),
    enabled: accessToken.length > 0,
  })

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
      openingDate: "",
      locationMode: "create",
      existingLocationId: "",
      addressLine1: "",
      addressLine2: "",
      locality: "",
      city: "",
      district: "",
      pincode: "",
      stateCode: "",
      gstRegistrationId: "",
      warehouseMode: "none",
      existingWarehouseId: "",
      warehouseName: "",
      warehouseCode: "",
      warehouseType: "branch",
      warehouseCapacity: "",
      notes: "",
    },
  })

  const values = useWatch({
    control: form.control,
    defaultValue: form.getValues(),
  })
  const gstRegistrations = React.useMemo(
    () => gstRegistrationsQuery.data?.gstRegistrations ?? [],
    [gstRegistrationsQuery.data?.gstRegistrations]
  )
  const locations = React.useMemo(
    () => locationsQuery.data?.locations ?? [],
    [locationsQuery.data?.locations]
  )
  const warehouses = React.useMemo(
    () => warehousesQuery.data?.warehouses ?? [],
    [warehousesQuery.data?.warehouses]
  )
  const users = React.useMemo(
    () => usersQuery.data?.users ?? [],
    [usersQuery.data?.users]
  )
  const selectedState =
    states.find((state) => state.code === values.stateCode) ?? null
  const selectedLocation =
    locations.find((location) => location.id === values.existingLocationId) ?? null
  const selectedGstRegistration =
    gstRegistrations.find((registration) => registration.id === values.gstRegistrationId) ??
    null
  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === values.existingWarehouseId) ?? null

  React.useEffect(() => {
    if (gstRegistrations.length === 1 && !form.getValues("gstRegistrationId")) {
      form.setValue("gstRegistrationId", gstRegistrations[0].id, {
        shouldValidate: true,
      })
    }
  }, [form, gstRegistrations])

  const createBranchMutation = useMutation({
    mutationFn: async (valuesToSubmit: AddBranchValues) => {
      const location =
        valuesToSubmit.locationMode === "existing" ?
          await resolveSelectedLocation(valuesToSubmit.existingLocationId, locations)
        : await createLocation(
            {
              name: valuesToSubmit.branchName.trim(),
              locationCode: valuesToSubmit.branchCode.trim().toUpperCase(),
              addressLine1: valuesToSubmit.addressLine1.trim(),
              addressLine2: valuesToSubmit.addressLine2.trim() || null,
              locality: valuesToSubmit.locality.trim() || null,
              city: valuesToSubmit.city.trim(),
              district: valuesToSubmit.district.trim(),
              pincode: valuesToSubmit.pincode.trim(),
              stateCode: valuesToSubmit.stateCode,
              state: selectedState?.name ?? null,
              country: "India",
              status: "active",
              isPrincipalPlace: false,
              isAdditionalPlace: true,
              isSalesLocation: true,
              isPurchaseLocation: true,
              isDispatchLocation: true,
              isWarehouseLocation: valuesToSubmit.warehouseMode === "create",
              isOffice: valuesToSubmit.branchType === "office",
            },
            accessToken
          ).then((response) => response.location)

      const { branch } = await createBranch(
        {
          name: valuesToSubmit.branchName.trim(),
          branchCode: valuesToSubmit.branchCode.trim().toUpperCase(),
          branchType: valuesToSubmit.branchType,
          locationId: location.id,
          gstRegistrationId: valuesToSubmit.gstRegistrationId,
          managerName: valuesToSubmit.managerName.trim() || undefined,
          phone: valuesToSubmit.managerPhone.trim() || undefined,
          email: valuesToSubmit.managerEmail.trim() || undefined,
          openingDate: valuesToSubmit.openingDate || undefined,
          status: "active",
        },
        accessToken
      )

      if (valuesToSubmit.warehouseMode === "create") {
        const { warehouse } = await createWarehouse(
          {
            name: valuesToSubmit.warehouseName.trim(),
            warehouseCode: valuesToSubmit.warehouseCode.trim().toUpperCase(),
            warehouseType: valuesToSubmit.warehouseType,
            capacity: valuesToSubmit.warehouseCapacity.trim() || undefined,
            managerName: valuesToSubmit.managerName.trim() || undefined,
            locationId: location.id,
            status: "active",
          },
          accessToken
        )

        await linkBranchWarehouse(
          branch.id,
          {
            warehouseId: warehouse.id,
            isDefault: true,
          },
          accessToken
        )
      }

      if (valuesToSubmit.warehouseMode === "existing") {
        await linkBranchWarehouse(
          branch.id,
          {
            warehouseId: valuesToSubmit.existingWarehouseId,
            isDefault: true,
          },
          accessToken
        )
      }

      if (selectedUserIds.length > 0) {
        await Promise.all(
          selectedUserIds.map((memberId, index) =>
            assignBranchUser(
              branch.id,
              {
                memberId,
                isPrimary: index === 0,
              },
              accessToken
            )
          )
        )
      }

      return branch
    },
    onSuccess: (branch) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      void queryClient.invalidateQueries({ queryKey: ["locations"] })
      void queryClient.invalidateQueries({ queryKey: ["branches"] })
      void queryClient.invalidateQueries({ queryKey: ["warehouses"] })
      toast.success(`Branch ${branch.name} created.`)
      router.push("/dashboard")
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  async function goToNextStep(currentStep: BranchStep, nextStep: BranchStep) {
    const fields = stepFieldMap[currentStep]
    const isValid = fields.length === 0 ? true : await form.trigger(fields)

    if (!isValid) {
      return
    }

    setStep(nextStep)
  }

  async function handleSubmit(valuesToSubmit: AddBranchValues) {
    const isValid = await form.trigger([
      ...stepFieldMap.identity,
      ...stepFieldMap.location,
      ...stepFieldMap.gst,
      ...stepFieldMap.warehouse,
    ])

    if (!isValid) {
      return
    }

    createBranchMutation.mutate(valuesToSubmit)
  }

  function fillDummyData() {
    dummyFillCounterRef.current += 1

    const sequence = locations.length + dummyFillCounterRef.current
    const suffix = String(sequence).padStart(2, "0").slice(-2)
    const branchCode = `DEV${suffix}`
    const existingWarehouse = warehouses[0] ?? null
    const dummyValues: AddBranchValues = {
      branchName: `Dev Branch ${suffix}`,
      branchCode,
      branchType: "retail_store",
      managerName: `Branch Manager ${suffix}`,
      managerPhone: `90000000${suffix}`,
      managerEmail: `branch${suffix}@gstfy.in`,
      openingDate: "2026-08-16",
      locationMode: "create",
      existingLocationId: "",
      addressLine1: `${sequence}, GSTFY Test Street`,
      addressLine2: "Near Market Road",
      locality: "T Nagar",
      city: "Chennai",
      district: "Chennai",
      pincode: "600017",
      stateCode: "33",
      gstRegistrationId:
        form.getValues("gstRegistrationId") || gstRegistrations[0]?.id || "",
      warehouseMode: existingWarehouse ? "existing" : "create",
      existingWarehouseId: existingWarehouse?.id ?? "",
      warehouseName: `Dev Central Warehouse ${suffix}`,
      warehouseCode: `DWH${suffix}`,
      warehouseType: "central",
      warehouseCapacity: "1000 sq ft",
      notes:
        existingWarehouse ?
          `Dev branch linked to ${existingWarehouse.name}.`
        : "Dev branch with a new central warehouse for testing.",
    }

    for (const [fieldName, fieldValue] of Object.entries(dummyValues) as Array<
      [keyof AddBranchValues, AddBranchValues[keyof AddBranchValues]]
    >) {
      form.setValue(fieldName, fieldValue, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      })
    }

    setSelectedUserIds([])
    setStep("identity")
    toast.success("Dummy branch data filled.")
    void form.trigger()
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
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={fillDummyData}>
            Fill dummy data
          </Button>
          <Button type="button" variant="outline" render={<Link href="/dashboard" />}>
            Cancel
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/80 px-4 py-5 text-card-foreground sm:px-5 lg:px-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Add Branch</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create an operational branch
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            A branch is an operational unit. Its address, GST registration, and warehouse links are connected explicitly so one warehouse can serve many branches.
          </p>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-6 rounded-2xl border border-border/70 bg-card/80 px-4 py-5 sm:px-5 lg:px-6">
        <BranchStepIndicator currentStep={step} />

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-1 flex-col gap-6">
          {step === "identity" ? (
            <BranchIdentityStep form={form} />
          ) : null}

          {step === "location" ? (
            <BranchLocationStep
              form={form}
              states={states}
              locations={locations}
              isLoading={locationsQuery.isLoading}
            />
          ) : null}

          {step === "gst" ? (
            <GstRegistrationStep
              form={form}
              gstRegistrations={gstRegistrations}
              isLoading={gstRegistrationsQuery.isLoading}
            />
          ) : null}

          {step === "warehouse" ? (
            <WarehouseStep
              form={form}
              warehouses={warehouses}
              isLoading={warehousesQuery.isLoading}
            />
          ) : null}

          {step === "users" ? (
            <AssignUsersStep
              users={users}
              selectedUserIds={selectedUserIds}
              onSelectedUserIdsChange={setSelectedUserIds}
              isLoading={usersQuery.isLoading}
            />
          ) : null}

          {step === "review" ? (
            <ReviewStep
              values={values}
              stateName={selectedState?.name ?? "Not selected"}
              location={selectedLocation}
              gstRegistration={selectedGstRegistration}
              warehouse={selectedWarehouse}
              selectedUsers={users.filter((user) => selectedUserIds.includes(user.id))}
            />
          ) : null}

          <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {step !== "identity" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={createBranchMutation.isPending}
                  onClick={() => setStep(getPreviousStep(step))}
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

              {step !== "review" ? (
                <Button
                  type="button"
                  disabled={createBranchMutation.isPending}
                  onClick={() => void goToNextStep(step, getNextStep(step))}
                >
                  Continue
                  <ArrowRightIcon className="size-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={createBranchMutation.isPending}>
                  {createBranchMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <CheckIcon className="size-4" />
                  )}
                  Create branch
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function BranchIdentityStep({
  form,
}: {
  form: ReturnType<typeof useForm<AddBranchValues>>
}) {
  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">Branch identity</h2>
        <p className="text-sm text-balance text-muted-foreground">
          Capture the operational branch name, internal code, and optional branch contact.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <RequiredFieldLabel htmlFor="branch-name">Branch name</RequiredFieldLabel>
          <Input
            id="branch-name"
            placeholder="Chennai Branch"
            {...form.register("branchName")}
          />
          <FieldError errors={[form.formState.errors.branchName]} />
        </Field>

        <Field>
          <RequiredFieldLabel htmlFor="branch-code">Branch code</RequiredFieldLabel>
          <Input
            id="branch-code"
            placeholder="CHE"
            {...form.register("branchCode", {
              onChange: (event) => {
                event.target.value = event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9-]/g, "")
                  .slice(0, 12)
              },
            })}
          />
          <FieldDescription>Examples: CHE, MAD, CBE, TNV, SAL.</FieldDescription>
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
          <FieldLabel htmlFor="manager-name">Manager / contact</FieldLabel>
          <Input
            id="manager-name"
            placeholder="Optional branch manager"
            {...form.register("managerName")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="opening-date">Opening date</FieldLabel>
          <Input id="opening-date" type="date" {...form.register("openingDate")} />
          <FieldError errors={[form.formState.errors.openingDate]} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="manager-phone">Phone</FieldLabel>
          <IndianPhoneInput id="manager-phone" {...form.register("managerPhone")} />
          <FieldError errors={[form.formState.errors.managerPhone]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="manager-email">Email</FieldLabel>
          <Input
            id="manager-email"
            type="email"
            placeholder="branch@gstfy.in"
            {...form.register("managerEmail")}
          />
          <FieldError errors={[form.formState.errors.managerEmail]} />
        </Field>
      </div>
    </FieldGroup>
  )
}

function BranchLocationStep({
  form,
  states,
  locations,
  isLoading,
}: {
  form: ReturnType<typeof useForm<AddBranchValues>>
  states: ReturnType<typeof getAllGstStates>
  locations: BusinessLocationRecord[]
  isLoading: boolean
}) {
  const locationMode = useWatch({ control: form.control, name: "locationMode" })
  const stateCode = useWatch({ control: form.control, name: "stateCode" })
  const stateLabel = states.find((state) => state.code === stateCode)?.name ?? "Choose state"

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">Branch location</h2>
        <p className="text-sm text-balance text-muted-foreground">
          Select an existing physical location or create one. The branch references the location instead of duplicating address fields.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {locationModes.map((mode) => (
          <button
            type="button"
            key={mode}
            onClick={() =>
              form.setValue("locationMode", mode, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              locationMode === mode ?
                "border-foreground bg-muted/40"
              : "border-border hover:bg-muted/20"
            )}
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl border bg-background text-muted-foreground">
              <MapPinIcon className="size-4" />
            </div>
            <p className="font-medium">{locationModeLabels[mode]}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "create" ?
                "Add a new address for this branch."
              : "Reuse an existing business location."}
            </p>
          </button>
        ))}
      </div>

      {locationMode === "existing" ? (
        <Field>
          <RequiredFieldLabel htmlFor="existing-location">Existing location</RequiredFieldLabel>
          <Controller
            control={form.control}
            name="existingLocationId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                <SelectTrigger id="existing-location" className="w-full">
                  <SelectValue placeholder={isLoading ? "Loading locations" : "Choose location"} />
                </SelectTrigger>
                <SelectContent align="start">
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {formatLocationOption(location)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {locations.length === 0 && !isLoading ? (
            <FieldDescription>
              No reusable location exists yet. Choose create new location.
            </FieldDescription>
          ) : null}
          <FieldError errors={[form.formState.errors.existingLocationId]} />
        </Field>
      ) : null}

      {locationMode === "create" ? (
        <>
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
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="branch-locality">Locality / area</FieldLabel>
              <Input
                id="branch-locality"
                placeholder="Eg. T Nagar"
                {...form.register("locality")}
              />
            </Field>

            <Field>
              <RequiredFieldLabel htmlFor="branch-city">City</RequiredFieldLabel>
              <Input id="branch-city" placeholder="Eg. Chennai" {...form.register("city")} />
              <FieldError errors={[form.formState.errors.city]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>
        </>
      ) : null}
    </FieldGroup>
  )
}

function GstRegistrationStep({
  form,
  gstRegistrations,
  isLoading,
}: {
  form: ReturnType<typeof useForm<AddBranchValues>>
  gstRegistrations: GstRegistrationRecord[]
  isLoading: boolean
}) {
  const selectedId = useWatch({ control: form.control, name: "gstRegistrationId" })

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">GST registration</h2>
        <p className="text-sm text-balance text-muted-foreground">
          Select the legal tax identity this branch operates under. This is required even when there is only one GSTIN.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border p-8 text-muted-foreground">
          <Spinner />
        </div>
      ) : null}

      {!isLoading && gstRegistrations.length === 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No GST registration is available for this workspace. Add a GST registration before creating a branch.
        </div>
      ) : null}

      <div className="grid gap-3">
        {gstRegistrations.map((registration) => {
          const isSelected = selectedId === registration.id

          return (
            <button
              type="button"
              key={registration.id}
              onClick={() =>
                form.setValue("gstRegistrationId", registration.id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                isSelected ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{registration.tradeName}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {registration.gstin}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {registration.state ?? `State code ${registration.stateCode}`}
                  </p>
                </div>
                {isSelected ? (
                  <BadgeCheckIcon className="size-5 shrink-0 text-emerald-600" />
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
      <FieldError errors={[form.formState.errors.gstRegistrationId]} />
    </FieldGroup>
  )
}

function WarehouseStep({
  form,
  warehouses,
  isLoading,
}: {
  form: ReturnType<typeof useForm<AddBranchValues>>
  warehouses: WarehouseRecord[]
  isLoading: boolean
}) {
  const warehouseMode = useWatch({ control: form.control, name: "warehouseMode" })

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">Warehouse link</h2>
        <p className="text-sm text-balance text-muted-foreground">
          A branch can have no warehouse, create a dedicated warehouse, or use an existing central warehouse.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {warehouseModes.map((mode) => (
          <button
            type="button"
            key={mode}
            onClick={() =>
              form.setValue("warehouseMode", mode, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              warehouseMode === mode ?
                "border-foreground bg-muted/40"
              : "border-border hover:bg-muted/20"
            )}
          >
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl border bg-background text-muted-foreground">
              <WarehouseIcon className="size-4" />
            </div>
            <p className="font-medium">{warehouseModeLabels[mode]}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "none" ?
                "Use this for sales offices or branches that do not hold stock."
              : mode === "create" ?
                "Create a warehouse at this same location and link it as default."
              : "Link this branch to a central or shared warehouse."}
            </p>
          </button>
        ))}
      </div>

      {warehouseMode === "existing" ? (
        <Field>
          <RequiredFieldLabel htmlFor="existing-warehouse">Existing warehouse</RequiredFieldLabel>
          <Controller
            control={form.control}
            name="existingWarehouseId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                <SelectTrigger id="existing-warehouse" className="w-full">
                  <SelectValue placeholder={isLoading ? "Loading warehouses" : "Choose warehouse"} />
                </SelectTrigger>
                <SelectContent align="start">
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.warehouseCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {warehouses.length === 0 && !isLoading ? (
            <FieldDescription>
              No warehouse exists yet. Choose create new warehouse or no dedicated warehouse.
            </FieldDescription>
          ) : null}
          <FieldError errors={[form.formState.errors.existingWarehouseId]} />
        </Field>
      ) : null}

      {warehouseMode === "create" ? (
        <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
          <Field>
            <RequiredFieldLabel htmlFor="warehouse-name">Warehouse name</RequiredFieldLabel>
            <Input
              id="warehouse-name"
              placeholder="Chennai Central Warehouse"
              {...form.register("warehouseName")}
            />
            <FieldError errors={[form.formState.errors.warehouseName]} />
          </Field>

          <Field>
            <RequiredFieldLabel htmlFor="warehouse-code">Warehouse code</RequiredFieldLabel>
            <Input
              id="warehouse-code"
              placeholder="CHE-WH"
              {...form.register("warehouseCode", {
                onChange: (event) => {
                  event.target.value = event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9-]/g, "")
                    .slice(0, 24)
                },
              })}
            />
            <FieldError errors={[form.formState.errors.warehouseCode]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="warehouse-type">Warehouse type</FieldLabel>
            <Controller
              control={form.control}
              name="warehouseType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="warehouse-type" className="w-full">
                    <SelectValue>{warehouseTypeLabels[field.value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {warehouseTypes.map((warehouseType) => (
                      <SelectItem key={warehouseType} value={warehouseType}>
                        {warehouseTypeLabels[warehouseType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="warehouse-capacity">Capacity</FieldLabel>
            <Input
              id="warehouse-capacity"
              placeholder="Optional"
              {...form.register("warehouseCapacity")}
            />
          </Field>
        </div>
      ) : null}

      <Field>
        <FieldLabel htmlFor="branch-notes">Operational notes</FieldLabel>
        <Textarea
          id="branch-notes"
          placeholder="Optional setup notes for this branch."
          className="min-h-24"
          {...form.register("notes")}
        />
      </Field>
    </FieldGroup>
  )
}

function AssignUsersStep({
  users,
  selectedUserIds,
  onSelectedUserIdsChange,
  isLoading,
}: {
  users: UserRecord[]
  selectedUserIds: string[]
  onSelectedUserIdsChange: (userIds: string[]) => void
  isLoading: boolean
}) {
  const assignableUsers = users.filter((user) => !user.isSystemManaged)

  function toggleUser(userId: string) {
    onSelectedUserIdsChange(
      selectedUserIds.includes(userId) ?
        selectedUserIds.filter((id) => id !== userId)
      : [...selectedUserIds, userId]
    )
  }

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">Assign users</h2>
        <p className="text-sm text-balance text-muted-foreground">
          Optionally assign staff to this branch now. You can manage detailed permissions from Users later.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border p-8 text-muted-foreground">
          <Spinner />
        </div>
      ) : null}

      {!isLoading && assignableUsers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No staff users are available yet. Create the branch now and add users from the Users section later.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {assignableUsers.map((user) => {
          const isSelected = selectedUserIds.includes(user.id)

          return (
            <button
              type="button"
              key={user.id}
              onClick={() => toggleUser(user.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                isSelected ?
                  "border-foreground bg-muted/40"
                : "border-border hover:bg-muted/20"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.designation || "Team member"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.contact}</p>
                </div>
                {isSelected ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckIcon className="size-3.5" />
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </FieldGroup>
  )
}

function ReviewStep({
  values,
  stateName,
  location,
  gstRegistration,
  warehouse,
  selectedUsers,
}: {
  values: Partial<AddBranchValues>
  stateName: string
  location: BusinessLocationRecord | null
  gstRegistration: GstRegistrationRecord | null
  warehouse: WarehouseRecord | null
  selectedUsers: UserRecord[]
}) {
  const warehouseValue =
    values.warehouseMode === "none" ? "No dedicated warehouse"
    : values.warehouseMode === "create" ? values.warehouseName || "New warehouse"
    : warehouse ? `${warehouse.name} (${warehouse.warehouseCode})`
    : "Existing warehouse not selected"
  const locationValue =
    values.locationMode === "existing" && location ?
      formatLocationOption(location)
    : `${values.city || values.district || "City not added"}, ${stateName}`
  const userValue =
    selectedUsers.length > 0 ?
      selectedUsers.map((user) => user.name).join(", ")
    : "No users assigned"

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-bold">Review branch setup</h2>
        <p className="text-sm text-balance text-muted-foreground">
          Confirm the branch, location, GST registration, and warehouse relationship before creating it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryItem
          icon={<StoreIcon className="size-4" />}
          label="Branch"
          value={`${values.branchName || "Not added"} • ${
            values.branchType ? branchTypeLabels[values.branchType] : "Retail store"
          }`}
        />
        <SummaryItem
          icon={<MapPinIcon className="size-4" />}
          label="Location"
          value={locationValue}
        />
        <SummaryItem
          icon={<Building2Icon className="size-4" />}
          label="GST registration"
          value={gstRegistration?.gstin ?? "Not selected"}
        />
        <SummaryItem
          icon={<WarehouseIcon className="size-4" />}
          label="Warehouse"
          value={warehouseValue}
        />
        <SummaryItem
          icon={<UsersIcon className="size-4" />}
          label="Users"
          value={userValue}
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        This setup supports the five branches plus one central warehouse model. You can link more branches to the same warehouse later from branch details.
      </div>
    </FieldGroup>
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
  const currentIndex = branchSteps.findIndex((step) => step.id === currentStep)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {branchSteps.map((step, index) => {
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
      <p className="min-w-0 truncate text-sm font-medium" title={value}>
        {value || "Not added"}
      </p>
    </div>
  )
}

function getNextStep(step: BranchStep) {
  const index = branchSteps.findIndex((item) => item.id === step)
  return branchSteps[Math.min(index + 1, branchSteps.length - 1)].id
}

function getPreviousStep(step: BranchStep) {
  const index = branchSteps.findIndex((item) => item.id === step)
  return branchSteps[Math.max(index - 1, 0)].id
}

function formatLocationOption(location: BusinessLocationRecord) {
  const addressParts = [
    location.name,
    location.city,
    location.district,
    location.state,
  ].filter(Boolean)

  return addressParts.join(", ")
}

function resolveSelectedLocation(
  locationId: string,
  locations: BusinessLocationRecord[]
) {
  const location = locations.find((item) => item.id === locationId)

  if (!location) {
    throw new Error("Selected location is no longer available.")
  }

  return location
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
