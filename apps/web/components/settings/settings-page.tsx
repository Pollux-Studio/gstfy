"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import {
  BadgeCheckIcon,
  BarcodeIcon,
  Building2Icon,
  CalendarIcon,
  FileTextIcon,
  Globe2Icon,
  KeyRoundIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SaveIcon,
  Settings2Icon,
  WarehouseIcon,
} from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getStoredAuthSession, setStoredAuthSession } from "@/lib/auth/session"
import {
  barcodeSubmitKeyOptions,
  getBarcodeSubmitKeyFromKeyboardEventKey,
  getBarcodeSubmitKeyLabel,
  normalizeBarcodeScannerSettings,
  persistBarcodeScannerSettings,
  readBarcodeScannerSettings,
  type BarcodeScannerConnectorSettings,
  type BarcodeScannerSubmitKey,
} from "@/lib/barcode-scanner/settings"
import { getAllGstStates } from "@/lib/gst-state"
import {
  getInventorySettings,
  updateInventorySettings,
  type InventorySettings,
} from "@/lib/inventory/api"
import {
  getInvoiceTemplateOption,
  getInvoiceTemplateOptions,
  invoiceTemplateCodes,
} from "@/lib/invoices/templates/shared/template-options"
import {
  getSettings,
  updateBusinessTenant,
  updateBusinessDetails,
  updateGstRateSettings,
  updateInvoiceSettings,
  updatePrinterSettings,
  verifyBusinessCaReferral,
  type SettingsResponse,
} from "@/lib/settings/api"
import { cn } from "@/lib/utils"

const phonePattern = /^\d{10}$/
const pincodePattern = /^\d{6}$/
const invoicePrefixPattern = /^[A-Z0-9-]{2,10}$/
const tenantSlugPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const reservedTenantSlugs = new Set([
  "api",
  "app",
  "auth",
  "admin",
  "www",
  "mail",
  "support",
  "gstfy",
])

const businessDetailsSchema = z.object({
  businessEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
  businessMobile: z.union([
    z.literal(""),
    z.string().trim().regex(phonePattern, "Enter a valid 10-digit Indian mobile number."),
  ]),
  primaryContactName: z.string().trim().min(1, "Enter the primary contact name."),
  primaryContactMobile: z
    .string()
    .trim()
    .regex(phonePattern, "Enter a valid 10-digit Indian mobile number."),
  primaryContactEmail: z
    .string()
    .trim()
    .email("Enter a valid email address."),
  principalAddressLine1: z.string().trim().min(1, "Enter address line 1."),
  principalAddressLine2: z.string().trim().optional().or(z.literal("")),
  locality: z.string().trim().min(1, "Enter the locality or area."),
  district: z.string().trim().min(1, "Enter the district."),
  pincode: z.string().trim().regex(pincodePattern, "Enter a valid 6-digit pincode."),
  possessionType: z.string().trim().min(1, "Enter the possession type."),
  registrationDate: z
    .union([
      z.literal(""),
      z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid registration date."),
    ])
    .optional(),
})

const invoiceSettingsSchema = z.object({
  salesInvoiceTemplate: z.enum(invoiceTemplateCodes),
  purchaseInvoiceTemplate: z.enum(invoiceTemplateCodes),
  invoicePrefix: z
    .string()
    .trim()
    .regex(invoicePrefixPattern, "Use 2 to 10 uppercase letters, numbers, or hyphens."),
  invoiceWatermarkText: z.string().trim().max(40, "Keep watermark text under 40 characters."),
})

const gstRateSettingsSchema = z.object({
  enabledGstSlabs: z
    .array(z.union([z.literal(5), z.literal(12), z.literal(18), z.literal(28)]))
    .min(1, "Enable at least one GST slab."),
  enabledCessPresetCodes: z.array(
    z.enum([
      "TOBACCO_CESS",
      "PAN_MASALA_CESS",
      "COAL_CESS",
      "AERATED_DRINK_CESS",
      "MOTOR_VEHICLE_CESS",
    ])
  ),
})

const printerSettingsSchema = z.object({
  paperSize: z.enum(["A4", "A5", "THERMAL_80MM"]),
  printOrientation: z.enum(["portrait", "landscape"]),
  autoOpenPrintDialog: z.boolean(),
  compactPrintLayout: z.boolean(),
})

type BusinessDetailsFormValues = z.infer<typeof businessDetailsSchema>
type InvoiceSettingsFormValues = z.infer<typeof invoiceSettingsSchema>
type GstRateSettingsFormValues = z.infer<typeof gstRateSettingsSchema>
type PrinterSettingsFormValues = z.infer<typeof printerSettingsSchema>

type BarcodeScannerTestResult = {
  value: string
  submitKey: BarcodeScannerSubmitKey
  durationMs: number | null
  capturedAt: string
}

const standardInvoiceTemplate = getInvoiceTemplateOptions("sales")[0]!

const gstSlabOptions = [5, 12, 18, 28] as const

const paperSizeOptions: Array<{
  value: SettingsResponse["printerSettings"]["paperSize"]
  label: string
}> = [
  { value: "A4", label: "A4" },
  { value: "A5", label: "A5" },
  { value: "THERMAL_80MM", label: "Thermal 80mm" },
]

const printerOrientationOptions: Array<{
  value: SettingsResponse["printerSettings"]["printOrientation"]
  label: string
}> = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
]

const negativeStockPolicyOptions: Array<{
  value: InventorySettings["negativeStockPolicy"]
  label: string
  description: string
}> = [
  {
    value: "BLOCK",
    label: "Block transactions",
    description: "Prevent sales, transfers, and adjustments that would make stock negative.",
  },
  {
    value: "WARN",
    label: "Warn and allow",
    description: "Show a warning but allow the transaction for controlled exceptions.",
  },
  {
    value: "ALLOW",
    label: "Allow silently",
    description: "Permit negative stock without interruption. Use only for loose stock control.",
  },
]

const valuationMethodOptions: Array<{
  value: InventorySettings["valuationMethod"]
  label: string
  description: string
}> = [
  {
    value: "WEIGHTED_AVERAGE",
    label: "Weighted average",
    description: "Recalculate average cost as stock is purchased or adjusted.",
  },
  {
    value: "FIFO",
    label: "FIFO foundation",
    description: "Keep FIFO configured for future batch-layer valuation workflows.",
  },
]

const possessionOptions = [
  { value: "own", label: "Own" },
  { value: "rented", label: "Rented" },
  { value: "leased", label: "Leased" },
  { value: "consent", label: "Consent" },
  { value: "shared", label: "Shared" },
  { value: "other", label: "Other" },
] as const

const settingsTabs = [
  {
    value: "business",
    label: "Business",
    description: "GST identity, contacts, CA link",
    icon: <Building2Icon className="size-4" />,
  },
  {
    value: "invoice",
    label: "Invoice",
    description: "Templates and numbering",
    icon: <FileTextIcon className="size-4" />,
  },
  {
    value: "gst",
    label: "GST Rate",
    description: "Enabled tax slabs",
    icon: <ReceiptTextIcon className="size-4" />,
  },
  {
    value: "printer",
    label: "Printer",
    description: "Paper and print behavior",
    icon: <PrinterIcon className="size-4" />,
  },
  {
    value: "inventory",
    label: "Inventory",
    description: "Stock posting policies",
    icon: <WarehouseIcon className="size-4" />,
  },
  {
    value: "connectors",
    label: "Connectors",
    description: "Scanners and local devices",
    icon: <BarcodeIcon className="size-4" />,
  },
] as const

