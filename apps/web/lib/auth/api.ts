import { apiRequest } from "@/lib/api/client"

export type AuthUser = {
  id: string
  email: string | null
  phone: string | null
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
}

export type LookupIdentifierResponse = {
  account: {
    id: string
    displayName: string
    gstin: string | null
    email: string | null
    phone: string | null
  }
}

export type LoginResponse = {
  user: AuthUser
  session: AuthSession
}

export type RegisterResponse = {
  user: AuthUser
  session: AuthSession | null
  requiresVerification: boolean
  onboardingStatus: string
}

export type RegisterPayload = {
  identifier: string
  password: string
  emailRedirectTo?: string
  company: {
    legalName: string
    tradeName: string
    pan: string
    constitution: string
    businessEmail?: string
    businessMobile?: string
    primaryContactName: string
    primaryContactMobile: string
    primaryContactEmail: string
  }
  registration: {
    gstin: string
    taxpayerType: string
    registrationDate: string
    principalAddressLine1: string
    principalAddressLine2?: string
    locality: string
    district: string
    pincode: string
    stateCode: string
    possessionType: string
    locationSource?: "manual" | "browser_geolocation"
  }
}

export type CompleteOnboardingPayload = Pick<RegisterPayload, "company" | "registration">

export type LoginPayload = {
  identifier: string
  password: string
}

export function lookupIdentifier(identifier: string) {
  return apiRequest<LookupIdentifierResponse>("/auth/lookup", {
    method: "POST",
    body: { identifier },
  })
}

export function login(payload: LoginPayload) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: payload,
  })
}

export function register(payload: RegisterPayload) {
  return apiRequest<RegisterResponse>("/auth/register", {
    method: "POST",
    body: payload,
  })
}

export function completeOnboarding(
  payload: CompleteOnboardingPayload,
  accessToken: string
) {
  return apiRequest<{ businessId: string; onboardingStatus: string }>(
    "/onboarding/complete",
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}
