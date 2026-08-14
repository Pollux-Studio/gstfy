import { apiRequest } from "@/lib/api/client"
import {
  confirmFirebasePhoneOtp,
  sendFirebasePhoneOtp,
} from "@/lib/auth/firebase-phone"

export type AuthUser = {
  id: string
  email: string | null
  phone: string | null
}

export type AuthSession = {
  accessToken: string
  refreshToken?: string
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

export type CurrentUserResponse = {
  auth: {
    userId: string
    email: string | null
    phone: string | null
    role: string | null
    aal: string | null
  }
  profile: {
    id: string
    email: string | null
    phone_e164: string | null
    display_name: string | null
    locale: string
    onboarding_status: string
    last_login_at: string | null
  } | null
  memberships: Array<{
    business_id: string
    business_name: string
    role: string
    status: string
    gstin: string | null
  }>
}

export type OtpChallengeResponse = {
  identifier: string
  deliveryMethod: "sms"
  purpose: "login" | "register"
}

export type RegisterResponse = {
  user: AuthUser
  session: AuthSession | null
  requiresVerification: boolean
  onboardingStatus: string
}

export type CaAuthResponse = {
  user: AuthUser
  session: AuthSession
  practice: {
    id: string
    name: string
    status: string
  }
}

export type CaRegisterResponse = {
  user: AuthUser
  session: AuthSession | null
  requiresVerification: boolean
  practice: {
    id: string
    name: string
    status: string
  }
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

export type CaRegisterPayload = {
  fullName: string
  practiceName: string
  email: string
  password: string
  emailRedirectTo?: string
}

export type CaLoginPayload = {
  email: string
  password: string
}

export type CompleteOnboardingPayload = Pick<RegisterPayload, "company" | "registration">

export type LoginPayload = {
  identifier: string
  password: string
}

export type ForgotPasswordPayload = {
  email: string
}

export type SendOtpPayload = {
  identifier: string
  purpose: "login" | "register"
}

export type VerifyOtpPayload = {
  identifier: string
  token: string
  purpose?: "login" | "register"
}

export type ResetPasswordPayload = {
  token: string
  password: string
}

export function lookupIdentifier(identifier: string) {
  return apiRequest<LookupIdentifierResponse>("/auth/lookup", {
    method: "POST",
    body: { identifier },
  })
}

export async function login(payload: LoginPayload) {
  const response = await apiRequest<BackendAuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  })

  return toLoginResponse(response)
}

export function caLogin(payload: CaLoginPayload) {
  return apiRequest<CaAuthResponse>("/auth/ca/login", {
    method: "POST",
    body: payload,
  })
}

export function getCurrentUser(accessToken: string) {
  return apiRequest<CurrentUserResponse>("/auth/me", {
    method: "GET",
    accessToken,
  })
}

export function forgotPassword(payload: ForgotPasswordPayload) {
  return apiRequest<{ success: true }>("/auth/password/forgot", {
    method: "POST",
    body: payload,
  })
}

export function sendOtp(payload: SendOtpPayload) {
  return sendFirebasePhoneOtp(payload)
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const firebaseToken = await confirmFirebasePhoneOtp(payload)
  const response = await apiRequest<BackendAuthResponse>("/auth/phone/verify", {
    method: "POST",
    body: {
      idToken: firebaseToken.idToken,
      purpose: payload.purpose ?? "login",
    },
  })

  return toLoginResponse(response)
}

export function resetPassword(payload: ResetPasswordPayload) {
  return apiRequest<{ success: true }>("/auth/password/reset", {
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

export function caRegister(payload: CaRegisterPayload) {
  return apiRequest<CaRegisterResponse>("/auth/ca/register", {
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

type BackendAuthResponse = {
  user: {
    id: string
    email: string | null
    phoneE164: string | null
  }
  accessToken: string
  accessTokenExpiresIn: number
}

function toLoginResponse(response: BackendAuthResponse): LoginResponse {
  return {
    user: {
      id: response.user.id,
      email: response.user.email,
      phone: response.user.phoneE164,
    },
    session: {
      accessToken: response.accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + response.accessTokenExpiresIn,
    },
  }
}