export function SettingsPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [isBusinessEditing, setIsBusinessEditing] = React.useState(false)
  const [caReferralCode, setCaReferralCode] = React.useState("")
  const [tenantSlugDraft, setTenantSlugDraft] = React.useState<{
    sourceTenantSlug: string
    value: string
    error: string | null
  } | null>(null)
  const [isRegistrationDatePickerOpen, setIsRegistrationDatePickerOpen] =
    React.useState(false)
  const [barcodeScannerSettings, setBarcodeScannerSettings] =
    React.useState<BarcodeScannerConnectorSettings>(() => readBarcodeScannerSettings())
  const [barcodeTestValue, setBarcodeTestValue] = React.useState("")
  const [barcodeTestResult, setBarcodeTestResult] =
    React.useState<BarcodeScannerTestResult | null>(null)
  const barcodeTestStartRef = React.useRef<number | null>(null)

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })
  const inventorySettingsQuery = useQuery({
    queryKey: ["inventory", "settings"],
    queryFn: () => getInventorySettings(accessToken),
    enabled: accessToken.length > 0,
  })

  const businessForm = useForm<BusinessDetailsFormValues>({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: createBusinessDefaults(),
  })
  const invoiceForm = useForm<InvoiceSettingsFormValues>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: {
      salesInvoiceTemplate: "reference-01",
      purchaseInvoiceTemplate: "reference-01",
      invoicePrefix: "INV",
      invoiceWatermarkText: "GSTFY",
    },
  })
  const gstForm = useForm<GstRateSettingsFormValues>({
    resolver: zodResolver(gstRateSettingsSchema),
    defaultValues: {
      enabledGstSlabs: [5, 12, 18, 28],
      enabledCessPresetCodes: [],
    },
  })
  const printerForm = useForm<PrinterSettingsFormValues>({
    resolver: zodResolver(printerSettingsSchema),
    defaultValues: {
      paperSize: "A4",
      printOrientation: "portrait",
      autoOpenPrintDialog: true,
      compactPrintLayout: false,
    },
  })

  React.useEffect(() => {
    if (!data) {
      return
    }

    businessForm.reset({
      businessEmail: data.business.businessEmail ?? "",
      businessMobile: data.business.businessMobile ?? "",
      primaryContactName: data.business.primaryContactName,
      primaryContactMobile: data.business.primaryContactMobile,
      primaryContactEmail: data.business.primaryContactEmail,
      principalAddressLine1: data.registration.principalAddressLine1,
      principalAddressLine2: data.registration.principalAddressLine2 ?? "",
      locality: data.registration.locality,
      district: data.registration.district,
      pincode: data.registration.pincode,
      possessionType: data.registration.possessionType,
      registrationDate: data.registration.registrationDate,
    })
    invoiceForm.reset({
      salesInvoiceTemplate:
        data.invoiceSettings.salesInvoiceTemplate ?? data.invoiceSettings.invoiceTemplate,
      purchaseInvoiceTemplate:
        data.invoiceSettings.purchaseInvoiceTemplate ?? data.invoiceSettings.invoiceTemplate,
      invoicePrefix: data.invoiceSettings.invoicePrefix,
      invoiceWatermarkText: data.invoiceSettings.invoiceWatermarkText ?? "GSTFY",
    })
    gstForm.reset({
      enabledGstSlabs: data.gstRateSettings.enabledGstSlabs,
      enabledCessPresetCodes: data.gstRateSettings.cessPresets
        .filter((preset) => preset.enabled)
        .map((preset) => preset.code),
    })
    printerForm.reset({
      paperSize: data.printerSettings.paperSize,
      printOrientation: data.printerSettings.printOrientation,
      autoOpenPrintDialog: data.printerSettings.autoOpenPrintDialog,
      compactPrintLayout: data.printerSettings.compactPrintLayout,
    })
  }, [businessForm, data, gstForm, invoiceForm, printerForm])

  const invoicePreviewPrefix = useWatch({
    control: invoiceForm.control,
    name: "invoicePrefix",
  }) || "INV"
  const invoiceWatermarkText = useWatch({
    control: invoiceForm.control,
    name: "invoiceWatermarkText",
  }) ?? ""
  const currentEnabledSlabs = useWatch({
    control: gstForm.control,
    name: "enabledGstSlabs",
  })
  const currentEnabledCessPresetCodes = useWatch({
    control: gstForm.control,
    name: "enabledCessPresetCodes",
  })
  const autoOpenPrintDialog = useWatch({
    control: printerForm.control,
    name: "autoOpenPrintDialog",
  })
  const compactPrintLayout = useWatch({
    control: printerForm.control,
    name: "compactPrintLayout",
  })
  const registrationDateValue = useWatch({
    control: businessForm.control,
    name: "registrationDate",
  })
  const selectedRegistrationDate = registrationDateValue
    ? parseISO(registrationDateValue)
    : undefined
  const tenantSlugSourceValue = data?.business.tenantSlug ?? ""
  const tenantSlugInput =
    tenantSlugDraft?.sourceTenantSlug === tenantSlugSourceValue ?
      tenantSlugDraft.value
    : tenantSlugSourceValue
  const tenantSlugError =
    tenantSlugDraft?.sourceTenantSlug === tenantSlugSourceValue ?
      tenantSlugDraft.error
    : null

  function updateTenantSlugDraft(value: string, error: string | null = null) {
    setTenantSlugDraft({
      sourceTenantSlug: tenantSlugSourceValue,
      value,
      error,
    })
  }

  const businessMutation = useMutation({
    mutationFn: (values: BusinessDetailsFormValues) =>
      updateBusinessDetails(
        {
          businessEmail: values.businessEmail.trim() || null,
          businessMobile: values.businessMobile.trim() || null,
          primaryContactName: values.primaryContactName.trim(),
          primaryContactMobile: values.primaryContactMobile.trim(),
          primaryContactEmail: values.primaryContactEmail.trim(),
          principalAddressLine1: values.principalAddressLine1.trim(),
          principalAddressLine2: values.principalAddressLine2?.trim() || null,
          locality: values.locality.trim(),
          district: values.district.trim(),
          pincode: values.pincode.trim(),
          possessionType: values.possessionType.trim(),
          registrationDate:
            data?.registration.registrationDate ? undefined : (
              values.registrationDate?.trim() || null
            ),
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      setIsBusinessEditing(false)
      toast.success("Business details updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const tenantMutation = useMutation({
    mutationFn: () => {
      const tenantSlug = normalizeTenantSlugInput(tenantSlugInput)
      const validationError = getTenantSlugValidationError(tenantSlug)

      if (validationError) {
        updateTenantSlugDraft(tenantSlugInput, validationError)
        throw new Error(validationError)
      }

      return updateBusinessTenant({ tenantSlug }, accessToken)
    },
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      setTenantSlugDraft(null)

      const currentSession = getStoredAuthSession()

      if (currentSession) {
        setStoredAuthSession({
          accountType: currentSession.accountType,
          user: currentSession.user,
          session: currentSession.session,
          tenant: {
            id: nextSettings.business.id,
            slug: nextSettings.business.tenantSlug,
            legalName: nextSettings.business.legalName,
            tradeName: nextSettings.business.tradeName,
            url: nextSettings.business.tenantUrl,
          },
        })
      }

      toast.success("Workspace URL updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const caReferralMutation = useMutation({
    mutationFn: () =>
      verifyBusinessCaReferral(
        {
          referralCode: caReferralCode.trim().toUpperCase(),
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      setCaReferralCode(nextSettings.caReferral.referralCode ?? "")
      toast.success("CA referral verified and linked.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const invoiceMutation = useMutation({
    mutationFn: (values: InvoiceSettingsFormValues) =>
      updateInvoiceSettings(
        {
          invoiceTemplate: values.salesInvoiceTemplate,
          salesInvoiceTemplate: values.salesInvoiceTemplate,
          purchaseInvoiceTemplate: values.purchaseInvoiceTemplate,
          invoicePrefix: values.invoicePrefix.trim().toUpperCase(),
          invoiceWatermarkText: values.invoiceWatermarkText.trim(),
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      toast.success("Invoice settings updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const gstMutation = useMutation({
    mutationFn: (values: GstRateSettingsFormValues) =>
      updateGstRateSettings(
        {
          enabledGstSlabs: values.enabledGstSlabs,
          enabledCessPresetCodes: values.enabledCessPresetCodes,
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      queryClient.invalidateQueries({ queryKey: ["tax", "rules"] })
      toast.success("GST presets updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const printerMutation = useMutation({
    mutationFn: (values: PrinterSettingsFormValues) =>
      updatePrinterSettings(values, accessToken),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      toast.success("Printer settings updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })
  const inventoryMutation = useMutation({
    mutationFn: (
      values: Partial<
        Pick<InventorySettings, "negativeStockPolicy" | "valuationMethod">
      >
    ) => updateInventorySettings(values, accessToken),
    onSuccess: (nextInventorySettings) => {
      queryClient.setQueryData(["inventory", "settings"], nextInventorySettings)
      toast.success("Inventory policy updated.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const businessStateMeta =
    data ?
      getAllGstStates().find((state) => state.code === data.registration.stateCode) ?? null
    : null

  if (isLoading) {
    return <SettingsPageSkeleton />
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card/80 p-6">
          <h1 className="text-lg font-semibold">Settings unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load the workspace settings right now."}
          </p>
        </section>
      </div>
    )
  }

  const canEditBusiness = data.permissions.canEditBusiness
  const canSetRegistrationDate =
    canEditBusiness && data.registration.registrationDate.trim().length === 0
  const isCaReferralLinked = data.caReferral.status === "linked"
  const canAddCaReferral = canEditBusiness && data.caReferral.canAdd
  const caReferralInputValue =
    isCaReferralLinked ? data.caReferral.referralCode ?? "" : caReferralCode
  const currentTenantSlug = normalizeTenantSlugInput(data.business.tenantSlug)
  const normalizedTenantSlugInput = normalizeTenantSlugInput(tenantSlugInput)
  const hasWorkspaceUrl = currentTenantSlug.length > 0
  const tenantDisplayUrl =
    data.business.tenantUrl ||
    (currentTenantSlug ? `${currentTenantSlug}.gstfy.in` : "Not set")
  const inventorySettings = inventorySettingsQuery.data?.settings

  function updateBarcodeScannerSettings(
    nextSettings: Partial<BarcodeScannerConnectorSettings>
  ) {
    setBarcodeScannerSettings((currentSettings) => ({
      ...currentSettings,
      ...nextSettings,
    }))
  }

  function saveBarcodeScannerSettings() {
    const nextSettings = normalizeBarcodeScannerSettings({
      ...barcodeScannerSettings,
      updatedAt: new Date().toISOString(),
    })

    setBarcodeScannerSettings(nextSettings)
    persistBarcodeScannerSettings(nextSettings)
    toast.success("Barcode scanner connector saved.")
  }

  function handleBarcodeTestChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (barcodeTestStartRef.current === null) {
      barcodeTestStartRef.current = performance.now()
    }

    setBarcodeTestValue(event.target.value)
  }

  function handleBarcodeTestKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const submitKey = getBarcodeSubmitKeyFromKeyboardEventKey(event.key)

    if (!submitKey) {
      return
    }

    event.preventDefault()

    const value = barcodeTestValue.trim()

    if (value.length < barcodeScannerSettings.minLength) {
      toast.error(`Scan at least ${barcodeScannerSettings.minLength} characters.`)
      return
    }

    setBarcodeTestResult({
      value,
      submitKey,
      durationMs:
        barcodeTestStartRef.current === null ?
          null
        : Math.max(0, Math.round(performance.now() - barcodeTestStartRef.current)),
      capturedAt: new Date().toISOString(),
    })

    updateBarcodeScannerSettings({ submitKey })
  }

  return (
    <Tabs defaultValue="business" className="contents">
      <div className="grid w-full flex-1 p-3 pt-3 sm:p-4 lg:grid-cols-[164px_minmax(0,760px)] lg:gap-8 lg:p-5 lg:pt-4 xl:grid-cols-[176px_minmax(0,760px)] xl:gap-7">
        <aside className="hidden lg:block">
          <div className="sticky top-20 pr-4">
            <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Settings
            </p>
            <TabsList className="flex h-auto flex-col gap-0.5 rounded-none border-0 bg-transparent p-0 shadow-none">
              {settingsTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-auto w-full justify-start gap-2 rounded-none bg-transparent px-2 py-1.5 text-sm font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:hover:text-blue-400 dark:data-[state=active]:text-blue-400"
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <section className="scroll-mt-20 border-b border-border pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Settings2Icon className="size-4 text-muted-foreground" />
                <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
              </div>
              <Badge
                variant="outline"
                className="w-fit gap-1.5 bg-background font-mono text-[11px] tracking-[0.16em]"
              >
                <ReceiptTextIcon className="size-3.5" />
                {data.registration.gstin}
              </Badge>
            </div>
          </section>

          <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-none border-0 bg-transparent p-0 shadow-none lg:hidden">
            {settingsTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="justify-start gap-2 rounded-none bg-transparent px-0 py-2 text-sm font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:hover:text-blue-400 dark:data-[state=active]:text-blue-400"
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

        <TabsContent value="business" className="mt-0">
          <SettingsSection
            icon={<Building2Icon className="size-4" />}
            title="Business details"
            description="Registration identity stays locked. Contact details and the principal place of business can be updated here."
            badgeLabel={canEditBusiness ? "Business admin" : "View only"}
          >
            <form onSubmit={businessForm.handleSubmit((values) => businessMutation.mutate(values))}>
              <div className="space-y-6">
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReadOnlyDetail
                      className="sm:col-span-2"
                      label="Legal business name"
                      value={data.business.legalName}
                    />
                    <ReadOnlyDetail label="Trade name" value={data.business.tradeName} />
                    <ReadOnlyDetail
                      label="State / UT"
                      value={businessStateMeta?.name ?? data.registration.stateCode}
                    />
                    <ReadOnlyDetail label="GSTIN" value={data.registration.gstin} mono />
                    <ReadOnlyDetail label="PAN" value={data.business.pan} mono />
                    <ReadOnlyDetail
                      label="Constitution"
                      value={formatTitleCase(data.business.constitution)}
                    />
                    <ReadOnlyDetail
                      label="Taxpayer type"
                      value={formatTitleCase(data.registration.taxpayerType)}
                    />
                    <ReadOnlyDetail
                      label="Effective registration date"
                      value={
                        data.registration.registrationDate ?
                          formatDate(data.registration.registrationDate)
                        : "Not added"
                      }
                    />
                  </div>

                  <section className="rounded-xl border border-border bg-background px-3 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe2Icon className="size-4 text-muted-foreground" />
                          <h3 className="text-sm font-medium">Workspace URL</h3>
                        </div>
                        {hasWorkspaceUrl ? (
                          <>
                            <div className="flex min-w-0 items-center rounded-lg border border-border bg-muted/30 px-3 py-2">
                              <p
                                className="min-w-0 truncate font-mono text-sm tracking-[0.08em]"
                                title={tenantDisplayUrl}
                              >
                                {tenantDisplayUrl}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Workspace URL is locked after creation.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/50">
                              <Input
                                id="settings-tenant-slug"
                                value={tenantSlugInput}
                                onChange={(event) => {
                                  updateTenantSlugDraft(
                                    normalizeTenantSlugInput(event.target.value)
                                  )
                                }}
                                maxLength={48}
                                disabled={!canEditBusiness || tenantMutation.isPending}
                                className="h-8 flex-1 rounded-r-none border-0 bg-transparent font-mono text-sm tracking-[0.08em] shadow-none focus-visible:ring-0"
                                placeholder={createTenantSlugSuggestion(data.business.tradeName)}
                              />
                              <span className="shrink-0 border-l border-border px-2 text-xs text-muted-foreground">
                                .gstfy.in
                              </span>
                            </div>
                            <p
                              className={cn(
                                "text-xs",
                                tenantSlugError ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              {tenantSlugError || "Generate a URL for this legacy workspace."}
                            </p>
                          </>
                        )}
                      </div>
                      {!hasWorkspaceUrl ? (
                        <div className="flex gap-2 md:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!canEditBusiness || tenantMutation.isPending}
                            onClick={() => {
                              updateTenantSlugDraft(
                                createTenantSlugSuggestion(data.business.tradeName)
                              )
                            }}
                          >
                            <RefreshCwIcon className="size-4" />
                            Generate
                          </Button>
                          <Button
                            type="button"
                            disabled={
                              !canEditBusiness ||
                              tenantMutation.isPending ||
                              normalizedTenantSlugInput.length === 0
                            }
                            onClick={() => tenantMutation.mutate()}
                          >
                            {tenantMutation.isPending ? (
                              <Spinner />
                            ) : (
                              <SaveIcon className="size-4" />
                            )}
                            Save URL
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <FieldGroup>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Building2Icon className="size-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Editable details</h3>
                      </div>
                      {!isBusinessEditing ? (
                        <span className="text-xs text-muted-foreground">
                          Click edit to update contacts and address.
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="settings-business-email">Business email</FieldLabel>
                        <Input
                          id="settings-business-email"
                          placeholder="billing@gstfy.in"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("businessEmail")}
                        />
                        <FieldError errors={[businessForm.formState.errors.businessEmail]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-business-mobile">Business mobile</FieldLabel>
                        <IndianPhoneInput
                          id="settings-business-mobile"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("businessMobile")}
                        />
                        <FieldError errors={[businessForm.formState.errors.businessMobile]} />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="settings-primary-contact-name">
                          Primary contact name
                        </FieldLabel>
                        <Input
                          id="settings-primary-contact-name"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("primaryContactName")}
                        />
                        <FieldError errors={[businessForm.formState.errors.primaryContactName]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-primary-contact-mobile">
                          Primary contact mobile
                        </FieldLabel>
                        <IndianPhoneInput
                          id="settings-primary-contact-mobile"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("primaryContactMobile")}
                        />
                        <FieldError errors={[businessForm.formState.errors.primaryContactMobile]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-primary-contact-email">
                          Primary contact email
                        </FieldLabel>
                        <Input
                          id="settings-primary-contact-email"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("primaryContactEmail")}
                        />
                        <FieldError errors={[businessForm.formState.errors.primaryContactEmail]} />
                      </Field>
                    </div>

                    {canSetRegistrationDate ? (
                      <Field>
                        <FieldLabel htmlFor="settings-registration-date">
                          Effective registration date
                        </FieldLabel>
                        <PopoverPrimitive.Root
                          open={isRegistrationDatePickerOpen}
                          onOpenChange={setIsRegistrationDatePickerOpen}
                        >
                          <PopoverPrimitive.Trigger
                            render={
                              <Button
                                type="button"
                                id="settings-registration-date"
                                variant="outline"
                                disabled={!isBusinessEditing || !canEditBusiness}
                                aria-invalid={Boolean(
                                  businessForm.formState.errors.registrationDate
                                )}
                                className={cn(
                                  "h-8 w-full justify-between rounded-lg border-input px-2.5 text-left text-sm font-normal",
                                  !registrationDateValue && "text-muted-foreground"
                                )}
                              >
                                <span>
                                  {selectedRegistrationDate
                                    ? format(selectedRegistrationDate, "dd MMM yyyy")
                                    : "DD MMM YYYY"}
                                </span>
                                <CalendarIcon className="size-4 text-muted-foreground" />
                              </Button>
                            }
                          />
                          <PopoverPrimitive.Portal>
                            <PopoverPrimitive.Positioner
                              side="bottom"
                              sideOffset={4}
                              align="start"
                              className="isolate z-50"
                            >
                              <PopoverPrimitive.Popup
                                data-slot="popover-content"
                                className="relative z-50 w-auto rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-md outline-hidden transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
                              >
                                <Calendar
                                  mode="single"
                                  selected={selectedRegistrationDate}
                                  onSelect={(date) => {
                                    businessForm.setValue(
                                      "registrationDate",
                                      date ? format(date, "yyyy-MM-dd") : "",
                                      {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      }
                                    )
                                    setIsRegistrationDatePickerOpen(false)
                                  }}
                                />
                              </PopoverPrimitive.Popup>
                            </PopoverPrimitive.Positioner>
                          </PopoverPrimitive.Portal>
                        </PopoverPrimitive.Root>
                        <FieldError errors={[businessForm.formState.errors.registrationDate]} />
                      </Field>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="settings-address-line-1">
                          Principal address line 1
                        </FieldLabel>
                        <Input
                          id="settings-address-line-1"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("principalAddressLine1")}
                        />
                        <FieldError errors={[businessForm.formState.errors.principalAddressLine1]} />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="settings-address-line-2">
                          Principal address line 2
                        </FieldLabel>
                        <Input
                          id="settings-address-line-2"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("principalAddressLine2")}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="settings-locality">Locality / area</FieldLabel>
                        <Input
                          id="settings-locality"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("locality")}
                        />
                        <FieldError errors={[businessForm.formState.errors.locality]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-district">District</FieldLabel>
                        <Input
                          id="settings-district"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("district")}
                        />
                        <FieldError errors={[businessForm.formState.errors.district]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-pincode">Pincode</FieldLabel>
                        <Input
                          id="settings-pincode"
                          inputMode="numeric"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("pincode")}
                        />
                        <FieldError errors={[businessForm.formState.errors.pincode]} />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="settings-possession-type">
                          Nature of possession
                        </FieldLabel>
                        <Controller
                          control={businessForm.control}
                          name="possessionType"
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isBusinessEditing || !canEditBusiness}
                            >
                              <SelectTrigger id="settings-possession-type" className="w-full">
                                <SelectDisplayValue
                                  value={field.value}
                                  options={possessionOptions}
                                  placeholder="Choose possession type"
                                />
                              </SelectTrigger>
                              <SelectContent align="start">
                                {possessionOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError errors={[businessForm.formState.errors.possessionType]} />
                      </Field>
                    </div>
                  </FieldGroup>
                </div>

                <div className="space-y-4 border-t border-border pt-5">
                  <section className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border",
                          isCaReferralLinked
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                        )}
                      >
                        {isCaReferralLinked ? (
                          <BadgeCheckIcon className="size-4" />
                        ) : (
                          <KeyRoundIcon className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">CA referral</h3>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                              isCaReferralLinked
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            )}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {isCaReferralLinked ? "Connected" : "Required"}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {isCaReferralLinked
                            ? `This workspace is connected to ${data.caReferral.practiceName ?? "your CA"} for client filing access.`
                            : "Enter the referral code shared by your CA. Once verified, it becomes locked for this business."}
                        </p>
                      </div>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="settings-ca-referral-code">
                        Referral code
                      </FieldLabel>
                      <Input
                        id="settings-ca-referral-code"
                        value={caReferralInputValue}
                        onChange={(event) =>
                          setCaReferralCode(event.target.value.toUpperCase().slice(0, 40))
                        }
                        placeholder="GSTFY-XXXXXXXX"
                        disabled={!canAddCaReferral || caReferralMutation.isPending}
                        className="font-mono uppercase tracking-[0.18em]"
                      />
                      <FieldDescription>
                        {isCaReferralLinked && data.caReferral.linkedAt
                          ? `Verified on ${formatDate(data.caReferral.linkedAt)}. This code cannot be changed.`
                          : "We verify the code before saving the CA relationship."}
                      </FieldDescription>
                    </Field>

                    {!isCaReferralLinked ? (
                      <Button
                        type="button"
                        className="w-full"
                        disabled={
                          !canAddCaReferral ||
                          caReferralMutation.isPending ||
                          caReferralCode.trim().length === 0
                        }
                        onClick={() => caReferralMutation.mutate()}
                      >
                        {caReferralMutation.isPending ? (
                          <Spinner />
                        ) : (
                          <BadgeCheckIcon className="size-4" />
                        )}
                        Verify and save
                      </Button>
                    ) : null}
                  </section>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                {isBusinessEditing ?
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        businessForm.reset(createBusinessDefaults(data))
                        setIsBusinessEditing(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={businessMutation.isPending || !canEditBusiness}
                    >
                      {businessMutation.isPending ? (
                        <Spinner />
                      ) : (
                        <SaveIcon className="size-4" />
                      )}
                      Save business details
                    </Button>
                  </>
                : <Button
                    type="button"
                    disabled={!canEditBusiness}
                    onClick={() => setIsBusinessEditing(true)}
                  >
                    Edit business details
                  </Button>
                }
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="invoice" className="mt-0">
          <SettingsSection
            icon={<FileTextIcon className="size-4" />}
            title="Invoice settings"
            description="Set the default invoice style and numbering prefix used when new sales invoices are created."
          >
            <form onSubmit={invoiceForm.handleSubmit((values) => invoiceMutation.mutate(values))}>
              <FieldGroup>
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Invoice template</FieldLabel>
                    <Badge
                      variant="outline"
                      className="bg-background font-mono text-[11px] uppercase tracking-[0.14em]"
                    >
                      {standardInvoiceTemplate.code}
                    </Badge>
                  </div>
                  <div className="grid gap-4 rounded-2xl border border-border bg-background p-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                    <InvoiceTemplatePreview
                      prefix={invoicePreviewPrefix || "INV"}
                      selected
                    />
                    <div className="flex min-w-0 flex-col justify-center gap-2">
                      <p className="text-sm font-medium">{standardInvoiceTemplate.label}</p>
                      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                        {standardInvoiceTemplate.description} The same layout is used for sales
                        invoices and purchase invoice exports.
                      </p>
                      <Badge className="w-fit">Selected</Badge>
                    </div>
                  </div>
                  <FieldDescription>
                    All document samples use the same GST invoice structure, so GSTFY keeps one
                    standard invoice template.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-invoice-prefix">Invoice number prefix</FieldLabel>
                  <Input
                    id="settings-invoice-prefix"
                    value={invoicePreviewPrefix}
                    onChange={(event) =>
                      invoiceForm.setValue(
                        "invoicePrefix",
                        event.target.value.toUpperCase(),
                        { shouldDirty: true, shouldValidate: true }
                      )
                    }
                    className="font-mono uppercase tracking-[0.18em]"
                    placeholder="INV"
                    disabled={!canEditBusiness}
                  />
                  <FieldDescription>
                    Prefix is limited to uppercase letters, numbers, and hyphens.
                  </FieldDescription>
                  <FieldError errors={[invoiceForm.formState.errors.invoicePrefix]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-invoice-watermark">
                    Invoice watermark text
                  </FieldLabel>
                  <Input
                    id="settings-invoice-watermark"
                    value={invoiceWatermarkText}
                    onChange={(event) =>
                      invoiceForm.setValue("invoiceWatermarkText", event.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    className="uppercase tracking-[0.18em]"
                    placeholder="GSTFY"
                    disabled={!canEditBusiness}
                    maxLength={40}
                  />
                  <FieldDescription>
                    Printed as a light background watermark. Leave blank to hide it.
                  </FieldDescription>
                  <FieldError errors={[invoiceForm.formState.errors.invoiceWatermarkText]} />
                </Field>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Preview</p>
                      <p className="text-sm text-muted-foreground">
                        {getTemplateLabel()} template
                      </p>
                    </div>
                    <Badge className="gap-1.5 font-mono">
                      <BadgeCheckIcon className="size-3.5" />
                      {`${invoicePreviewPrefix || "INV"}-2026-0001`}
                    </Badge>
                  </div>
                </div>
              </FieldGroup>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button type="submit" disabled={invoiceMutation.isPending || !canEditBusiness}>
                  {invoiceMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  Save invoice settings
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="gst" className="mt-0">
          <SettingsSection
            icon={<ReceiptTextIcon className="size-4" />}
            title="GST rate slabs"
            description="Control which GST slabs appear while creating invoices. Product-level tax can still differ by HSN."
          >
            <form onSubmit={gstForm.handleSubmit((values) => gstMutation.mutate(values))}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Enabled invoice slabs</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {gstSlabOptions.map((slab) => {
                      const isActive = currentEnabledSlabs.includes(slab)

                      return (
                        <Button
                          key={slab}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          className="min-w-16"
                          disabled={!canEditBusiness}
                          onClick={() => {
                            const nextSlabs = toggleGstSlab(currentEnabledSlabs, slab)
                            gstForm.setValue("enabledGstSlabs", nextSlabs, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }}
                        >
                          {slab}%
                        </Button>
                      )
                    })}
                  </div>
                  <FieldDescription>
                    Enable only the slabs your team should see as invoice choices.
                  </FieldDescription>
                  <FieldError errors={[gstForm.formState.errors.enabledGstSlabs]} />
                </Field>
              </FieldGroup>

              <div className="mt-5 border-t border-border pt-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Compensation cess categories</FieldLabel>
                    <FieldDescription>
                      Does {data.business.tradeName || data.business.legalName} sell any products
                      that may attract GST compensation cess? Enable only the categories you need in
                      the product master.
                    </FieldDescription>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {data.gstRateSettings.cessPresets.map((preset) => {
                        const isActive = currentEnabledCessPresetCodes.includes(preset.code)

                        return (
                          <button
                            key={preset.code}
                            type="button"
                            disabled={!canEditBusiness}
                            className={cn(
                              "group flex min-h-24 flex-col rounded-2xl border p-3 text-left transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "border-blue-500/70 bg-blue-50/70 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
                                : "border-border bg-background hover:bg-muted/30",
                              !canEditBusiness && "cursor-not-allowed opacity-60"
                            )}
                            onClick={() => {
                              gstForm.setValue(
                                "enabledCessPresetCodes",
                                toggleCessPresetCode(
                                  currentEnabledCessPresetCodes,
                                  preset.code
                                ),
                                {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                }
                              )
                            }}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {preset.label}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                  {preset.description}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                  isActive
                                    ? "border-blue-500 bg-blue-500"
                                    : "border-border bg-background"
                                )}
                              >
                                {isActive ? (
                                  <span className="size-1.5 rounded-full bg-white" />
                                ) : null}
                              </span>
                            </span>
                            <span className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              {preset.code}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <FieldDescription>
                      These are system-created product-selectable cess rules. Exact cess rates must
                      be reviewed before live billing because compensation cess depends on notified
                      goods and can change.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </div>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button type="submit" disabled={gstMutation.isPending || !canEditBusiness}>
                  {gstMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  Save GST presets
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="printer" className="mt-0">
          <SettingsSection
            icon={<PrinterIcon className="size-4" />}
            title="Printer settings"
            description="These preferences shape browser-based invoice printing and PDF print layouts. GSTFY does not bind to a physical printer device from the web app."
          >
            <form onSubmit={printerForm.handleSubmit((values) => printerMutation.mutate(values))}>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-paper-size">Paper size</FieldLabel>
                    <Controller
                      control={printerForm.control}
                      name="paperSize"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(value) =>
                            field.onChange(value as SettingsResponse["printerSettings"]["paperSize"])
                          }
                        >
                          <SelectTrigger id="settings-paper-size" className="w-full">
                            <SelectDisplayValue
                              value={field.value}
                              options={paperSizeOptions}
                              placeholder="Choose paper size"
                            />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {paperSizeOptions.map((paperSize) => (
                              <SelectItem key={paperSize.value} value={paperSize.value}>
                                {paperSize.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="settings-print-orientation">Orientation</FieldLabel>
                    <Controller
                      control={printerForm.control}
                      name="printOrientation"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(value) =>
                            field.onChange(
                              value as SettingsResponse["printerSettings"]["printOrientation"]
                            )
                          }
                        >
                          <SelectTrigger id="settings-print-orientation" className="w-full">
                            <SelectDisplayValue
                              value={field.value}
                              options={printerOrientationOptions}
                              placeholder="Choose orientation"
                            />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {printerOrientationOptions.map((orientation) => (
                              <SelectItem key={orientation.value} value={orientation.value}>
                                {orientation.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Open browser print dialog automatically</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={autoOpenPrintDialog ? "default" : "outline"}
                      disabled={!canEditBusiness}
                      onClick={() =>
                        printerForm.setValue("autoOpenPrintDialog", true, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={!autoOpenPrintDialog ? "default" : "outline"}
                      disabled={!canEditBusiness}
                      onClick={() =>
                        printerForm.setValue("autoOpenPrintDialog", false, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      No
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>Compact print layout</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={compactPrintLayout ? "default" : "outline"}
                      disabled={!canEditBusiness}
                      onClick={() =>
                        printerForm.setValue("compactPrintLayout", true, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      Enabled
                    </Button>
                    <Button
                      type="button"
                      variant={!compactPrintLayout ? "default" : "outline"}
                      disabled={!canEditBusiness}
                      onClick={() =>
                        printerForm.setValue("compactPrintLayout", false, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      Disabled
                    </Button>
                  </div>
                  <FieldDescription>
                    Compact layout reduces spacing for tighter printouts on smaller formats.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button type="submit" disabled={printerMutation.isPending || !canEditBusiness}>
                  {printerMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  Save printer settings
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="inventory" className="mt-0">
          <SettingsSection
            icon={<WarehouseIcon className="size-4" />}
            title="Inventory policy"
            description="Control how stock postings behave across product stock, POS, sales, purchases, transfers, and adjustments."
            badgeLabel={
              inventorySettings?.valuationMethod === "FIFO" ?
                "FIFO configured"
              : "Weighted average"
            }
          >
            {inventorySettingsQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            ) : (
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-negative-stock-policy">
                      Negative stock policy
                    </FieldLabel>
                    <Select
                      value={inventorySettings?.negativeStockPolicy ?? "WARN"}
                      disabled={!canEditBusiness || inventoryMutation.isPending}
                      onValueChange={(value) =>
                        inventoryMutation.mutate({
                          negativeStockPolicy:
                            value as InventorySettings["negativeStockPolicy"],
                        })
                      }
                    >
                      <SelectTrigger
                        id="settings-negative-stock-policy"
                        className="w-full"
                      >
                        <SelectDisplayValue
                          value={inventorySettings?.negativeStockPolicy ?? "WARN"}
                          options={negativeStockPolicyOptions}
                          placeholder="Choose negative stock policy"
                        />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {negativeStockPolicyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {
                        negativeStockPolicyOptions.find(
                          (option) =>
                            option.value ===
                            (inventorySettings?.negativeStockPolicy ?? "WARN")
                        )?.description
                      }
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="settings-valuation-method">
                      Valuation method
                    </FieldLabel>
                    <Select
                      value={inventorySettings?.valuationMethod ?? "WEIGHTED_AVERAGE"}
                      disabled={!canEditBusiness || inventoryMutation.isPending}
                      onValueChange={(value) =>
                        inventoryMutation.mutate({
                          valuationMethod:
                            value as InventorySettings["valuationMethod"],
                        })
                      }
                    >
                      <SelectTrigger id="settings-valuation-method" className="w-full">
                        <SelectDisplayValue
                          value={
                            inventorySettings?.valuationMethod ?? "WEIGHTED_AVERAGE"
                          }
                          options={valuationMethodOptions}
                          placeholder="Choose valuation method"
                        />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {valuationMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {
                        valuationMethodOptions.find(
                          (option) =>
                            option.value ===
                            (inventorySettings?.valuationMethod ?? "WEIGHTED_AVERAGE")
                        )?.description
                      }
                    </FieldDescription>
                  </Field>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Posting behavior</h3>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Inventory screens now focus on operational work. Policy changes
                        live here so stock controls are configured once for the whole
                        business.
                      </p>
                    </div>
                    {inventoryMutation.isPending ? (
                      <Badge variant="outline" className="w-fit gap-1.5 bg-background">
                        <Spinner className="size-3.5" />
                        Saving
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-fit bg-background">
                        Auto-saved
                      </Badge>
                    )}
                  </div>
                </div>
              </FieldGroup>
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="connectors" className="mt-0">
          <SettingsSection
            icon={<BarcodeIcon className="size-4" />}
            title="Connectors"
            badgeLabel={barcodeScannerSettings.enabled ? "Scanner enabled" : "Scanner disabled"}
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">Barcode scanner</p>
                      <Badge variant="outline" className="bg-background">
                        Keyboard mode
                      </Badge>
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      USB and Bluetooth barcode scanners usually work like a keyboard. Connect the
                      scanner, place the cursor in a barcode field, then scan. GSTFY listens for the
                      configured suffix key.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="w-fit gap-1.5 bg-background text-[11px]"
                  >
                    <BadgeCheckIcon className="size-3.5" />
                    Saved on this device
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Test scanner input</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Click the input, scan one product barcode, then check the detected result.
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-muted/40">
                      HID
                    </Badge>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="settings-barcode-test">Scan test</FieldLabel>
                      <Input
                        id="settings-barcode-test"
                        value={barcodeTestValue}
                        placeholder="Click here and scan a barcode"
                        className="font-mono"
                        autoComplete="off"
                        onFocus={() => {
                          barcodeTestStartRef.current = performance.now()
                        }}
                        onChange={handleBarcodeTestChange}
                        onKeyDown={handleBarcodeTestKeyDown}
                      />
                      <FieldDescription>
                        If your scanner can be configured, set its suffix to Enter or Tab.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <div className="mt-4 grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                    <ConnectorDetail
                      label="Detected barcode"
                      value={barcodeTestResult?.value ?? "No scan captured yet"}
                      mono={Boolean(barcodeTestResult)}
                    />
                    <ConnectorDetail
                      label="Detected suffix"
                      value={
                        barcodeTestResult ?
                          getBarcodeSubmitKeyLabel(barcodeTestResult.submitKey)
                        : "Waiting for Enter or Tab"
                      }
                    />
                    <ConnectorDetail
                      label="Scan speed"
                      value={
                        barcodeTestResult?.durationMs === null || !barcodeTestResult ?
                          "Not measured"
                        : `${barcodeTestResult.durationMs} ms`
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setBarcodeTestValue("")
                        setBarcodeTestResult(null)
                        barcodeTestStartRef.current = null
                      }}
                    >
                      Clear test
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium">Scanner behavior</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      These preferences are used by this browser/device for product and POS barcode
                      fields.
                    </p>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="settings-barcode-submit-key">Suffix key</FieldLabel>
                      <Select
                        value={barcodeScannerSettings.submitKey}
                        onValueChange={(value) =>
                          updateBarcodeScannerSettings({
                            submitKey: value as BarcodeScannerSubmitKey,
                          })
                        }
                      >
                        <SelectTrigger id="settings-barcode-submit-key" className="w-full">
                          <SelectDisplayValue
                            value={barcodeScannerSettings.submitKey}
                            options={barcodeSubmitKeyOptions}
                            placeholder="Choose suffix key"
                          />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {barcodeSubmitKeyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="settings-barcode-min-length">
                        Minimum barcode length
                      </FieldLabel>
                      <Input
                        id="settings-barcode-min-length"
                        type="number"
                        min={4}
                        max={32}
                        value={barcodeScannerSettings.minLength}
                        onChange={(event) =>
                          updateBarcodeScannerSettings({
                            minLength: Number.parseInt(event.target.value, 10) || 8,
                          })
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Connector status</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={barcodeScannerSettings.enabled ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ enabled: true })}
                        >
                          Enabled
                        </Button>
                        <Button
                          type="button"
                          variant={!barcodeScannerSettings.enabled ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ enabled: false })}
                        >
                          Disabled
                        </Button>
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel>Auto-search after scan</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={barcodeScannerSettings.autoSearch ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ autoSearch: true })}
                        >
                          Enabled
                        </Button>
                        <Button
                          type="button"
                          variant={!barcodeScannerSettings.autoSearch ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ autoSearch: false })}
                        >
                          Disabled
                        </Button>
                      </div>
                      <FieldDescription>
                        When enabled, POS/product fields can search immediately after the scanner
                        suffix is received.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Last saved:{" "}
                      {barcodeScannerSettings.updatedAt ?
                        formatDateTime(barcodeScannerSettings.updatedAt)
                      : "Not saved yet"}
                    </p>
                    <Button type="button" onClick={saveBarcodeScannerSettings}>
                      <SaveIcon className="size-4" />
                      Save connector
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>
        </TabsContent>
        </main>
      </div>
    </Tabs>
  )
}

function SettingsSection({
  icon,
  title,
  badgeLabel,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  badgeLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="scroll-mt-20 border-b border-border pb-6">
      <div className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{icon}</span>
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
          </div>
          {badgeLabel ? (
            <Badge variant="outline" className="bg-background">
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function InvoiceTemplatePreview({
  prefix,
  selected,
}: {
  prefix: string
  selected: boolean
}) {
  const templateOption = getInvoiceTemplateOption()

  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-xl border bg-white p-2 text-zinc-950",
        selected ? "border-foreground" : "border-border"
      )}
    >
      <div className="flex h-full flex-col border border-zinc-950 text-[7px] leading-tight">
        <div className="grid grid-cols-[1.15fr_0.85fr] border-b border-zinc-950">
          <div className="space-y-1 border-r border-zinc-950 p-1.5">
            <p className="truncate text-[8px] font-bold">{templateOption.sampleSeller}</p>
            <div className="h-1 w-24 rounded bg-zinc-300" />
            <div className="h-1 w-20 rounded bg-zinc-200" />
            <p className="font-mono text-[6px]">GSTIN/UIN : 09XXXXXXXXX1Z1</p>
          </div>
          <div className="grid grid-cols-2">
            {["Invoice No.", "Dated", "Delivery Note", "Mode/Terms"].map((label, index) => (
              <div
                key={label}
                className={cn(
                  "border-zinc-950 p-1",
                  index % 2 === 0 && "border-r",
                  index < 2 && "border-b"
                )}
              >
                <p className="text-[5px] text-zinc-500">{label}</p>
                <p className="truncate font-mono text-[6px]">
                  {index === 0 ? `${prefix}-2026-0001` : index === 1 ? "01-Apr-24" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1.15fr_0.85fr] border-b border-zinc-950">
          <div className="space-y-1 border-r border-zinc-950 p-1.5">
            <p className="text-[5px] text-zinc-500">Buyer (Bill to)</p>
            <div className="h-1.5 w-24 rounded bg-zinc-800" />
            <div className="h-1 w-28 rounded bg-zinc-200" />
            <div className="h-1 w-16 rounded bg-zinc-200" />
          </div>
          <div className="grid grid-cols-2">
            {["Reference", "Order No.", "Dispatch", "Destination"].map((label, index) => (
              <div
                key={label}
                className={cn(
                  "border-zinc-950 p-1",
                  index % 2 === 0 && "border-r",
                  index < 2 && "border-b"
                )}
              >
                <p className="text-[5px] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1.2rem_1fr_2rem_2rem_2.2rem_2rem_2.4rem] border-b border-zinc-950 text-[5px] font-semibold">
          {["Sl", "Description of Goods", "HSN/SAC", "GST", "Qty", "Rate", "Amount"].map(
            (label) => (
              <div key={label} className="border-r border-zinc-950 p-1 last:border-r-0">
                {label}
              </div>
            )
          )}
        </div>

        <div className="flex-1">
          {Array.from({ length: templateOption.sourcePage === 7 ? 6 : 4 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[1.2rem_1fr_2rem_2rem_2.2rem_2rem_2.4rem] text-[5px]"
            >
              <div className="border-r border-zinc-950 p-1 text-center">{index + 1}</div>
              <div className="border-r border-zinc-950 p-1">
                <div className="h-1 rounded bg-zinc-300" />
              </div>
              <div className="border-r border-zinc-950 p-1">8544</div>
              <div className="border-r border-zinc-950 p-1">18%</div>
              <div className="border-r border-zinc-950 p-1">2 Pcs</div>
              <div className="border-r border-zinc-950 p-1">100</div>
              <div className="p-1 text-right">200</div>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-950">
          <div className="grid grid-cols-[1fr_4.5rem] border-b border-zinc-950">
            <div className="p-1 text-right font-semibold">Total</div>
            <div className="border-l border-zinc-950 p-1 text-right font-bold">Rs. 2,404</div>
          </div>
          <div className="p-1">
            <p className="truncate text-[5px]">Amount Chargeable (in words)</p>
            <p className="truncate font-semibold">INR Two Thousand Four Hundred Four Only</p>
          </div>
          <div className="grid grid-cols-5 border-t border-zinc-950 text-[5px]">
            {["Taxable Value", "CGST", "SGST/UTGST", "Tax Amount", "Signatory"].map(
              (label) => (
                <div key={label} className="border-r border-zinc-950 p-1 last:border-r-0">
                  {label}
                </div>
              )
            )}
          </div>
          <div className="grid grid-cols-[1fr_5rem] border-t border-zinc-950">
            <p className="p-1 text-[5px]">Declaration: All particulars are true and correct.</p>
            <div className="border-l border-zinc-950 p-1 text-right">
              <p className="text-[5px]">for {templateOption.sampleSeller}</p>
              <p className="mt-3 text-[5px]">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyDetail({
  label,
  value,
  mono = false,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background px-3 py-2.5",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 min-w-0 truncate text-sm font-medium",
          mono && "font-mono tracking-[0.16em]"
        )}
        title={value}
      >
        {value || "Not added"}
      </p>
    </div>
  )
}

function ConnectorDetail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "min-w-0 truncate text-sm font-medium text-foreground",
          mono && "font-mono tracking-[0.12em]"
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function createBusinessDefaults(data?: SettingsResponse): BusinessDetailsFormValues {
  return {
    businessEmail: data?.business.businessEmail ?? "",
    businessMobile: data?.business.businessMobile ?? "",
    primaryContactName: data?.business.primaryContactName ?? "",
    primaryContactMobile: data?.business.primaryContactMobile ?? "",
    primaryContactEmail: data?.business.primaryContactEmail ?? "",
    principalAddressLine1: data?.registration.principalAddressLine1 ?? "",
    principalAddressLine2: data?.registration.principalAddressLine2 ?? "",
    locality: data?.registration.locality ?? "",
    district: data?.registration.district ?? "",
    pincode: data?.registration.pincode ?? "",
    possessionType: data?.registration.possessionType ?? "",
    registrationDate: data?.registration.registrationDate ?? "",
  }
}

function setSettingsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  nextSettings: SettingsResponse
) {
  queryClient.setQueryData(["settings"], nextSettings)
}

function toggleGstSlab(
  currentSlabs: GstRateSettingsFormValues["enabledGstSlabs"],
  targetSlab: GstRateSettingsFormValues["enabledGstSlabs"][number]
) {
  if (currentSlabs.includes(targetSlab)) {
    if (currentSlabs.length === 1) {
      return currentSlabs
    }

    return currentSlabs.filter((slab) => slab !== targetSlab) as GstRateSettingsFormValues["enabledGstSlabs"]
  }

  return [...currentSlabs, targetSlab].sort((left, right) => left - right) as GstRateSettingsFormValues["enabledGstSlabs"]
}

function toggleCessPresetCode(
  currentCodes: GstRateSettingsFormValues["enabledCessPresetCodes"],
  targetCode: GstRateSettingsFormValues["enabledCessPresetCodes"][number]
) {
  if (currentCodes.includes(targetCode)) {
    return currentCodes.filter((code) => code !== targetCode)
  }

  return [...currentCodes, targetCode]
}

function formatTitleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function normalizeTenantSlugInput(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function createTenantSlugSuggestion(value: string) {
  const slug = normalizeTenantSlugInput(value.replace(/&/g, " and "))
  const normalized = slug.length >= 3 ? slug : "business"

  return reservedTenantSlugs.has(normalized) ? `${normalized}-business` : normalized
}

function getTenantSlugValidationError(value: string) {
  if (value.length < 3) {
    return "Use at least 3 characters."
  }

  if (value.length > 48) {
    return "Use 48 characters or fewer."
  }

  if (!tenantSlugPattern.test(value)) {
    return "Use letters, numbers, and hyphens only."
  }

  return null
}

function getTemplateLabel() {
  return getInvoiceTemplateOption().label
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function SettingsPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-3 pt-4 sm:p-4 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-[22rem] max-w-full" />
          </div>
          <Skeleton className="h-7 w-44 rounded-full" />
        </div>
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4 lg:p-6 lg:pt-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <section className="rounded-2xl border border-border bg-card p-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-col">
            {settingsTabs.map((tab) => (
              <Skeleton key={tab.value} className="h-14 rounded-xl" />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-[30rem] max-w-full" />
              </div>
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>

          <div className="space-y-6 px-4 py-4 sm:px-5 lg:px-6">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <Skeleton className="mb-4 h-5 w-52" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-8 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-8 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background p-4">
                  <Skeleton className="mb-4 h-5 w-32" />
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    ))}
                  </div>
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
