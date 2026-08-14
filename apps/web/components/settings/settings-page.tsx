"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BadgeCheckIcon,
  Building2Icon,
  FileTextIcon,
  LockKeyholeIcon,
  MapPinnedIcon,
  PrinterIcon,
  ReceiptTextIcon,
  SaveIcon,
  Settings2Icon,
} from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getAllGstStates } from "@/lib/gst-state"
import {
  getSettings,
  updateBusinessDetails,
  updateGstRateSettings,
  updateInvoiceSettings,
  updatePrinterSettings,
  type SettingsResponse,
} from "@/lib/settings/api"
import { cn } from "@/lib/utils"

const phonePattern = /^\d{10}$/
const pincodePattern = /^\d{6}$/
const invoicePrefixPattern = /^[A-Z0-9-]{2,10}$/

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
})

const invoiceSettingsSchema = z.object({
  invoiceTemplate: z.enum(["classic", "modern", "compact"]),
  invoicePrefix: z
    .string()
    .trim()
    .regex(invoicePrefixPattern, "Use 2 to 10 uppercase letters, numbers, or hyphens."),
})

const gstRateSettingsSchema = z.object({
  defaultGstSlab: z.union([
    z.literal(5),
    z.literal(12),
    z.literal(18),
    z.literal(28),
  ]),
  enabledGstSlabs: z
    .array(z.union([z.literal(5), z.literal(12), z.literal(18), z.literal(28)]))
    .min(1, "Enable at least one GST slab."),
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

const invoiceTemplateOptions: Array<{
  value: SettingsResponse["invoiceSettings"]["invoiceTemplate"]
  label: string
  description: string
}> = [
  {
    value: "classic",
    label: "Classic",
    description: "Balanced layout for standard GST invoices and PDF sharing.",
  },
  {
    value: "modern",
    label: "Modern",
    description: "Cleaner visual hierarchy for brand-forward invoice exports.",
  },
  {
    value: "compact",
    label: "Compact",
    description: "Denser invoice body tuned for smaller print surfaces.",
  },
]

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

const settingsTabs = [
  {
    value: "business",
    label: "Business",
    icon: <Building2Icon className="size-4" />,
  },
  {
    value: "invoice",
    label: "Invoice",
    icon: <FileTextIcon className="size-4" />,
  },
  {
    value: "gst",
    label: "GST Rate",
    icon: <ReceiptTextIcon className="size-4" />,
  },
  {
    value: "printer",
    label: "Printer",
    icon: <PrinterIcon className="size-4" />,
  },
] as const

export function SettingsPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [isBusinessEditing, setIsBusinessEditing] = React.useState(false)

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

  const businessForm = useForm<BusinessDetailsFormValues>({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: createBusinessDefaults(),
  })
  const invoiceForm = useForm<InvoiceSettingsFormValues>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: {
      invoiceTemplate: "classic",
      invoicePrefix: "INV",
    },
  })
  const gstForm = useForm<GstRateSettingsFormValues>({
    resolver: zodResolver(gstRateSettingsSchema),
    defaultValues: {
      defaultGstSlab: 18,
      enabledGstSlabs: [5, 12, 18, 28],
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
    })
    invoiceForm.reset({
      invoiceTemplate: data.invoiceSettings.invoiceTemplate,
      invoicePrefix: data.invoiceSettings.invoicePrefix,
    })
    gstForm.reset({
      defaultGstSlab: data.gstRateSettings.defaultGstSlab,
      enabledGstSlabs: data.gstRateSettings.enabledGstSlabs,
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
  const currentInvoiceTemplate = useWatch({
    control: invoiceForm.control,
    name: "invoiceTemplate",
  })
  const currentEnabledSlabs = useWatch({
    control: gstForm.control,
    name: "enabledGstSlabs",
  })
  const currentDefaultSlab = useWatch({
    control: gstForm.control,
    name: "defaultGstSlab",
  })
  const autoOpenPrintDialog = useWatch({
    control: printerForm.control,
    name: "autoOpenPrintDialog",
  })
  const compactPrintLayout = useWatch({
    control: printerForm.control,
    name: "compactPrintLayout",
  })

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

  const invoiceMutation = useMutation({
    mutationFn: (values: InvoiceSettingsFormValues) =>
      updateInvoiceSettings(
        {
          invoiceTemplate: values.invoiceTemplate,
          invoicePrefix: values.invoicePrefix.trim().toUpperCase(),
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
          defaultGstSlab: values.defaultGstSlab,
          enabledGstSlabs: values.enabledGstSlabs,
        },
        accessToken
      ),
    onSuccess: (nextSettings) => {
      setSettingsCache(queryClient, nextSettings)
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5 border-border/70 bg-background/60">
              <Settings2Icon className="size-3.5" />
              Workspace settings
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Manage the registered business profile, current user preferences,
                invoice defaults, GST presets, and print behavior for this workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-border/70 bg-background/60">
              <Building2Icon className="size-3.5" />
              {data.business.legalName}
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-border/70 bg-background/60 font-mono">
              <ReceiptTextIcon className="size-3.5" />
              {data.registration.gstin}
            </Badge>
          </div>
        </div>
      </section>

      <Tabs defaultValue="business" className="gap-4">
        <TabsList className="grid h-auto grid-cols-1 gap-2 rounded-2xl border border-border/70 bg-muted/20 p-2 sm:grid-cols-2 xl:grid-cols-4">
          {settingsTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-11 w-full min-w-0 justify-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-center font-medium data-[state=active]:border-border/70 data-[state=active]:bg-background sm:justify-start sm:text-left"
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="business">
          <SettingsSection
            icon={<Building2Icon className="size-4" />}
            title="Business details"
            description="Registration identity stays locked. Contact details and the principal place of business can be updated here."
            badgeLabel={canEditBusiness ? "Business admin" : "View only"}
          >
            <form onSubmit={businessForm.handleSubmit((values) => businessMutation.mutate(values))}>
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <LockKeyholeIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Registration-controlled fields</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <LockedField label="Legal business name" value={data.business.legalName} />
                      <LockedField label="Trade name" value={data.business.tradeName} />
                      <LockedField label="GSTIN" value={data.registration.gstin} mono />
                      <LockedField label="PAN" value={data.business.pan} mono />
                      <LockedField
                        label="Constitution"
                        value={formatTitleCase(data.business.constitution)}
                      />
                      <LockedField
                        label="Taxpayer type"
                        value={formatTitleCase(data.registration.taxpayerType)}
                      />
                      <LockedField
                        label="Effective registration date"
                        value={data.registration.registrationDate}
                      />
                      <LockedField
                        label="State / UT"
                        value={businessStateMeta?.name ?? data.registration.stateCode}
                      />
                    </div>
                  </div>

                  <FieldGroup>
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
                        <Input
                          id="settings-business-mobile"
                          placeholder="9876543210"
                          inputMode="numeric"
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
                        <Input
                          id="settings-primary-contact-mobile"
                          inputMode="numeric"
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

                    <Field>
                      <FieldLabel htmlFor="settings-address-line-1">Principal address line 1</FieldLabel>
                      <Input
                        id="settings-address-line-1"
                        disabled={!isBusinessEditing || !canEditBusiness}
                        {...businessForm.register("principalAddressLine1")}
                      />
                      <FieldError errors={[businessForm.formState.errors.principalAddressLine1]} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="settings-address-line-2">Principal address line 2</FieldLabel>
                      <Input
                        id="settings-address-line-2"
                        disabled={!isBusinessEditing || !canEditBusiness}
                        {...businessForm.register("principalAddressLine2")}
                      />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-4">
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
                      <Field>
                        <FieldLabel htmlFor="settings-possession-type">Nature of possession</FieldLabel>
                        <Input
                          id="settings-possession-type"
                          disabled={!isBusinessEditing || !canEditBusiness}
                          {...businessForm.register("possessionType")}
                        />
                        <FieldError errors={[businessForm.formState.errors.possessionType]} />
                      </Field>
                    </div>
                  </FieldGroup>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <MapPinnedIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Address status</h3>
                    </div>
                    <dl className="space-y-3 text-sm">
                      <MetaRow
                        label="Location source"
                        value={formatTitleCase(data.registration.locationSource.replaceAll("_", " "))}
                      />
                      <MetaRow
                        label="Active state"
                        value={businessStateMeta?.name ?? data.registration.stateCode}
                      />
                      <MetaRow label="GST role" value={formatTitleCase(data.permissions.role)} />
                    </dl>
                  </div>
                  <FieldDescription className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                    Locked fields come from the registered GST identity used during onboarding.
                    If those regulatory values change, update the registration source before editing
                    workspace operations here.
                  </FieldDescription>
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
                      <SaveIcon className="size-4" />
                      {businessMutation.isPending ? "Saving..." : "Save business details"}
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

        <TabsContent value="invoice">
          <SettingsSection
            icon={<FileTextIcon className="size-4" />}
            title="Invoice settings"
            description="Set the default invoice style and numbering prefix used when new sales invoices are created."
          >
            <form onSubmit={invoiceForm.handleSubmit((values) => invoiceMutation.mutate(values))}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="settings-invoice-template">Invoice template</FieldLabel>
                  <Controller
                    control={invoiceForm.control}
                    name="invoiceTemplate"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as SettingsResponse["invoiceSettings"]["invoiceTemplate"])
                        }
                      >
                        <SelectTrigger id="settings-invoice-template" className="w-full">
                          <SelectValue placeholder="Choose invoice template" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {invoiceTemplateOptions.map((template) => (
                            <SelectItem key={template.value} value={template.value}>
                              <span className="flex min-w-0 flex-col items-start">
                                <span>{template.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {template.description}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Preview</p>
                      <p className="text-sm text-muted-foreground">
                        {getTemplateLabel(currentInvoiceTemplate)} template
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
                  <SaveIcon className="size-4" />
                  {invoiceMutation.isPending ? "Saving..." : "Save invoice settings"}
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="gst">
          <SettingsSection
            icon={<ReceiptTextIcon className="size-4" />}
            title="GST rate presets"
            description="These presets only control default invoice suggestions. They do not replace statutory GST rules or line-level tax logic."
          >
            <form onSubmit={gstForm.handleSubmit((values) => gstMutation.mutate(values))}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="settings-default-gst-slab">Default GST slab</FieldLabel>
                  <Controller
                    control={gstForm.control}
                    name="defaultGstSlab"
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => {
                          const numericValue = Number(value) as 5 | 12 | 18 | 28
                          const currentSlabs = gstForm.getValues("enabledGstSlabs")
                          if (!currentSlabs.includes(numericValue)) {
                            gstForm.setValue(
                              "enabledGstSlabs",
                              [...currentSlabs, numericValue].sort((left, right) => left - right) as GstRateSettingsFormValues["enabledGstSlabs"],
                              { shouldDirty: true, shouldValidate: true }
                            )
                          }
                          field.onChange(numericValue)
                        }}
                      >
                        <SelectTrigger id="settings-default-gst-slab" className="w-full">
                          <SelectValue placeholder="Choose default GST slab" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {gstSlabOptions.map((slab) => (
                            <SelectItem key={slab} value={String(slab)}>
                              {`${slab}%`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>
                    Default intra-state split: CGST {currentDefaultSlab / 2}% + SGST {currentDefaultSlab / 2}%.
                  </FieldDescription>
                  <FieldError errors={[gstForm.formState.errors.defaultGstSlab]} />
                </Field>

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

                            if (!nextSlabs.includes(gstForm.getValues("defaultGstSlab"))) {
                              gstForm.setValue("defaultGstSlab", nextSlabs[0], {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          }}
                        >
                          {slab}%
                        </Button>
                      )
                    })}
                  </div>
                  <FieldDescription>
                    Enable only the slabs your team should see as default invoice choices.
                  </FieldDescription>
                  <FieldError errors={[gstForm.formState.errors.enabledGstSlabs]} />
                </Field>
              </FieldGroup>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button type="submit" disabled={gstMutation.isPending || !canEditBusiness}>
                  <SaveIcon className="size-4" />
                  {gstMutation.isPending ? "Saving..." : "Save GST presets"}
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="printer">
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
                            <SelectValue placeholder="Choose paper size" />
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
                            <SelectValue placeholder="Choose orientation" />
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
                  <SaveIcon className="size-4" />
                  {printerMutation.isPending ? "Saving..." : "Save printer settings"}
                </Button>
              </div>
            </form>
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SettingsSection({
  icon,
  title,
  description,
  badgeLabel,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  badgeLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
      <div className="border-b border-border/70 px-4 py-4 sm:px-5 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{icon}</span>
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {badgeLabel ? (
            <Badge variant="outline" className="border-border/70 bg-background/60">
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5 lg:px-6">{children}</div>
    </section>
  )
}

function LockedField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        disabled
        className={cn("border-border/60 bg-muted/20", mono && "font-mono tracking-[0.18em]")}
      />
    </Field>
  )
}

function MetaRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
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

function formatTitleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function getTemplateLabel(value: SettingsResponse["invoiceSettings"]["invoiceTemplate"]) {
  return invoiceTemplateOptions.find((template) => template.value === value)?.label ?? "Classic"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function SettingsPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-[22rem] max-w-full" />
            <Skeleton className="h-4 w-[28rem] max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-52 rounded-full" />
            <Skeleton className="h-8 w-44 rounded-full" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-muted/20 p-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {settingsTabs.map((tab) => (
            <Skeleton key={tab.value} className="h-11 rounded-xl" />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 text-card-foreground">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5 lg:px-6">
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
  )
}
