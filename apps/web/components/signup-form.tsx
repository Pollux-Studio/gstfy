"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { useMutation } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  Globe2Icon,
  KeyRoundIcon,
  LockKeyholeIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Trans, useTranslation } from "react-i18next"
import { z } from "zod"

import {
  type CompleteOnboardingPayload,
  register as registerAccount,
  sendOtp,
  verifyCaReferral,
  verifyOtp,
} from "@/lib/auth/api"
import { clearStoredAuthSession, setStoredAuthSession } from "@/lib/auth/session"
import {
  appendPathToUrl,
  createWorkspaceSlugPreview,
  getWorkspaceUrlPreview,
} from "@/lib/auth/workspace-url"
import { getAllGstStates } from "@/lib/gst-state"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from "@/components/ui/input-group"
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  SmoothInput as Input,
  SmoothInputGroupInput,
} from "@/components/ui/skiper-ui/skiper106"
import { cn } from "@/lib/utils"

type RegisterStep = "company" | "registration" | "account"

type CompanyFormValues = {
  legalName: string
  tradeName: string
  pan: string
  constitution: string
  businessEmail: string
  businessMobile: string
  primaryContactName: string
  primaryContactMobile: string
  primaryContactEmail: string
}

type RegistrationFormValues = {
  gstin: string
  taxpayerType: string
  registrationDate: string
  principalAddressLine1: string
  principalAddressLine2: string
  locality: string
  district: string
  pincode: string
  stateCode: string
  possessionType: string
  eInvoiceApplicable: boolean
  eWayBillApplicable: boolean
}

type AccountFormValues = {
  identifier: string
  password: string
  confirmPassword: string
  caReferralCode: string
}

type AccountStage = "credentials" | "otp"

type FieldErrors<T extends string> = Partial<Record<T, string>>
type RegistrationLocationStatus = "idle" | "requesting" | "success" | "error"
type CaReferralVerification = {
  code: string
  type: "success" | "error"
  message: string
} | null

type SignupFormProps = React.ComponentProps<"div"> & {
  initialCaReferralCode?: string
}

const indiaPhonePattern = /^\d{10}$/
const gstinPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/
const pincodePattern = /^\d{6}$/
const PAN_STATUS_CODES = new Set(["A", "B", "C", "F", "G", "H", "J", "L", "P", "T"])

