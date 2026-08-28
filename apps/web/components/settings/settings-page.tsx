"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import type { TFunction } from "i18next"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import {
  BadgeCheckIcon,
  BarcodeIcon,
  Building2Icon,
  CalendarIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  FileTextIcon,
  Globe2Icon,
  ImageIcon,
  KeyRoundIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SaveIcon,
  Settings2Icon,
  UploadCloudIcon,
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
import { ImageCropDialog } from "@/components/media/image-crop-dialog"
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
  getAutomationJobs,
  getAutomationSettings,
  updateAutomationSettings,
  type UpdateAutomationSettingsPayload,
} from "@/lib/automation/api"
import {
  barcodeSubmitKeyOptions,
  getBarcodeSubmitKeyFromKeyboardEventKey,
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
  uploadBusinessLogo,
  uploadInvoiceLogo,
  verifyBusinessCaReferral,
  type SettingsResponse,
} from "@/lib/settings/api"
import { cn } from "@/lib/utils"

const phonePattern = /^\d{10}$/
const pincodePattern = /^\d{6}$/
const invoicePrefixPattern = /^[A-Z0-9-]{2,10}$/
const tenantSlugPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const businessLogoMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"])
const businessLogoSourceMaxBytes = 10 * 1024 * 1024
const businessLogoUploadMaxBytes = 2 * 1024 * 1024
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

type LogoCropTarget = "workspace" | "invoice"

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

const automationSettingOptions: Array<{
  key: keyof UpdateAutomationSettingsPayload
  label: string
  description: string
  enabledLabel: string
  disabledLabel: string
}> = [
  {
    key: "autoStockAccountingEnabled",
    label: "Stock posting",
    description:
      "After purchase, sales, POS, and opening stock entries, GSTFY checks that inventory ledgers are synced.",
    enabledLabel: "Automatic",
    disabledLabel: "Manual review",
  },
  {
    key: "autoEInvoiceEnabled",
    label: "E-invoice generation",
    description:
      "Eligible B2B documents can be queued for IRN generation without asking the dealer to repeat work.",
    enabledLabel: "Queue eligible bills",
    disabledLabel: "Manual only",
  },
  {
    key: "bankAutoMatchHighConfidenceEnabled",
    label: "Bank auto-match",
    description:
      "Imported statement lines and posted bank/UPI/card entries are matched when amount, date, and reference are confident.",
    enabledLabel: "Auto-match",
    disabledLabel: "Manual matching",
  },
  {
    key: "notifyAutomationFailures",
    label: "Failure alerts",
    description:
      "Show automation failures so the owner can fix missing data before GST filing or reconciliation.",
    enabledLabel: "Notify",
    disabledLabel: "Silent",
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
    value: "automation",
    label: "Automation",
    description: "Background posting and matching",
    icon: <Settings2Icon className="size-4" />,
  },
  {
    value: "connectors",
    label: "Connectors",
    description: "Scanners and local devices",
    icon: <BarcodeIcon className="size-4" />,
  },
] as const

type SettingsTabValue = (typeof settingsTabs)[number]["value"]
const defaultSettingsTab: SettingsTabValue = "business"
const settingsTabValues = new Set<string>(settingsTabs.map((tab) => tab.value))

export function SettingsPage() {
  const { t } = useTranslation()
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeSettingsTab = getSettingsTabValue(searchParams.get("tab"))
  const queryClient = useQueryClient()
  const translatedSettingsTabs = React.useMemo(
    () =>
      settingsTabs.map((tab) => ({
        ...tab,
        label: t(`settings.tabs.${tab.value}.label`),
      })),
    [t]
  )
  const translatedPossessionOptions = React.useMemo(
    () =>
      possessionOptions.map((option) => ({
        ...option,
        label: t(`settings.options.possession.${option.value}`),
      })),
    [t]
  )
  const translatedPaperSizeOptions = React.useMemo(
    () =>
      paperSizeOptions.map((option) => ({
        ...option,
        label: t(`settings.options.paperSize.${option.value}`),
      })),
    [t]
  )
  const translatedPrinterOrientationOptions = React.useMemo(
    () =>
      printerOrientationOptions.map((option) => ({
        ...option,
        label: t(`settings.options.printOrientation.${option.value}`),
      })),
    [t]
  )
  const translatedNegativeStockPolicyOptions = React.useMemo(
    () =>
      negativeStockPolicyOptions.map((option) => ({
        ...option,
        label: t(`settings.options.negativeStockPolicy.${option.value}.label`),
        description: t(
          `settings.options.negativeStockPolicy.${option.value}.description`
        ),
      })),
    [t]
  )
  const translatedValuationMethodOptions = React.useMemo(
    () =>
      valuationMethodOptions.map((option) => ({
        ...option,
        label: t(`settings.options.valuationMethod.${option.value}.label`),
        description: t(
          `settings.options.valuationMethod.${option.value}.description`
        ),
      })),
    [t]
  )
  const translatedAutomationSettingOptions = React.useMemo(
    () =>
      automationSettingOptions.map((option) => ({
        ...option,
        label: t(`settings.options.automation.${option.key}.label`),
        description: t(`settings.options.automation.${option.key}.description`),
        enabledLabel: t(`settings.options.automation.${option.key}.enabled`),
        disabledLabel: t(`settings.options.automation.${option.key}.disabled`),
      })),
    [t]
  )
  const translatedBarcodeSubmitKeyOptions = React.useMemo(
    () =>
      barcodeSubmitKeyOptions.map((option) => ({
        ...option,
        label: t(`settings.options.barcodeSubmitKey.${option.value}`),
      })),
    [t]
  )
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
  const businessLogoInputRef = React.useRef<HTMLInputElement | null>(null)
  const invoiceLogoInputRef = React.useRef<HTMLInputElement | null>(null)
  const [logoCrop, setLogoCrop] = React.useState<{
    file: File
    target: LogoCropTarget
  } | null>(null)
  const [isLogoCropOpen, setIsLogoCropOpen] = React.useState(false)

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
  const automationSettingsQuery = useQuery({
    queryKey: ["automation", "settings"],
    queryFn: () => getAutomationSettings(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })
  const automationJobsQuery = useQuery({
    queryKey: ["automation", "jobs", "recent"],
    queryFn: () => getAutomationJobs(accessToken),
    enabled: accessToken.length > 0,
    refetchInterval: 30_000,
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
      toast.success(t("settings.toast.businessUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
    },
  })

  const businessLogoMutation = useMutation({
    mutationFn: (file: File) => uploadBusinessLogo(file, accessToken),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      void queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] })
      toast.success(t("settings.toast.workspaceLogoUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
    },
  })

  const invoiceLogoMutation = useMutation({
    mutationFn: (file: File) => uploadInvoiceLogo(file, accessToken),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      toast.success(t("settings.toast.invoiceLogoUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
    },
  })

  const tenantMutation = useMutation({
    mutationFn: () => {
      const tenantSlug = normalizeTenantSlugInput(tenantSlugInput)
      const validationError = getTenantSlugValidationError(tenantSlug, {
        min: t("settings.errors.tenantSlugMin"),
        max: t("settings.errors.tenantSlugMax"),
        invalid: t("settings.errors.tenantSlugInvalid"),
      })

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

      toast.success(t("settings.toast.workspaceUrlUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
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
      toast.success(t("settings.toast.caReferralLinked"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
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
      toast.success(t("settings.toast.invoiceUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
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
      toast.success(t("settings.toast.gstUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
    },
  })

  const printerMutation = useMutation({
    mutationFn: (values: PrinterSettingsFormValues) =>
      updatePrinterSettings(values, accessToken),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
      toast.success(t("settings.toast.printerUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
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
      toast.success(t("settings.toast.inventoryUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
    },
  })
  const automationMutation = useMutation({
    mutationFn: (values: UpdateAutomationSettingsPayload) =>
      updateAutomationSettings(values, accessToken),
    onSuccess: (nextAutomationSettings) => {
      queryClient.setQueryData(["automation", "settings"], nextAutomationSettings)
      queryClient.invalidateQueries({ queryKey: ["automation", "jobs", "recent"] })
      toast.success(t("settings.toast.automationUpdated"))
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError, t("settings.errors.generic")))
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
          <h1 className="text-lg font-semibold">
            {t("settings.errors.unavailableTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error, t("settings.errors.loadSettings"))}
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
    (currentTenantSlug ? `${currentTenantSlug}.gstfy.in` : t("settings.common.notSet"))
  const inventorySettings = inventorySettingsQuery.data?.settings
  const automationSettings = automationSettingsQuery.data?.settings
  const automationJobs = automationJobsQuery.data?.jobs ?? []

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
    toast.success(t("settings.toast.barcodeConnectorSaved"))
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
      toast.error(
        t("settings.errors.scanMinLength", {
          count: barcodeScannerSettings.minLength,
        })
      )
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

  function handleBusinessLogoInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    handleLogoInputChange(event, "workspace")
  }

  function handleInvoiceLogoInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    handleLogoInputChange(event, "invoice")
  }

  function handleLogoInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
    target: LogoCropTarget
  ) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    if (!businessLogoMimeTypes.has(file.type)) {
      toast.error(t("settings.errors.logoType"))
      return
    }

    if (file.size > businessLogoSourceMaxBytes) {
      toast.error(t("settings.errors.logoSourceSize"))
      return
    }

    setLogoCrop({ file, target })
    setIsLogoCropOpen(true)
  }

  function handleLogoCropCancel() {
    setIsLogoCropOpen(false)
    setLogoCrop(null)
  }

  function handleLogoCrop(croppedFile: File) {
    const target = logoCrop?.target ?? "workspace"
    setIsLogoCropOpen(false)
    setLogoCrop(null)

    if (croppedFile.size > businessLogoUploadMaxBytes) {
      toast.error(t("settings.errors.logoCroppedSize"))
      return
    }

    if (target === "invoice") {
      invoiceLogoMutation.mutate(croppedFile)
      return
    }

    businessLogoMutation.mutate(croppedFile)
  }

  function handleSettingsTabChange(value: string) {
    const nextTab = getSettingsTabValue(value)
    const params = new URLSearchParams(searchParams.toString())

    if (nextTab === defaultSettingsTab) {
      params.delete("tab")
    } else {
      params.set("tab", nextTab)
    }

    const nextSearch = params.toString()
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
      scroll: false,
    })
  }

  return (
    <>
    <Tabs
      value={activeSettingsTab}
      defaultValue={defaultSettingsTab}
      onValueChange={handleSettingsTabChange}
      className="contents"
    >
      <div className="grid w-full flex-1 p-3 pt-3 sm:p-4 lg:grid-cols-[164px_minmax(0,760px)] lg:gap-8 lg:p-5 lg:pt-4 xl:grid-cols-[176px_minmax(0,760px)] xl:gap-7">
        <aside className="hidden lg:block">
          <div className="sticky top-20 pr-4">
            <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t("settings.title")}
            </p>
            <TabsList className="flex h-auto flex-col gap-0.5 rounded-none border-0 bg-transparent p-0 shadow-none">
              {translatedSettingsTabs.map((tab) => (
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
          <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-none border-0 bg-transparent p-0 shadow-none lg:hidden">
              {translatedSettingsTabs.map((tab) => (
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
            title={t("settings.business.title")}
            description={t("settings.business.description")}
            badgeLabel={
              canEditBusiness
                ? t("settings.badges.businessAdmin")
                : t("settings.badges.viewOnly")
            }
          >
            <form onSubmit={businessForm.handleSubmit((values) => businessMutation.mutate(values))}>
              <div className="space-y-6">
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReadOnlyDetail
                      className="sm:col-span-2"
                      label={t("settings.business.fields.legalBusinessName")}
                      value={data.business.legalName}
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.tradeName")}
                      value={data.business.tradeName}
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.state")}
                      value={businessStateMeta?.name ?? data.registration.stateCode}
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.gstin")}
                      value={data.registration.gstin}
                      mono
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.pan")}
                      value={data.business.pan}
                      mono
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.constitution")}
                      value={formatTitleCase(data.business.constitution)}
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.taxpayerType")}
                      value={formatTitleCase(data.registration.taxpayerType)}
                    />
                    <ReadOnlyDetail
                      label={t("settings.business.fields.effectiveRegistrationDate")}
                      value={
                        data.registration.registrationDate ?
                          formatDate(data.registration.registrationDate)
                        : t("settings.common.notAdded")
                      }
                    />
                  </div>

                  <BusinessLogoPanel
                    title={t("settings.business.workspaceLogo.title")}
                    badgeLabel={t("settings.business.workspaceLogo.badge")}
                    emptyDescription={t("settings.business.workspaceLogo.emptyDescription")}
                    imageAlt={t("settings.business.workspaceLogo.imageAlt")}
                    logoUrl={data.business.logoUrl}
                    fileName={data.business.logoFileName}
                    fileSizeBytes={data.business.logoFileSizeBytes}
                    uploadedAt={data.business.logoUploadedAt}
                    canEdit={canEditBusiness}
                    uploading={businessLogoMutation.isPending}
                    onPick={() => businessLogoInputRef.current?.click()}
                    previewVariant="square"
                  />
                  <input
                    ref={businessLogoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleBusinessLogoInputChange}
                  />

                  <section className="rounded-xl border border-border bg-background px-3 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe2Icon className="size-4 text-muted-foreground" />
                          <h3 className="text-sm font-medium">
                            {t("settings.business.workspaceUrl.title")}
                          </h3>
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
                              {t("settings.business.workspaceUrl.locked")}
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
                              {tenantSlugError ||
                                t("settings.business.workspaceUrl.generateHelper")}
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
                            {t("settings.actions.generate")}
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
                            {t("settings.actions.saveUrl")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <FieldGroup>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Building2Icon className="size-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">
                          {t("settings.business.editableDetails.title")}
                        </h3>
                      </div>
                      {!isBusinessEditing ? (
                        <span className="text-xs text-muted-foreground">
                          {t("settings.business.editableDetails.helper")}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="settings-business-email">
                          {t("settings.business.fields.businessEmail")}
                        </FieldLabel>
                        <Input
                          id="settings-business-email"
                          placeholder="billing@gstfy.in"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("businessEmail")}
                        />
                        <FieldError errors={[businessForm.formState.errors.businessEmail]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-business-mobile">
                          {t("settings.business.fields.businessMobile")}
                        </FieldLabel>
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
                          {t("settings.business.fields.primaryContactName")}
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
                          {t("settings.business.fields.primaryContactMobile")}
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
                          {t("settings.business.fields.primaryContactEmail")}
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
                          {t("settings.business.fields.effectiveRegistrationDate")}
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
                                    : t("settings.common.datePlaceholder")}
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
                          {t("settings.business.fields.principalAddressLine1")}
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
                          {t("settings.business.fields.principalAddressLine2")}
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
                        <FieldLabel htmlFor="settings-locality">
                          {t("settings.business.fields.locality")}
                        </FieldLabel>
                        <Input
                          id="settings-locality"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("locality")}
                        />
                        <FieldError errors={[businessForm.formState.errors.locality]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-district">
                          {t("settings.business.fields.district")}
                        </FieldLabel>
                        <Input
                          id="settings-district"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("district")}
                        />
                        <FieldError errors={[businessForm.formState.errors.district]} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="settings-pincode">
                          {t("settings.business.fields.pincode")}
                        </FieldLabel>
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
                          {t("settings.business.fields.possessionType")}
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
                                  options={translatedPossessionOptions}
                                  placeholder={t("settings.placeholders.possessionType")}
                                />
                              </SelectTrigger>
                              <SelectContent align="start">
                                {translatedPossessionOptions.map((option) => (
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
                          <h3 className="text-sm font-semibold">
                            {t("settings.business.caReferral.title")}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                              isCaReferralLinked
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            )}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {isCaReferralLinked
                              ? t("settings.badges.connected")
                              : t("settings.badges.required")}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {isCaReferralLinked
                            ? t("settings.business.caReferral.connectedDescription", {
                                practiceName:
                                  data.caReferral.practiceName ??
                                  t("settings.business.caReferral.defaultCaName"),
                              })
                            : t("settings.business.caReferral.description")}
                        </p>
                      </div>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="settings-ca-referral-code">
                        {t("settings.business.caReferral.referralCode")}
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
                          ? t("settings.business.caReferral.verifiedOn", {
                              date: formatDate(data.caReferral.linkedAt),
                            })
                          : t("settings.business.caReferral.verifyHelper")}
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
                        {t("settings.actions.verifyAndSave")}
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
                      {t("settings.actions.cancel")}
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
                      {t("settings.actions.saveBusinessDetails")}
                    </Button>
                  </>
                : <Button
                    type="button"
                    disabled={!canEditBusiness}
                    onClick={() => setIsBusinessEditing(true)}
                  >
                    {t("settings.actions.editBusinessDetails")}
                  </Button>
                }
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="invoice" className="mt-0">
          <SettingsSection
            icon={<FileTextIcon className="size-4" />}
            title={t("settings.invoice.title")}
            description={t("settings.invoice.description")}
          >
            <div className="space-y-5">
              <BusinessLogoPanel
                title={t("settings.invoice.logo.title")}
                badgeLabel={t("settings.invoice.logo.badge")}
                emptyDescription={t("settings.invoice.logo.emptyDescription")}
                imageAlt={t("settings.invoice.logo.imageAlt")}
                logoUrl={data.invoiceSettings.logoUrl}
                fileName={data.invoiceSettings.logoFileName}
                fileSizeBytes={data.invoiceSettings.logoFileSizeBytes}
                uploadedAt={data.invoiceSettings.logoUploadedAt}
                canEdit={canEditBusiness}
                uploading={invoiceLogoMutation.isPending}
                onPick={() => invoiceLogoInputRef.current?.click()}
                previewVariant="wide"
              />
              <input
                ref={invoiceLogoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleInvoiceLogoInputChange}
              />

            <form onSubmit={invoiceForm.handleSubmit((values) => invoiceMutation.mutate(values))}>
              <FieldGroup>
                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>{t("settings.invoice.template.label")}</FieldLabel>
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
                        {t("settings.invoice.template.description", {
                          templateDescription: standardInvoiceTemplate.description,
                        })}
                      </p>
                      <Badge className="w-fit">
                        {t("settings.badges.selected")}
                      </Badge>
                    </div>
                  </div>
                  <FieldDescription>
                    {t("settings.invoice.template.helper")}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-invoice-prefix">
                    {t("settings.invoice.fields.invoicePrefix")}
                  </FieldLabel>
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
                    {t("settings.invoice.fields.invoicePrefixHelper")}
                  </FieldDescription>
                  <FieldError errors={[invoiceForm.formState.errors.invoicePrefix]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-invoice-watermark">
                    {t("settings.invoice.fields.watermark")}
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
                    {t("settings.invoice.fields.watermarkHelper")}
                  </FieldDescription>
                  <FieldError errors={[invoiceForm.formState.errors.invoiceWatermarkText]} />
                </Field>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {t("settings.invoice.preview.title")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.invoice.preview.template", {
                          template: getTemplateLabel(),
                        })}
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
                  {t("settings.actions.saveInvoiceSettings")}
                </Button>
              </div>
            </form>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="gst" className="mt-0">
          <SettingsSection
            icon={<ReceiptTextIcon className="size-4" />}
            title={t("settings.gst.title")}
            description={t("settings.gst.description")}
          >
            <form onSubmit={gstForm.handleSubmit((values) => gstMutation.mutate(values))}>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("settings.gst.enabledSlabs.label")}</FieldLabel>
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
                    {t("settings.gst.enabledSlabs.helper")}
                  </FieldDescription>
                  <FieldError errors={[gstForm.formState.errors.enabledGstSlabs]} />
                </Field>
              </FieldGroup>

              <div className="mt-5 border-t border-border pt-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("settings.gst.cess.label")}</FieldLabel>
                    <FieldDescription>
                      {t("settings.gst.cess.description", {
                        businessName: data.business.tradeName || data.business.legalName,
                      })}
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
                      {t("settings.gst.cess.helper")}
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
                  {t("settings.actions.saveGstPresets")}
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="printer" className="mt-0">
          <SettingsSection
            icon={<PrinterIcon className="size-4" />}
            title={t("settings.printer.title")}
            description={t("settings.printer.description")}
          >
            <form onSubmit={printerForm.handleSubmit((values) => printerMutation.mutate(values))}>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-paper-size">
                      {t("settings.printer.fields.paperSize")}
                    </FieldLabel>
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
                              options={translatedPaperSizeOptions}
                              placeholder={t("settings.placeholders.paperSize")}
                            />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {translatedPaperSizeOptions.map((paperSize) => (
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
                    <FieldLabel htmlFor="settings-print-orientation">
                      {t("settings.printer.fields.orientation")}
                    </FieldLabel>
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
                              options={translatedPrinterOrientationOptions}
                              placeholder={t("settings.placeholders.orientation")}
                            />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {translatedPrinterOrientationOptions.map((orientation) => (
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
                  <FieldLabel>{t("settings.printer.fields.autoPrintDialog")}</FieldLabel>
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
                      {t("settings.common.yes")}
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
                      {t("settings.common.no")}
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>{t("settings.printer.fields.compactLayout")}</FieldLabel>
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
                      {t("settings.common.enabled")}
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
                      {t("settings.common.disabled")}
                    </Button>
                  </div>
                  <FieldDescription>
                    {t("settings.printer.fields.compactLayoutHelper")}
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
                  {t("settings.actions.savePrinterSettings")}
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="inventory" className="mt-0">
          <SettingsSection
            icon={<WarehouseIcon className="size-4" />}
            title={t("settings.inventory.title")}
            description={t("settings.inventory.description")}
            badgeLabel={
              inventorySettings?.valuationMethod === "FIFO" ?
                t("settings.badges.fifoConfigured")
              : t("settings.badges.weightedAverage")
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
                      {t("settings.inventory.fields.negativeStockPolicy")}
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
                          options={translatedNegativeStockPolicyOptions}
                          placeholder={t("settings.placeholders.negativeStockPolicy")}
                        />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {translatedNegativeStockPolicyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {
                        translatedNegativeStockPolicyOptions.find(
                          (option) =>
                            option.value ===
                            (inventorySettings?.negativeStockPolicy ?? "WARN")
                        )?.description
                      }
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="settings-valuation-method">
                      {t("settings.inventory.fields.valuationMethod")}
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
                          options={translatedValuationMethodOptions}
                          placeholder={t("settings.placeholders.valuationMethod")}
                        />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {translatedValuationMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {
                        translatedValuationMethodOptions.find(
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
                      <h3 className="text-sm font-medium">
                        {t("settings.inventory.postingBehavior.title")}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {t("settings.inventory.postingBehavior.description")}
                      </p>
                    </div>
                    {inventoryMutation.isPending ? (
                      <Badge variant="outline" className="w-fit gap-1.5 bg-background">
                        <Spinner className="size-3.5" />
                        {t("settings.common.saving")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-fit bg-background">
                        {t("settings.badges.autoSaved")}
                      </Badge>
                    )}
                  </div>
                </div>
              </FieldGroup>
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="automation" className="mt-0">
          <SettingsSection
            icon={<Settings2Icon className="size-4" />}
            title={t("settings.automation.title")}
            description={t("settings.automation.description")}
            badgeLabel={
              automationSettings?.autoStockAccountingEnabled ?
                t("settings.badges.smartActionsOn")
              : t("settings.badges.manualControls")
            }
          >
            {automationSettingsQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            ) : automationSettings ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {translatedAutomationSettingOptions.map((option) => {
                    const enabled = Boolean(automationSettings?.[option.key])

                    return (
                      <button
                        key={option.key}
                        type="button"
                        disabled={
                          !canEditBusiness ||
                          automationMutation.isPending ||
                          !automationSettings
                        }
                        onClick={() =>
                          automationMutation.mutate({
                            [option.key]: !enabled,
                          })
                        }
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          enabled ?
                            "border-emerald-500/30 bg-emerald-500/10"
                          : "border-border bg-background hover:bg-muted/30",
                          (!canEditBusiness ||
                            automationMutation.isPending ||
                            !automationSettings) &&
                            "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                              enabled ?
                                "border-emerald-500 bg-emerald-500 text-white"
                              : "border-muted-foreground/30 bg-background text-muted-foreground"
                            )}
                          >
                            {enabled ? (
                              <CircleCheckIcon className="size-3.5" />
                            ) : (
                              <CircleDashedIcon className="size-3.5" />
                            )}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-4 bg-background",
                            enabled && "border-emerald-500/30 text-emerald-700"
                          )}
                        >
                          {enabled ? option.enabledLabel : option.disabledLabel}
                        </Badge>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-2xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                      <h3 className="text-sm font-medium">
                        {t("settings.automation.recent.title")}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("settings.automation.recent.description")}
                      </p>
                    </div>
                    {automationMutation.isPending ? (
                      <Badge variant="outline" className="gap-1.5 bg-background">
                        <Spinner className="size-3.5" />
                        {t("settings.common.saving")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-background">
                        {t("settings.badges.autoRun")}
                      </Badge>
                    )}
                  </div>

                  <div className="divide-y divide-border">
                    {automationJobsQuery.isLoading ? (
                      <>
                        <AutomationJobSkeleton />
                        <AutomationJobSkeleton />
                        <AutomationJobSkeleton />
                      </>
                    ) : automationJobs.length > 0 ? (
                      automationJobs.map((job) => (
                        <div
                          key={job.id}
                          className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {formatAutomationJobType(job.jobType, t)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                            {job.sourceType} · {formatAutomationTime(job.updatedAt, t)}
                            </p>
                            {job.lastErrorMessage ? (
                              <p className="mt-1 line-clamp-2 text-xs text-destructive">
                                {job.lastErrorMessage}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit justify-self-start bg-background sm:justify-self-end",
                              getAutomationStatusClassName(job.status)
                            )}
                          >
                            {formatAutomationJobStatus(job.status, t)}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                        <CircleCheckIcon className="size-5 text-emerald-600" />
                        {t("settings.automation.recent.empty")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {getErrorMessage(
                  automationSettingsQuery.error,
                  t("settings.errors.loadAutomation")
                )}
              </div>
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="connectors" className="mt-0">
          <SettingsSection
            icon={<BarcodeIcon className="size-4" />}
            title={t("settings.connectors.title")}
            badgeLabel={
              barcodeScannerSettings.enabled
                ? t("settings.badges.scannerEnabled")
                : t("settings.badges.scannerDisabled")
            }
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {t("settings.connectors.barcode.title")}
                      </p>
                      <Badge variant="outline" className="bg-background">
                        {t("settings.badges.keyboardMode")}
                      </Badge>
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {t("settings.connectors.barcode.description")}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="w-fit gap-1.5 bg-background text-[11px]"
                  >
                    <BadgeCheckIcon className="size-3.5" />
                    {t("settings.badges.savedOnDevice")}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">
                        {t("settings.connectors.test.title")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("settings.connectors.test.description")}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-muted/40">
                      HID
                    </Badge>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="settings-barcode-test">
                        {t("settings.connectors.test.scanLabel")}
                      </FieldLabel>
                      <Input
                        id="settings-barcode-test"
                        value={barcodeTestValue}
                        placeholder={t("settings.connectors.test.scanPlaceholder")}
                        className="font-mono"
                        autoComplete="off"
                        onFocus={() => {
                          barcodeTestStartRef.current = performance.now()
                        }}
                        onChange={handleBarcodeTestChange}
                        onKeyDown={handleBarcodeTestKeyDown}
                      />
                      <FieldDescription>
                        {t("settings.connectors.test.scanHelper")}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <div className="mt-4 grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                    <ConnectorDetail
                      label={t("settings.connectors.test.detectedBarcode")}
                      value={
                        barcodeTestResult?.value ??
                        t("settings.connectors.test.noScanCaptured")
                      }
                      mono={Boolean(barcodeTestResult)}
                    />
                    <ConnectorDetail
                      label={t("settings.connectors.test.detectedSuffix")}
                      value={
                        barcodeTestResult ?
                          translatedBarcodeSubmitKeyOptions.find(
                            (option) => option.value === barcodeTestResult.submitKey
                          )?.label ?? t("settings.options.barcodeSubmitKey.enter")
                        : t("settings.connectors.test.waitingForSuffix")
                      }
                    />
                    <ConnectorDetail
                      label={t("settings.connectors.test.scanSpeed")}
                      value={
                        barcodeTestResult?.durationMs === null || !barcodeTestResult ?
                          t("settings.connectors.test.notMeasured")
                        : t("settings.connectors.test.durationMs", {
                            duration: barcodeTestResult.durationMs,
                          })
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
                      {t("settings.actions.clearTest")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium">
                      {t("settings.connectors.behavior.title")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("settings.connectors.behavior.description")}
                    </p>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="settings-barcode-submit-key">
                        {t("settings.connectors.behavior.suffixKey")}
                      </FieldLabel>
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
                            options={translatedBarcodeSubmitKeyOptions}
                            placeholder={t("settings.placeholders.suffixKey")}
                          />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {translatedBarcodeSubmitKeyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="settings-barcode-min-length">
                        {t("settings.connectors.behavior.minLength")}
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
                      <FieldLabel>{t("settings.connectors.behavior.status")}</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={barcodeScannerSettings.enabled ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ enabled: true })}
                        >
                          {t("settings.common.enabled")}
                        </Button>
                        <Button
                          type="button"
                          variant={!barcodeScannerSettings.enabled ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ enabled: false })}
                        >
                          {t("settings.common.disabled")}
                        </Button>
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel>
                        {t("settings.connectors.behavior.autoSearch")}
                      </FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={barcodeScannerSettings.autoSearch ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ autoSearch: true })}
                        >
                          {t("settings.common.enabled")}
                        </Button>
                        <Button
                          type="button"
                          variant={!barcodeScannerSettings.autoSearch ? "default" : "outline"}
                          onClick={() => updateBarcodeScannerSettings({ autoSearch: false })}
                        >
                          {t("settings.common.disabled")}
                        </Button>
                      </div>
                      <FieldDescription>
                        {t("settings.connectors.behavior.autoSearchHelper")}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t("settings.connectors.behavior.lastSaved")}{" "}
                      {barcodeScannerSettings.updatedAt ?
                        formatDateTime(barcodeScannerSettings.updatedAt)
                      : t("settings.common.notSavedYet")}
                    </p>
                    <Button type="button" onClick={saveBarcodeScannerSettings}>
                      <SaveIcon className="size-4" />
                      {t("settings.actions.saveConnector")}
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
    {logoCrop ? (
      <ImageCropDialog
        key={`${logoCrop.target}-${logoCrop.file.name}-${logoCrop.file.lastModified}`}
        open={isLogoCropOpen}
        file={logoCrop.file}
        title={
          logoCrop.target === "invoice"
            ? t("settings.logoCrop.invoiceTitle")
            : t("settings.logoCrop.workspaceTitle")
        }
        description={
          logoCrop.target === "invoice" ?
            t("settings.logoCrop.invoiceDescription")
          : t("settings.logoCrop.workspaceDescription")
        }
        outputWidth={logoCrop.target === "invoice" ? 960 : 512}
        outputHeight={logoCrop.target === "invoice" ? 320 : 512}
        onCancel={handleLogoCropCancel}
        onCrop={handleLogoCrop}
      />
    ) : null}
    </>
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

function AutomationJobSkeleton() {
  return (
    <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className="h-6 w-24 rounded-md" />
    </div>
  )
}

function formatAutomationJobType(jobType: string, t: TFunction) {
  const labels: Record<string, string> = {
    "stock.posted-document.sync": t("settings.automation.jobTypes.stockPostedDocument"),
    "stock.opening-stock.sync": t("settings.automation.jobTypes.openingStock"),
    "einvoice.generate": t("settings.automation.jobTypes.eInvoice"),
    "bank-reconciliation.auto-match": t("settings.automation.jobTypes.bankAutoMatch"),
    "gst-report.refresh": t("settings.automation.jobTypes.gstReportRefresh"),
    "filing-review.prepare": t("settings.automation.jobTypes.filingReview"),
  }

  return labels[jobType] ?? jobType
}

function formatAutomationJobStatus(status: string, t: TFunction) {
  const labels: Record<string, string> = {
    queued: t("settings.automation.status.queued"),
    running: t("settings.automation.status.running"),
    completed: t("settings.automation.status.completed"),
    failed: t("settings.automation.status.failed"),
    retry_scheduled: t("settings.automation.status.retrying"),
    skipped: t("settings.automation.status.skipped"),
  }

  return labels[status] ?? status
}

function getAutomationStatusClassName(status: string) {
  if (status === "completed") {
    return "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
  }

  if (status === "failed") {
    return "border-destructive/30 text-destructive"
  }

  if (status === "running" || status === "retry_scheduled") {
    return "border-amber-500/30 text-amber-700 dark:text-amber-300"
  }

  return "text-muted-foreground"
}

function formatAutomationTime(value: string, t: TFunction) {
  try {
    return format(parseISO(value), "dd MMM yyyy, h:mm a")
  } catch {
    return t("settings.common.justNow")
  }
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
  const { t } = useTranslation()

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
        {value || t("settings.common.notAdded")}
      </p>
    </div>
  )
}

function BusinessLogoPanel({
  badgeLabel,
  canEdit,
  emptyDescription,
  fileName,
  fileSizeBytes,
  imageAlt,
  logoUrl,
  onPick,
  previewVariant = "square",
  title,
  uploadedAt,
  uploading,
}: {
  badgeLabel: string
  canEdit: boolean
  emptyDescription: string
  fileName: string | null
  fileSizeBytes: number | null
  imageAlt: string
  logoUrl: string | null
  onPick: () => void
  previewVariant?: "square" | "wide"
  title: string
  uploadedAt: string | null
  uploading: boolean
}) {
  const { t } = useTranslation()
  const isWidePreview = previewVariant === "wide"

  return (
    <section
      className={cn(
        "grid gap-3 rounded-xl border border-border bg-background px-3 py-3 sm:items-center",
        isWidePreview ?
          "sm:grid-cols-[10.5rem_minmax(0,1fr)_auto]"
        : "sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden border border-border bg-muted/30 text-muted-foreground",
          isWidePreview ? "h-16 w-40 rounded-lg" : "size-16 rounded-xl",
          logoUrl && "border-transparent bg-background"
        )}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={imageAlt}
            width={isWidePreview ? 160 : 64}
            height={64}
            unoptimized
            className={cn(
              "rounded-[inherit]",
              isWidePreview ? "h-full w-full object-contain" : "size-full object-cover"
            )}
          />
        ) : (
          <ImageIcon className="size-6" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <Badge
            variant="outline"
            className="bg-background text-[11px] font-normal text-muted-foreground"
          >
            {badgeLabel}
          </Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {fileName ?
            `${fileName}${fileSizeBytes ? ` · ${formatFileSize(fileSizeBytes)}` : ""}${
              uploadedAt ? ` · ${formatDate(uploadedAt)}` : ""
            }`
          : emptyDescription}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        disabled={!canEdit || uploading}
        onClick={onPick}
      >
        {uploading ? <Spinner /> : <UploadCloudIcon className="size-3.5" />}
        {uploading
          ? ""
          : logoUrl
            ? t("settings.actions.changeLogo")
            : t("settings.actions.uploadLogo")}
      </Button>
    </section>
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

function getSettingsTabValue(value: string | null): SettingsTabValue {
  return value && settingsTabValues.has(value) ? (value as SettingsTabValue) : defaultSettingsTab
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

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
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

function getTenantSlugValidationError(
  value: string,
  messages: {
    min: string
    max: string
    invalid: string
  }
) {
  if (value.length < 3) {
    return messages.min
  }

  if (value.length > 48) {
    return messages.max
  }

  if (!tenantSlugPattern.test(value)) {
    return messages.invalid
  }

  return null
}

function getTemplateLabel() {
  return getInvoiceTemplateOption().label
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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