export function SignupForm({
  className,
  initialCaReferralCode = "",
  ...props
}: SignupFormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const states = useMemo(
    () => getAllGstStates().filter((item) => item.code !== "97" && item.code !== "99"),
    []
  )
  const normalizedInitialCaReferralCode = useMemo(
    () => normalizeCaReferralCodeInput(initialCaReferralCode),
    [initialCaReferralCode]
  )

  const [step, setStep] = useState<RegisterStep>("company")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [accountStage, setAccountStage] = useState<AccountStage>("credentials")
  const [otpToken, setOtpToken] = useState("")
  const [phoneVerificationIdentifier, setPhoneVerificationIdentifier] = useState("")
  const [phoneVerificationError, setPhoneVerificationError] = useState("")
  const [phoneVerificationFeedback, setPhoneVerificationFeedback] = useState("")
  const [isRegistrationDatePickerOpen, setIsRegistrationDatePickerOpen] = useState(false)
  const [registrationLocationStatus, setRegistrationLocationStatus] =
    useState<RegistrationLocationStatus>("idle")
  const [registrationLocationMessage, setRegistrationLocationMessage] = useState("")
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: "error" | "info"
    message: string
  } | null>(null)
  const [caReferralVerification, setCaReferralVerification] =
    useState<CaReferralVerification>(null)
  const [isCaReferralCodeLocked, setIsCaReferralCodeLocked] = useState(false)
  const hasRequestedRegistrationLocationRef = useRef(false)
  const initialCaReferralVerificationRef = useRef<string | null>(null)

  const [company, setCompany] = useState<CompanyFormValues>({
    legalName: "",
    tradeName: "",
    pan: "",
    constitution: "",
    businessEmail: "",
    businessMobile: "",
    primaryContactName: "",
    primaryContactMobile: "",
    primaryContactEmail: "",
  })

  const [registration, setRegistration] = useState<RegistrationFormValues>({
    gstin: "",
    taxpayerType: "",
    registrationDate: "",
    principalAddressLine1: "",
    principalAddressLine2: "",
    locality: "",
    district: "",
    pincode: "",
    stateCode: "",
    possessionType: "",
    eInvoiceApplicable: false,
    eWayBillApplicable: false,
  })

  const [account, setAccount] = useState<AccountFormValues>({
    identifier: "",
    password: "",
    confirmPassword: "",
    caReferralCode: normalizedInitialCaReferralCode,
  })
  const workspaceSlugPreview = useMemo(
    () => createWorkspaceSlugPreview(company.tradeName || company.legalName),
    [company.legalName, company.tradeName]
  )
  const workspaceUrlPreview = useSyncExternalStore(
    subscribeToLocationSnapshot,
    () => getWorkspaceUrlPreview(workspaceSlugPreview),
    () => ""
  )

  const [companyErrors, setCompanyErrors] = useState<FieldErrors<keyof CompanyFormValues>>(
    {}
  )
  const [registrationErrors, setRegistrationErrors] = useState<
    FieldErrors<keyof RegistrationFormValues>
  >({})
  const [accountErrors, setAccountErrors] = useState<FieldErrors<keyof AccountFormValues>>(
    {}
  )

  const registerMutation = useMutation({
    mutationFn: registerAccount,
  })

  const sendOtpMutation = useMutation({
    mutationFn: sendOtp,
  })

  const verifyOtpMutation = useMutation({
    mutationFn: verifyOtp,
  })

  const verifyCaReferralMutation = useMutation({
    mutationFn: verifyCaReferral,
  })

  useEffect(() => {
    const referralCode = normalizeCaReferralCodeInput(account.caReferralCode)
    const gstin = registration.gstin.trim().toUpperCase()
    const verificationKey = `${referralCode}:${gstin}`

    if (
      !normalizedInitialCaReferralCode ||
      step !== "account" ||
      !referralCode ||
      referralCode !== normalizedInitialCaReferralCode ||
      !gstin ||
      isCaReferralCodeLocked ||
      verifyCaReferralMutation.isPending ||
      initialCaReferralVerificationRef.current === verificationKey
    ) {
      return
    }

    initialCaReferralVerificationRef.current = verificationKey
    setAccount((currentValue) =>
      currentValue.caReferralCode === referralCode
        ? currentValue
        : {
            ...currentValue,
            caReferralCode: referralCode,
          }
    )
    setAccountErrors((currentValue) => clearErrorKey(currentValue, "caReferralCode"))
    setCaReferralVerification(null)

    void verifyCaReferralMutation
      .mutateAsync({
        referralCode,
        gstin,
      })
      .then((response) => {
        setIsCaReferralCodeLocked(true)
        setCaReferralVerification({
          code: referralCode,
          type: "success",
          message: response.practiceName
            ? t("auth.register.steps.account.caReferralVerifiedWith", {
                practiceName: response.practiceName,
              })
            : t("auth.register.steps.account.caReferralVerified"),
        })
      })
      .catch((error) => {
        setIsCaReferralCodeLocked(false)
        setCaReferralVerification({
          code: referralCode,
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : t("auth.register.steps.account.caReferralInvalid"),
        })
      })
  }, [
    account.caReferralCode,
    isCaReferralCodeLocked,
    normalizedInitialCaReferralCode,
    registration.gstin,
    step,
    t,
    verifyCaReferralMutation,
  ])

  const companySchema = useMemo(
    () =>
      z
        .object({
          legalName: z.string().trim().min(1, t("auth.register.errors.legalNameRequired")),
          tradeName: z.string().trim().min(1, t("auth.register.errors.tradeNameRequired")),
          pan: z.string().trim().toUpperCase(),
          constitution: z.string().trim().min(1, t("auth.register.errors.constitutionRequired")),
          businessEmail: z
            .string()
            .trim()
            .refine(
              (value) => value.length === 0 || z.string().email().safeParse(value).success,
              { message: t("auth.register.errors.invalidEmail") }
            ),
          businessMobile: z
            .string()
            .trim()
            .refine(
              (value) => value.length === 0 || indiaPhonePattern.test(normalizePhone(value)),
              {
                message: t("auth.register.errors.invalidPhone"),
              }
            ),
          primaryContactName: z
            .string()
            .trim()
            .min(1, t("auth.register.errors.contactNameRequired")),
          primaryContactMobile: z
            .string()
            .trim()
            .refine((value) => indiaPhonePattern.test(normalizePhone(value)), {
              message: t("auth.register.errors.invalidPhone"),
            }),
          primaryContactEmail: z
            .string()
            .trim()
            .email(t("auth.register.errors.invalidEmail")),
        })
        .superRefine((values, ctx) => {
          if (!validateBusinessPan(values.pan)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["pan"],
              message: t("auth.register.errors.panInvalid"),
            })
          }
        }),
    [t]
  )

  const registrationSchema = useMemo(
    () =>
      z.object({
        gstin: z
          .string()
          .trim()
          .toUpperCase()
          .regex(gstinPattern, t("auth.register.errors.gstinInvalid")),
        taxpayerType: z
          .string()
          .trim()
          .min(1, t("auth.register.errors.taxpayerTypeRequired")),
        registrationDate: z
          .string()
          .trim()
          .min(1, t("auth.register.errors.registrationDateRequired")),
        principalAddressLine1: z
          .string()
          .trim()
          .min(1, t("auth.register.errors.addressLine1Required")),
        principalAddressLine2: z.string().trim(),
        locality: z.string().trim().min(1, t("auth.register.errors.localityRequired")),
        district: z.string().trim().min(1, t("auth.register.errors.districtRequired")),
        pincode: z
          .string()
          .trim()
          .regex(pincodePattern, t("auth.register.errors.pincodeInvalid")),
        stateCode: z.string().trim().min(1, t("auth.register.errors.stateRequired")),
        possessionType: z
          .string()
          .trim()
          .min(1, t("auth.register.errors.possessionRequired")),
        eInvoiceApplicable: z.boolean(),
        eWayBillApplicable: z.boolean(),
      }),
    [t]
  )

  const accountSchema = useMemo(
    () =>
      z
        .object({
          identifier: z
            .string()
            .trim()
            .min(1, t("auth.register.errors.identifierRequired"))
            .superRefine((value, ctx) => {
              if (isPhoneMode(value)) {
                if (!indiaPhonePattern.test(normalizePhone(value))) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t("auth.register.errors.invalidPhone"),
                  })
                }
                return
              }

              if (!z.string().email().safeParse(value.trim().toLowerCase()).success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("auth.register.errors.invalidEmail"),
                })
              }
            }),
          password: z
            .string()
            .min(8, t("auth.register.errors.passwordLength"))
            .regex(/\d/, t("auth.register.errors.passwordNumber"))
            .regex(/[^A-Za-z0-9]/, t("auth.register.errors.passwordSpecial")),
          confirmPassword: z
            .string()
            .min(1, t("auth.register.errors.confirmPasswordRequired")),
          caReferralCode: z
            .string()
            .trim()
            .min(1, t("auth.register.errors.caReferralCodeRequired"))
            .max(40),
        })
        .refine((values) => values.password === values.confirmPassword, {
          path: ["confirmPassword"],
          message: t("auth.register.errors.passwordMismatch"),
        }),
    [t]
  )

  const otpSchema = useMemo(
    () =>
      z.object({
        token: z
          .string()
          .trim()
          .regex(/^\d{6}$/, t("auth.register.errors.invalidOtp")),
      }),
    [t]
  )

  const phoneMode = isPhoneMode(account.identifier)
  const companyHasErrors = Object.keys(companyErrors).length > 0
  const registrationHasErrors = Object.keys(registrationErrors).length > 0
  const accountHasErrors = Object.keys(accountErrors).length > 0
  const constitutionTranslationKey = `auth.register.options.constitution.${company.constitution}`
  const translatedConstitutionLabel = company.constitution
    ? t(constitutionTranslationKey)
    : ""
  const constitutionDisplayLabel =
    translatedConstitutionLabel && translatedConstitutionLabel !== constitutionTranslationKey
      ? translatedConstitutionLabel
      : formatSelectValueLabel(company.constitution)
  const taxpayerTypeDisplayLabel = getTranslatedSelectLabel(
    t,
    "auth.register.options.taxpayerType",
    registration.taxpayerType
  )
  const selectedRegistrationDate = registration.registrationDate
    ? parseISO(registration.registrationDate)
    : undefined
  const registrationStateDisplayLabel = getStateDisplayLabel(states, registration.stateCode)
  const possessionDisplayLabel = getTranslatedSelectLabel(
    t,
    "auth.register.options.possession",
    registration.possessionType
  )
  const compactStepHasErrors =
    (step === "company" && companyHasErrors) ||
    (step === "registration" && registrationHasErrors) ||
    (step === "account" && accountHasErrors)

  function requestRegistrationLocationAutofill() {
    if (hasRequestedRegistrationLocationRef.current) {
      return
    }

    hasRequestedRegistrationLocationRef.current = true

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setRegistrationLocationStatus("error")
      setRegistrationLocationMessage(
        t("auth.register.steps.registration.location.unsupported")
      )
      return
    }

    setRegistrationLocationStatus("requesting")
    setRegistrationLocationMessage(t("auth.register.steps.registration.location.requesting"))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void reverseGeocodeRegistrationLocation(
          position.coords.latitude,
          position.coords.longitude,
          states
        )
          .then((locationData) => {
            if (!locationData) {
              setRegistrationLocationStatus("error")
              setRegistrationLocationMessage(
                t("auth.register.steps.registration.location.notFound")
              )
              return
            }

            setRegistration((currentValue) => ({
              ...currentValue,
              district: currentValue.district || locationData.district,
              pincode: currentValue.pincode || locationData.pincode,
              stateCode: currentValue.stateCode || locationData.stateCode,
            }))
            setRegistrationErrors((currentValue) => {
              let nextErrors = currentValue

              if (locationData.district) {
                nextErrors = clearErrorKey(nextErrors, "district")
              }

              if (locationData.pincode) {
                nextErrors = clearErrorKey(nextErrors, "pincode")
              }

              if (locationData.stateCode) {
                nextErrors = clearErrorKey(nextErrors, "stateCode")
              }

              return nextErrors
            })
            setRegistrationLocationStatus("success")
            setRegistrationLocationMessage(
              t("auth.register.steps.registration.location.success")
            )
          })
          .catch(() => {
            setRegistrationLocationStatus("error")
            setRegistrationLocationMessage(
              t("auth.register.steps.registration.location.lookupFailed")
            )
          })
      },
      (error) => {
        setRegistrationLocationStatus("error")
        setRegistrationLocationMessage(getGeolocationErrorMessage(t, error.code))
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  }

  function updateCompanyValue<K extends keyof CompanyFormValues>(
    key: K,
    value: CompanyFormValues[K]
  ) {
    updateSimpleField(setCompany, key, value)
    setCompanyErrors((currentValue) => clearErrorKey(currentValue, key))
  }

  function updateRegistrationValue<K extends keyof RegistrationFormValues>(
    key: K,
    value: RegistrationFormValues[K]
  ) {
    updateSimpleField(setRegistration, key, value)
    setRegistrationErrors((currentValue) => clearErrorKey(currentValue, key))
    if (key === "gstin") {
      setCaReferralVerification(null)
      setIsCaReferralCodeLocked(false)
    }
  }

  function updateAccountValue<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    updateSimpleField(setAccount, key, value)
    setAccountErrors((currentValue) => clearErrorKey(currentValue, key))
    if (key === "caReferralCode") {
      setCaReferralVerification(null)
      setIsCaReferralCodeLocked(false)
    }
    if (submitFeedback) {
      setSubmitFeedback(null)
    }
  }

  function fillCompanySampleValues() {
    const testIdentity = buildUniqueTestIdentity()

    setCompany({
      legalName: `Acme Retail ${testIdentity.suffix} Private Limited`,
      tradeName: `Acme Mart ${testIdentity.suffix}`,
      pan: testIdentity.pan,
      constitution: "private_limited",
      businessEmail: testIdentity.businessEmail,
      businessMobile: testIdentity.businessMobile,
      primaryContactName: "Vicky Prasad",
      primaryContactMobile: testIdentity.primaryContactMobile,
      primaryContactEmail: testIdentity.primaryContactEmail,
    })
    setCompanyErrors({})
  }

  function fillRegistrationSampleValues() {
    const testIdentity = buildUniqueTestIdentity(company.pan)

    setRegistration({
      gstin: testIdentity.gstin,
      taxpayerType: "regular",
      registrationDate: "2019-10-18",
      principalAddressLine1: "12, North Usman Road",
      principalAddressLine2: "Level 2, Near T Nagar Bus Stand",
      locality: "T Nagar",
      district: "Chennai",
      pincode: "600017",
      stateCode: "33",
      possessionType: "rented",
      eInvoiceApplicable: false,
      eWayBillApplicable: false,
    })
    setIsRegistrationDatePickerOpen(false)
    setRegistrationErrors({})
    setRegistrationLocationStatus("success")
    setRegistrationLocationMessage(
      t("auth.register.steps.registration.location.success")
    )
  }

  function validateCompanyStep() {
    const result = companySchema.safeParse({
      ...company,
      pan: company.pan.toUpperCase(),
      businessMobile: normalizePhone(company.businessMobile),
      primaryContactMobile: normalizePhone(company.primaryContactMobile),
    })

    if (result.success) {
      setCompanyErrors({})
      setCompany({
        ...company,
        pan: company.pan.toUpperCase(),
        businessMobile: normalizePhone(company.businessMobile),
        primaryContactMobile: normalizePhone(company.primaryContactMobile),
      })
      return true
    }

    setCompanyErrors(mapIssues(result.error))
    return false
  }

  function validateRegistrationStep() {
    const normalizedRegistration = {
      ...registration,
      gstin: registration.gstin.toUpperCase(),
    }
    const result = registrationSchema.safeParse(normalizedRegistration)

    if (result.success) {
      setRegistrationErrors({})
      setRegistration(normalizedRegistration)
      return true
    }

    setRegistrationErrors(mapIssues(result.error))
    return false
  }

  function validateAccountStep() {
    const normalizedAccount = {
      ...account,
      identifier: phoneMode ? normalizePhone(account.identifier) : account.identifier.trim(),
    }
    const result = accountSchema.safeParse(normalizedAccount)

    if (result.success) {
      setAccountErrors({})
      setAccount(normalizedAccount)
      return true
    }

    setAccountErrors(mapIssues(result.error))
    return false
  }

  async function handleVerifyCaReferral() {
    const referralCode = normalizeCaReferralCodeInput(account.caReferralCode)

    if (!referralCode) {
      setAccountErrors((currentValue) => ({
        ...currentValue,
        caReferralCode: t("auth.register.errors.caReferralCodeRequired"),
      }))
      return
    }

    setAccount((currentValue) => ({
      ...currentValue,
      caReferralCode: referralCode,
    }))
    setAccountErrors((currentValue) => clearErrorKey(currentValue, "caReferralCode"))
    setCaReferralVerification(null)

    try {
      const response = await verifyCaReferralMutation.mutateAsync({
        referralCode,
        gstin: registration.gstin.trim().toUpperCase() || undefined,
      })

      setIsCaReferralCodeLocked(true)
      setCaReferralVerification({
        code: referralCode,
        type: "success",
        message: response.practiceName
          ? t("auth.register.steps.account.caReferralVerifiedWith", {
              practiceName: response.practiceName,
            })
          : t("auth.register.steps.account.caReferralVerified"),
      })
    } catch (error) {
      setIsCaReferralCodeLocked(false)
      setCaReferralVerification({
        code: referralCode,
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : t("auth.register.steps.account.caReferralInvalid"),
      })
    }
  }

  function handleCompanySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateCompanyStep()) {
      return
    }
    setStep("registration")
    requestRegistrationLocationAutofill()
  }

  function handleRegistrationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateRegistrationStep()) {
      return
    }
    setSubmitFeedback(null)
    setAccountStage("credentials")
    setPhoneVerificationIdentifier("")
    setPhoneVerificationError("")
    setPhoneVerificationFeedback("")
    setOtpToken("")
    setStep("account")
  }

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateAccountStep()) {
      return
    }

    setSubmitFeedback(null)

    try {
      const onboardingPayload: CompleteOnboardingPayload = {
        company: {
          legalName: company.legalName.trim(),
          tradeName: company.tradeName.trim(),
          pan: company.pan.trim().toUpperCase(),
          constitution: company.constitution,
          businessEmail: company.businessEmail.trim() || undefined,
          businessMobile: normalizePhone(company.businessMobile) || undefined,
          primaryContactName: company.primaryContactName.trim(),
          primaryContactMobile: normalizePhone(company.primaryContactMobile),
          primaryContactEmail: company.primaryContactEmail.trim().toLowerCase(),
        },
        registration: {
          gstin: registration.gstin.trim().toUpperCase(),
          taxpayerType: registration.taxpayerType,
          registrationDate: registration.registrationDate,
          principalAddressLine1: registration.principalAddressLine1.trim(),
          principalAddressLine2:
            registration.principalAddressLine2.trim() || undefined,
          locality: registration.locality.trim(),
          district: registration.district.trim(),
          pincode: registration.pincode.trim(),
          stateCode: registration.stateCode,
          possessionType: registration.possessionType,
          locationSource:
            registrationLocationStatus === "success"
              ? "browser_geolocation"
              : "manual",
        },
      }
      const normalizedIdentifier = phoneMode
        ? normalizePhone(account.identifier)
        : account.identifier.trim().toLowerCase()

      const registerResponse = await registerMutation.mutateAsync({
        identifier: normalizedIdentifier,
        password: account.password,
        caReferralCode: account.caReferralCode.trim().toUpperCase(),
        emailRedirectTo:
          typeof window !== "undefined" ?
            `${window.location.origin}/auth/login`
          : undefined,
        ...onboardingPayload,
      })

      if (!registerResponse.session) {
        if (phoneMode) {
          await sendOtpMutation.mutateAsync({
            identifier: normalizedIdentifier,
            purpose: "register",
          })
          setPhoneVerificationIdentifier(normalizedIdentifier)
          setPhoneVerificationError("")
          setPhoneVerificationFeedback(t("auth.register.steps.account.otpSent"))
          setOtpToken("")
          setAccountStage("otp")
          return
        }

        navigateAfterBusinessAuth(
          getTenantLoginRedirect(
            registerResponse.tenant?.url ?? registerResponse.business?.tenantUrl,
            phoneMode ? "phone" : "email"
          ),
          router
        )
        return
      }

      setStoredAuthSession({
        accountType: "business",
        user: registerResponse.user,
        session: registerResponse.session,
        tenant: registerResponse.tenant ?? null,
      })

      navigateAfterBusinessAuth(registerResponse.redirectTo ?? "/dashboard", router)
    } catch (error) {
      setSubmitFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : t("auth.register.errors.generic"),
      })
    }
  }

  async function handlePhoneVerificationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = otpSchema.safeParse({ token: otpToken })

    if (!result.success) {
      const issue = result.error.issues[0]
      setPhoneVerificationError(issue?.message ?? t("auth.register.errors.invalidOtp"))
      return
    }

    setPhoneVerificationError("")

    try {
      const response = await verifyOtpMutation.mutateAsync({
        identifier: phoneVerificationIdentifier,
        token: result.data.token,
        purpose: "register",
      })

      setStoredAuthSession({
        accountType: "business",
        user: response.user,
        session: response.session,
        tenant: response.tenant,
      })

      navigateAfterBusinessAuth(response.redirectTo, router)
    } catch (error) {
      setPhoneVerificationError(
        error instanceof Error ? error.message : t("auth.register.errors.generic")
      )
    }
  }

  async function handleResendPhoneOtp() {
    setPhoneVerificationError("")

    try {
      await sendOtpMutation.mutateAsync({
        identifier: phoneVerificationIdentifier,
        purpose: "register",
      })
      setPhoneVerificationFeedback(t("auth.register.steps.account.otpSent"))
    } catch (error) {
      setPhoneVerificationError(
        error instanceof Error ? error.message : t("auth.register.errors.generic")
      )
    }
  }

  function handleBackToCredentials() {
    setAccountStage("credentials")
    setOtpToken("")
    setPhoneVerificationError("")
    setPhoneVerificationFeedback("")
    verifyOtpMutation.reset()
    sendOtpMutation.reset()
  }

  const stepContentWidth =
    step === "account" && accountStage === "credentials" ? "max-w-sm" : "max-w-md"
  const shouldCenterStepContent =
    !compactStepHasErrors &&
    (step === "company" || (step === "account" && accountStage === "credentials"))
  const isAccountSubmitPending =
    registerMutation.isPending ||
    (accountStage === "credentials" && sendOtpMutation.isPending)

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col items-center gap-6",
        className
      )}
      {...props}
    >
      <div className="w-full max-w-4xl">
        <StepIndicator currentStep={step} />
      </div>

      <div
        className={cn(
          "mx-auto w-full min-w-0 overflow-x-hidden",
          stepContentWidth,
          "flex h-full min-h-0 flex-1 flex-col"
        )}
      >
        {step === "company" ? (
          <form
            className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
            onSubmit={handleCompanySubmit}
            noValidate
          >
            <div
              className={cn(
                "no-scrollbar min-h-0 flex-1 overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]",
                shouldCenterStepContent ? "flex items-center" : "py-4"
              )}
            >
              <FieldGroup className="w-full gap-4 pb-4">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-xl font-bold sm:text-2xl">{t("auth.register.title")}</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    {t("auth.register.subtitle")}
                  </p>
                </div>

                <Field>
                  <RequiredFieldLabel htmlFor="legal-name">
                    {t("auth.register.steps.company.fields.legalName")}
                  </RequiredFieldLabel>
                  <Input
                    id="legal-name"
                    value={company.legalName}
                    onChange={(event) => updateCompanyValue("legalName", event.target.value)}
                    placeholder={t("auth.register.steps.company.placeholders.legalName")}
                  />
                  <FieldError>{companyErrors.legalName}</FieldError>
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="trade-name">
                    {t("auth.register.steps.company.fields.tradeName")}
                  </RequiredFieldLabel>
                  <Input
                    id="trade-name"
                    value={company.tradeName}
                    onChange={(event) => updateCompanyValue("tradeName", event.target.value)}
                    placeholder={t("auth.register.steps.company.placeholders.tradeName")}
                  />
                  <FieldError>{companyErrors.tradeName}</FieldError>
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="pan">
                    {t("auth.register.steps.company.fields.pan")}
                  </RequiredFieldLabel>
                  <Input
                    id="pan"
                    value={company.pan}
                    onChange={(event) =>
                      updateCompanyValue("pan", formatPanInput(event.target.value))
                    }
                    placeholder="ABCDE1234F"
                    className="font-mono uppercase tracking-[0.18em]"
                    maxLength={10}
                    autoCapitalize="characters"
                  />
                  <FieldDescription>
                    {t("auth.register.steps.company.helpers.pan")}
                  </FieldDescription>
                  <FieldError>{companyErrors.pan}</FieldError>
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="constitution">
                    {t("auth.register.steps.company.fields.constitution")}
                  </RequiredFieldLabel>
                  <Select
                    value={company.constitution}
                    onValueChange={(value) => updateCompanyValue("constitution", value ?? "")}
                  >
                    <SelectTrigger id="constitution" className="w-full">
                      <span
                        className={cn(
                          "min-w-0 flex flex-1 items-center text-left truncate",
                          !company.constitution && "text-muted-foreground"
                        )}
                        title={
                          company.constitution
                            ? constitutionDisplayLabel
                            : t("auth.register.steps.company.placeholders.constitution")
                        }
                      >
                        {company.constitution
                          ? constitutionDisplayLabel
                          : t("auth.register.steps.company.placeholders.constitution")}
                      </span>
                    </SelectTrigger>
                    <SelectContent align="start">
                      {[
                        "proprietorship",
                        "partnership",
                        "llp",
                        "private_limited",
                        "public_limited",
                        "trust",
                        "society",
                        "other",
                      ].map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`auth.register.options.constitution.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{companyErrors.constitution}</FieldError>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="business-email">
                      {t("auth.register.steps.company.fields.businessEmail")}
                    </FieldLabel>
                    <Input
                      id="business-email"
                      type="email"
                      value={company.businessEmail}
                      onChange={(event) => updateCompanyValue("businessEmail", event.target.value)}
                      placeholder="billing@gstfy.in"
                    />
                    <FieldError>{companyErrors.businessEmail}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="business-mobile">
                      {t("auth.register.steps.company.fields.businessMobile")}
                    </FieldLabel>
                    <IndianPhoneInput
                      id="business-mobile"
                      value={company.businessMobile}
                      onChange={(event) =>
                        updateCompanyValue("businessMobile", normalizePhoneInput(event.target.value))
                      }
                    />
                    <FieldError>{companyErrors.businessMobile}</FieldError>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <RequiredFieldLabel htmlFor="primary-contact-name">
                      {t("auth.register.steps.company.fields.primaryContactName")}
                    </RequiredFieldLabel>
                    <Input
                      id="primary-contact-name"
                      value={company.primaryContactName}
                      onChange={(event) =>
                        updateCompanyValue("primaryContactName", event.target.value)
                      }
                      placeholder={t("auth.register.steps.company.placeholders.primaryContactName")}
                    />
                    <FieldError>{companyErrors.primaryContactName}</FieldError>
                  </Field>
                  <Field>
                    <RequiredFieldLabel htmlFor="primary-contact-mobile">
                      {t("auth.register.steps.company.fields.primaryContactMobile")}
                    </RequiredFieldLabel>
                    <IndianPhoneInput
                      id="primary-contact-mobile"
                      value={company.primaryContactMobile}
                      onChange={(event) =>
                        updateCompanyValue(
                          "primaryContactMobile",
                          normalizePhoneInput(event.target.value)
                        )
                      }
                    />
                    <FieldError>{companyErrors.primaryContactMobile}</FieldError>
                  </Field>
                </div>

                <Field>
                  <RequiredFieldLabel htmlFor="primary-contact-email">
                    {t("auth.register.steps.company.fields.primaryContactEmail")}
                  </RequiredFieldLabel>
                  <Input
                    id="primary-contact-email"
                    type="email"
                    value={company.primaryContactEmail}
                    onChange={(event) =>
                      updateCompanyValue("primaryContactEmail", event.target.value)
                    }
                    placeholder="owner@gstfy.in"
                  />
                  <FieldError>{companyErrors.primaryContactEmail}</FieldError>
                </Field>
              </FieldGroup>
            </div>
            <div className="border-t bg-background pt-3">
              <Button type="button" variant="outline" className="mb-3 w-full" onClick={fillCompanySampleValues}>
                {t("auth.register.actions.fillTestValues")}
              </Button>
              <Button type="submit" className="w-full">
                {t("auth.register.actions.continue")}
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {step === "registration" ? (
          <form
            className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
            onSubmit={handleRegistrationSubmit}
            noValidate
          >
            <div
              className={cn(
                "no-scrollbar min-h-0 flex-1 overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]",
                "py-4"
              )}
            >
              <FieldGroup className="w-full gap-4 pb-4">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-xl font-bold sm:text-2xl">
                    {t("auth.register.steps.registration.heading")}
                  </h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    {t("auth.register.steps.registration.description")}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <RequiredFieldLabel htmlFor="gstin">
                      {t("auth.register.steps.registration.fields.gstin")}
                    </RequiredFieldLabel>
                    <Input
                      id="gstin"
                      value={registration.gstin}
                      onChange={(event) =>
                        updateRegistrationValue("gstin", event.target.value.toUpperCase())
                      }
                      placeholder="33ABCDE1234F1Z5"
                      className="font-mono uppercase tracking-[0.18em]"
                    />
                    <FieldDescription>
                      {t("auth.register.steps.registration.helpers.gstin")}
                    </FieldDescription>
                    <FieldError>{registrationErrors.gstin}</FieldError>
                  </Field>
                  <Field>
                    <RequiredFieldLabel htmlFor="taxpayer-type">
                      {t("auth.register.steps.registration.fields.taxpayerType")}
                    </RequiredFieldLabel>
                    <Select
                      value={registration.taxpayerType}
                      onValueChange={(value) =>
                        updateRegistrationValue("taxpayerType", value ?? "")
                      }
                    >
                      <SelectTrigger id="taxpayer-type" className="w-full">
                        <span
                          className={cn(
                            "min-w-0 flex flex-1 items-center text-left truncate",
                            !registration.taxpayerType && "text-muted-foreground"
                          )}
                          title={
                            registration.taxpayerType
                              ? taxpayerTypeDisplayLabel
                              : t("auth.register.steps.registration.placeholders.taxpayerType")
                          }
                        >
                          {registration.taxpayerType
                            ? taxpayerTypeDisplayLabel
                            : t("auth.register.steps.registration.placeholders.taxpayerType")}
                        </span>
                      </SelectTrigger>
                      <SelectContent align="start">
                        {["regular", "composition", "sez", "casual"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`auth.register.options.taxpayerType.${option}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{registrationErrors.taxpayerType}</FieldError>
                  </Field>
                </div>

                <Field>
                  <RequiredFieldLabel htmlFor="registration-date">
                    {t("auth.register.steps.registration.fields.registrationDate")}
                  </RequiredFieldLabel>
                  <PopoverPrimitive.Root
                    open={isRegistrationDatePickerOpen}
                    onOpenChange={setIsRegistrationDatePickerOpen}
                  >
                    <PopoverPrimitive.Trigger
                      render={
                        <Button
                          type="button"
                          id="registration-date"
                          variant="outline"
                          aria-invalid={Boolean(registrationErrors.registrationDate)}
                          className={cn(
                            "h-8 w-full justify-between rounded-lg border-input px-2.5 text-left text-sm font-normal",
                            !registration.registrationDate && "text-muted-foreground"
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
                              updateRegistrationValue(
                                "registrationDate",
                                date ? format(date, "yyyy-MM-dd") : ""
                              )
                              setIsRegistrationDatePickerOpen(false)
                            }}
                          />
                        </PopoverPrimitive.Popup>
                      </PopoverPrimitive.Positioner>
                    </PopoverPrimitive.Portal>
                  </PopoverPrimitive.Root>
                  <FieldError>{registrationErrors.registrationDate}</FieldError>
                </Field>

                <Field>
                  <RequiredFieldLabel htmlFor="principal-address-line-1">
                    {t("auth.register.steps.registration.fields.principalAddressLine1")}
                  </RequiredFieldLabel>
                  <Input
                    id="principal-address-line-1"
                    value={registration.principalAddressLine1}
                    onChange={(event) =>
                      updateRegistrationValue("principalAddressLine1", event.target.value)
                    }
                    placeholder={t(
                      "auth.register.steps.registration.placeholders.principalAddressLine1"
                    )}
                  />
                  <FieldError>{registrationErrors.principalAddressLine1}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="principal-address-line-2">
                    {t("auth.register.steps.registration.fields.principalAddressLine2")}
                  </FieldLabel>
                  <Input
                    id="principal-address-line-2"
                    value={registration.principalAddressLine2}
                    onChange={(event) =>
                      updateRegistrationValue("principalAddressLine2", event.target.value)
                    }
                    placeholder={t(
                      "auth.register.steps.registration.placeholders.principalAddressLine2"
                    )}
                  />
                </Field>

                {registrationLocationMessage ? (
                  <FieldDescription
                    className={cn(
                      registrationLocationStatus === "success" &&
                        "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {registrationLocationMessage}
                  </FieldDescription>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <RequiredFieldLabel htmlFor="registration-locality">
                      {t("auth.register.steps.registration.fields.locality")}
                    </RequiredFieldLabel>
                    <Input
                      id="registration-locality"
                      value={registration.locality}
                      onChange={(event) =>
                        updateRegistrationValue("locality", event.target.value)
                      }
                      placeholder={t("auth.register.steps.registration.placeholders.locality")}
                    />
                    <FieldError>{registrationErrors.locality}</FieldError>
                  </Field>
                  <Field>
                    <RequiredFieldLabel htmlFor="registration-district">
                      {t("auth.register.steps.registration.fields.district")}
                    </RequiredFieldLabel>
                    <Input
                      id="registration-district"
                      value={registration.district}
                      onChange={(event) =>
                        updateRegistrationValue("district", event.target.value)
                      }
                      placeholder={t("auth.register.steps.registration.placeholders.district")}
                    />
                    <FieldError>{registrationErrors.district}</FieldError>
                  </Field>
                  <Field>
                    <RequiredFieldLabel htmlFor="registration-pincode">
                      {t("auth.register.steps.registration.fields.pincode")}
                    </RequiredFieldLabel>
                    <Input
                      id="registration-pincode"
                      value={registration.pincode}
                      onChange={(event) =>
                        updateRegistrationValue(
                          "pincode",
                          event.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      placeholder="600001"
                      inputMode="numeric"
                    />
                    <FieldError>{registrationErrors.pincode}</FieldError>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <RequiredFieldLabel htmlFor="registration-state">
                      {t("auth.register.steps.registration.fields.state")}
                    </RequiredFieldLabel>
                    <Select
                      value={registration.stateCode}
                      onValueChange={(value) =>
                        updateRegistrationValue("stateCode", value ?? "")
                      }
                    >
                      <SelectTrigger id="registration-state" className="w-full">
                        <span
                          className={cn(
                            "min-w-0 flex flex-1 items-center text-left truncate",
                            !registration.stateCode && "text-muted-foreground"
                          )}
                          title={
                            registration.stateCode
                              ? registrationStateDisplayLabel
                              : t("auth.register.steps.registration.placeholders.state")
                          }
                        >
                          {registration.stateCode
                            ? registrationStateDisplayLabel
                            : t("auth.register.steps.registration.placeholders.state")}
                        </span>
                      </SelectTrigger>
                      <SelectContent align="start">
                        {states.map((stateOption) => (
                          <SelectItem key={stateOption.code} value={stateOption.code}>
                            {stateOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{registrationErrors.stateCode}</FieldError>
                  </Field>
                  <Field>
                    <RequiredFieldLabel htmlFor="possession-type">
                      {t("auth.register.steps.registration.fields.possessionType")}
                    </RequiredFieldLabel>
                    <Select
                      value={registration.possessionType}
                      onValueChange={(value) =>
                        updateRegistrationValue("possessionType", value ?? "")
                      }
                    >
                      <SelectTrigger id="possession-type" className="w-full">
                        <span
                          className={cn(
                            "min-w-0 flex flex-1 items-center text-left truncate",
                            !registration.possessionType && "text-muted-foreground"
                          )}
                          title={
                            registration.possessionType
                              ? possessionDisplayLabel
                              : t("auth.register.steps.registration.placeholders.possessionType")
                          }
                        >
                          {registration.possessionType
                            ? possessionDisplayLabel
                            : t("auth.register.steps.registration.placeholders.possessionType")}
                        </span>
                      </SelectTrigger>
                      <SelectContent align="start">
                        {["own", "rented", "leased", "consent", "shared", "other"].map(
                          (option) => (
                            <SelectItem key={option} value={option}>
                              {t(`auth.register.options.possession.${option}`)}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FieldError>{registrationErrors.possessionType}</FieldError>
                  </Field>
                </div>

              </FieldGroup>
            </div>
            <div className="flex flex-col gap-3 border-t bg-background pt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={fillRegistrationSampleValues}
              >
                {t("auth.register.actions.fillTestValues")}
              </Button>
              <Button type="submit" className="w-full">
                {t("auth.register.actions.continue")}
                <ArrowRightIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("company")}>
                <ArrowLeftIcon className="size-4" />
                {t("auth.register.actions.backToCompany")}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "account" ? (
          <form
            className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
            onSubmit={
              accountStage === "credentials"
                ? handleAccountSubmit
                : handlePhoneVerificationSubmit
            }
            noValidate
          >
            <div
              className={cn(
                "no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]",
                shouldCenterStepContent ? "flex items-center" : "py-4"
              )}
            >
              <FieldGroup className="min-w-0 w-full gap-4 pb-4">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-xl font-bold sm:text-2xl">
                    {accountStage === "credentials"
                      ? t("auth.register.steps.account.heading")
                      : t("auth.register.steps.account.phoneVerificationHeading")}
                  </h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    {accountStage === "credentials"
                      ? t("auth.register.steps.account.description")
                      : t("auth.register.steps.account.phoneVerificationDescription")}
                  </p>
                </div>

                {accountStage === "credentials" ? (
                  <>
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex items-start gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                          <Globe2Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {t("auth.register.steps.account.workspaceUrlLabel")}
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-foreground">
                            {workspaceUrlPreview}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("auth.register.steps.account.workspaceUrlHelper")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Field>
                      <RequiredFieldLabel htmlFor="register-identifier">
                        {t("auth.register.steps.account.identifierLabel")}
                      </RequiredFieldLabel>
                      <InputGroup>
                        <InputGroupAddon
                          aria-hidden={!phoneMode}
                          className={cn(
                            "overflow-hidden transition-all",
                            phoneMode
                              ? "w-auto pl-2 opacity-100"
                              : "w-0 gap-0 overflow-hidden p-0 opacity-0"
                          )}
                        >
                          <InputGroupText
                            className={cn(
                              "whitespace-nowrap transition-opacity",
                              !phoneMode && "opacity-0"
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
                        <SmoothInputGroupInput
                          id="register-identifier"
                          type="text"
                          value={account.identifier}
                          inputMode={phoneMode ? "numeric" : "email"}
                          maxLength={phoneMode ? 10 : undefined}
                          placeholder={
                            phoneMode
                              ? t("auth.register.steps.account.phonePlaceholder")
                              : t("auth.register.steps.account.emailPlaceholder")
                          }
                          autoComplete={phoneMode ? "tel-national" : "email"}
                          className={cn(phoneMode && "font-mono")}
                          onChange={(event) =>
                            updateAccountValue(
                              "identifier",
                              isPhoneMode(event.target.value)
                                ? normalizePhoneInput(event.target.value)
                                : event.target.value
                            )
                          }
                        />
                      </InputGroup>
                      <FieldError>{accountErrors.identifier}</FieldError>
                    </Field>

                    <Field>
                      <RequiredFieldLabel htmlFor="register-ca-referral-code">
                        {t("auth.register.steps.account.caReferralCodeLabel")}
                      </RequiredFieldLabel>
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                        <InputGroup className="min-w-0 flex-1">
                          <InputGroupAddon>
                            <KeyRoundIcon className="size-4" />
                          </InputGroupAddon>
                          <SmoothInputGroupInput
                            id="register-ca-referral-code"
                            type="text"
                            value={account.caReferralCode}
                            placeholder={t(
                              "auth.register.steps.account.caReferralCodePlaceholder"
                            )}
                            autoComplete="off"
                            disabled={
                              isCaReferralCodeLocked ||
                              verifyCaReferralMutation.isPending
                            }
                            className="min-w-0 font-mono uppercase tracking-[0.12em]"
                            onChange={(event) =>
                              updateAccountValue(
                                "caReferralCode",
                                normalizeCaReferralCodeInput(event.target.value)
                              )
                            }
                          />
                        </InputGroup>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 sm:w-24"
                          disabled={
                            isCaReferralCodeLocked ||
                            verifyCaReferralMutation.isPending ||
                            account.caReferralCode.trim().length === 0
                          }
                          onClick={handleVerifyCaReferral}
                        >
                          {isCaReferralCodeLocked ? (
                            <CheckIcon className="size-4" />
                          ) : verifyCaReferralMutation.isPending ? (
                            <Spinner />
                          ) : (
                            t("auth.register.steps.account.verifyCaReferral")
                          )}
                        </Button>
                      </div>
                      <FieldDescription
                        className={cn(
                          caReferralVerification?.type === "success" &&
                            "text-emerald-600 dark:text-emerald-400",
                          caReferralVerification?.type === "error" && "text-destructive"
                        )}
                      >
                        {caReferralVerification?.message ??
                          t("auth.register.steps.account.caReferralCodeHelper")}
                      </FieldDescription>
                      <FieldError>{accountErrors.caReferralCode}</FieldError>
                    </Field>

                    <Field>
                      <RequiredFieldLabel htmlFor="register-password">
                        {t("auth.register.steps.account.passwordLabel")}
                      </RequiredFieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <LockKeyholeIcon className="size-4" />
                        </InputGroupAddon>
                        <SmoothInputGroupInput
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("auth.register.steps.account.passwordPlaceholder")}
                          autoComplete="new-password"
                          value={account.password}
                          onChange={(event) => updateAccountValue("password", event.target.value)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            aria-label={
                              showPassword
                                ? t("auth.login.hidePassword")
                                : t("auth.login.showPassword")
                            }
                            onClick={() => setShowPassword((currentValue) => !currentValue)}
                          >
                            {showPassword ? (
                              <EyeOffIcon className="size-4" />
                            ) : (
                              <EyeIcon className="size-4" />
                            )}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{accountErrors.password}</FieldError>
                    </Field>

                    <Field>
                      <RequiredFieldLabel htmlFor="register-confirm-password">
                        {t("auth.register.steps.account.confirmPasswordLabel")}
                      </RequiredFieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <LockKeyholeIcon className="size-4" />
                        </InputGroupAddon>
                        <SmoothInputGroupInput
                          id="register-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={t(
                            "auth.register.steps.account.confirmPasswordPlaceholder"
                          )}
                          autoComplete="new-password"
                          value={account.confirmPassword}
                          onChange={(event) =>
                            updateAccountValue("confirmPassword", event.target.value)
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            aria-label={
                              showConfirmPassword
                                ? t("auth.login.hidePassword")
                                : t("auth.login.showPassword")
                            }
                            onClick={() =>
                              setShowConfirmPassword((currentValue) => !currentValue)
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOffIcon className="size-4" />
                            ) : (
                              <EyeIcon className="size-4" />
                            )}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{accountErrors.confirmPassword}</FieldError>
                      <FieldDescription>
                        {t("auth.register.steps.account.passwordHelper")}
                      </FieldDescription>
                    </Field>

                    {submitFeedback ? (
                      <FieldDescription
                        className={cn(
                          submitFeedback.type === "error" && "text-destructive"
                        )}
                      >
                        {submitFeedback.message}
                      </FieldDescription>
                    ) : null}

                    <FieldDescription className="px-6 text-center">
                      {t("auth.register.backToLoginText.before")}{" "}
                      <Link
                        href="/auth/login"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        {t("auth.register.backToLoginText.link")}
                      </Link>
                    </FieldDescription>
                  </>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="register-phone-otp">
                        {t("auth.register.steps.account.otpLabel")}
                      </FieldLabel>
                      <InputGroup>
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
                        <SmoothInputGroupInput
                          id="register-phone-otp"
                          type="text"
                          value={otpToken}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder={t("auth.register.steps.account.otpPlaceholder")}
                          className="font-mono tracking-[0.3em]"
                          onChange={(event) => {
                            setOtpToken(event.target.value.replace(/\D/g, "").slice(0, 6))
                            if (phoneVerificationError) {
                              setPhoneVerificationError("")
                            }
                            if (phoneVerificationFeedback) {
                              setPhoneVerificationFeedback("")
                            }
                          }}
                        />
                      </InputGroup>
                      <FieldDescription>
                        {t("auth.register.steps.account.phoneOtpDescription")}
                      </FieldDescription>
                      {phoneVerificationError ? (
                        <FieldError>{phoneVerificationError}</FieldError>
                      ) : null}
                      {phoneVerificationFeedback ? (
                        <FieldDescription className="text-emerald-600 dark:text-emerald-400">
                          {phoneVerificationFeedback}
                        </FieldDescription>
                      ) : null}
                    </Field>
                  </>
                )}
              </FieldGroup>
            </div>
            <div className="flex flex-col gap-3 border-t bg-background pt-3">
              {accountStage === "credentials" ? (
                <>
                  <Button
                    type="submit"
                    disabled={isAccountSubmitPending}
                    className="w-full"
                  >
                    {isAccountSubmitPending ? (
                      <Spinner />
                    ) : (
                      t("auth.register.steps.account.cta")
                    )}
                  </Button>
                  <FieldDescription className="px-4 text-center text-xs">
                    <Trans
                      i18nKey="auth.register.termsNotice"
                      components={{
                        terms: <a href="/terms" />,
                        privacy: <a href="/privacy" />,
                      }}
                    />
                  </FieldDescription>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("registration")}
                  >
                    <ArrowLeftIcon className="size-4" />
                    {t("auth.register.actions.backToRegistration")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="submit"
                    disabled={verifyOtpMutation.isPending}
                    className="w-full"
                  >
                    {verifyOtpMutation.isPending ? (
                      <Spinner />
                    ) : (
                      t("auth.register.steps.account.verifyOtp")
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={sendOtpMutation.isPending}
                    onClick={handleResendPhoneOtp}
                  >
                    {sendOtpMutation.isPending ? (
                      <Spinner />
                    ) : (
                      t("auth.register.steps.account.resendOtp")
                    )}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleBackToCredentials}>
                    <ArrowLeftIcon className="size-4" />
                    {t("auth.register.steps.account.backToCredentials")}
                  </Button>
                </>
              )}
            </div>
          </form>
        ) : null}
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

function StepIndicator({ currentStep }: { currentStep: RegisterStep }) {
  const { t } = useTranslation()
  const steps: Array<{ id: RegisterStep; label: string }> = [
    { id: "company", label: t("auth.register.steps.company.stepTitle") },
    { id: "registration", label: t("auth.register.steps.registration.stepTitle") },
    { id: "account", label: t("auth.register.steps.account.stepTitle") },
  ]
  const currentIndex = steps.findIndex((item) => item.id === currentStep)

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

function validateBusinessPan(pan: string) {
  const normalizedPan = pan.trim().toUpperCase()

  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(normalizedPan)) {
    return false
  }

  if (!PAN_STATUS_CODES.has(normalizedPan[3])) {
    return false
  }

  return true
}

function formatPanInput(value: string) {
  const normalizedValue = value.toUpperCase()
  let nextValue = ""

  for (const character of normalizedValue) {
    const position = nextValue.length

    if (position >= 10) {
      break
    }

    if (position < 5) {
      if (/[A-Z]/.test(character)) {
        nextValue += character
      }
      continue
    }

    if (position < 9) {
      if (/\d/.test(character)) {
        nextValue += character
      }
      continue
    }

    if (/[A-Z]/.test(character)) {
      nextValue += character
    }
  }

  return nextValue
}

function formatSelectValueLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getTranslatedSelectLabel(
  t: (key: string) => string,
  baseKey: string,
  value: string
) {
  const translationKey = `${baseKey}.${value}`
  const translatedLabel = value ? t(translationKey) : ""

  if (translatedLabel && translatedLabel !== translationKey) {
    return translatedLabel
  }

  return formatSelectValueLabel(value)
}

function getStateDisplayLabel(
  states: Array<{ code: string; name: string }>,
  stateCode: string
) {
  return states.find((stateOption) => stateOption.code === stateCode)?.name ?? stateCode
}

function getStateCodeFromLocation(
  states: Array<{ code: string; name: string }>,
  stateName: string
) {
  const normalizedStateName = normalizeLocationLabel(stateName)

  return (
    states.find((stateOption) => {
      const normalizedOptionName = normalizeLocationLabel(stateOption.name)
      return (
        normalizedOptionName === normalizedStateName ||
        normalizedOptionName.includes(normalizedStateName) ||
        normalizedStateName.includes(normalizedOptionName)
      )
    })?.code ?? ""
  )
}

function normalizeLocationLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function reverseGeocodeRegistrationLocation(
  latitude: number,
  longitude: number,
  states: Array<{ code: string; name: string }>
) {
  const searchParams = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    zoom: "18",
    lat: latitude.toString(),
    lon: longitude.toString(),
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${searchParams.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  )

  if (!response.ok) {
    throw new Error("Reverse geocoding failed")
  }

  const payload: {
    address?: {
      state?: string
      union_territory?: string
      state_district?: string
      county?: string
      district?: string
      postcode?: string
    }
  } = await response.json()

  const address = payload.address

  if (!address) {
    return null
  }

  const stateName = address.state ?? address.union_territory ?? ""
  const stateCode = stateName ? getStateCodeFromLocation(states, stateName) : ""
  const district = address.state_district ?? address.county ?? address.district ?? ""
  const pincode = address.postcode?.replace(/\D/g, "").slice(0, 6) ?? ""

  if (!stateCode && !district && !pincode) {
    return null
  }

  return {
    stateCode,
    district,
    pincode,
  }
}

function getGeolocationErrorMessage(
  t: (key: string) => string,
  errorCode: number
) {
  if (errorCode === 1) {
    return t("auth.register.steps.registration.location.denied")
  }

  if (errorCode === 3) {
    return t("auth.register.steps.registration.location.timeout")
  }

  return t("auth.register.steps.registration.location.lookupFailed")
}

function updateSimpleField<T extends Record<string, unknown>, K extends keyof T>(
  setter: React.Dispatch<React.SetStateAction<T>>,
  key: K,
  value: T[K]
) {
  setter((currentValue) => ({
    ...currentValue,
    [key]: value,
  }))
}

function mapIssues(error: z.ZodError) {
  const flattenedErrors = error.flatten().fieldErrors
  return Object.fromEntries(
    Object.entries(flattenedErrors)
      .map(([key, messages]) => {
        const firstMessage = Array.isArray(messages) ? messages[0] : undefined
        return [key, firstMessage]
      })
      .filter((entry) => entry[1])
  )
}

function clearErrorKey<T extends string>(errors: FieldErrors<T>, key: T): FieldErrors<T> {
  if (!errors[key]) {
    return errors
  }

  const nextErrors = { ...errors }
  delete nextErrors[key]
  return nextErrors
}

function isPhoneMode(value: string) {
  const trimmed = value.trim()
  const digits = normalizePhone(trimmed)

  return (
    trimmed.length > 0 &&
    !trimmed.includes("@") &&
    /^[+\d\s()-]*$/.test(trimmed) &&
    (trimmed.startsWith("+") || digits.length >= 4)
  )
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "")

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 10)
}

function normalizePhoneInput(value: string) {
  return normalizePhone(value)
}

function normalizeCaReferralCodeInput(value: string) {
  return value.trim().toUpperCase().slice(0, 40)
}

function subscribeToLocationSnapshot() {
  return () => {}
}

function buildUniqueTestIdentity(existingPan?: string) {
  const timestamp = Date.now().toString()
  const suffix = timestamp.slice(-6)
  const numericSeed = Number(suffix)
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  const firstLetter = alphabet[numericSeed % alphabet.length] ?? "A"
  const secondLetter = alphabet[(numericSeed + 7) % alphabet.length] ?? "B"

  const pan =
    existingPan && validateBusinessPan(existingPan)
      ? existingPan.trim().toUpperCase()
      : `GSTP${firstLetter}${suffix.slice(-4)}${secondLetter}`

  const checksumCharacter = alphabet[(numericSeed + 13) % alphabet.length] ?? "C"
  const gstin = `33${pan}1Z${checksumCharacter}`
  const mobileBase = Number(`9${suffix.slice(-5)}0000`.slice(0, 10))

  return {
    suffix,
    pan,
    gstin,
    businessEmail: `billing+${suffix}@gstfy.in`,
    primaryContactEmail: `owner+${suffix}@gstfy.in`,
    businessMobile: String(mobileBase),
    primaryContactMobile: String(mobileBase + 7),
  }
}

function getTenantLoginRedirect(
  tenantUrl: string | null | undefined,
  verification: "email" | "phone"
) {
  const loginPath = `/auth/login?registered=1&verification=${verification}`

  return tenantUrl ? appendPathToUrl(tenantUrl, loginPath) : loginPath
}

function navigateAfterBusinessAuth(
  redirectTo: string,
  router: ReturnType<typeof useRouter>
) {
  if (/^https?:\/\//.test(redirectTo)) {
    assignAuthTarget(redirectTo)
    return
  }

  router.push(redirectTo)
}

function assignAuthTarget(target: string) {
  const targetUrl = new URL(target, window.location.href)

  if (targetUrl.origin !== window.location.origin) {
    clearStoredAuthSession()
  }

  window.location.assign(targetUrl.toString())
}
