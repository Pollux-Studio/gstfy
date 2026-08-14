import { apiRequest } from "@/lib/api/client"
import {
  confirmFirebasePhoneOtp,
  sendFirebasePhoneOtp,
} from "@/lib/auth/firebase-phone"

export type AuthUser = {
  id: string
  email: string | null
  phone: string | null
  profileImageSeed?: string | null
  profileImageStyle?: "glyphs"
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
    profile_image_seed: string | null
    profile_image_style: "glyphs"
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
    registration_date: string | null
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
  business?: {
    id: string
    legalName: string
    tradeName: string
    pan: string
    constitution: string
    businessEmail: string | null
    businessMobile: string | null
    primaryContactName: string | null
    primaryContactMobile: string | null
    primaryContactEmail: string | null
  }
  registration?: {
    id: string
    gstin: string | null
    taxpayerType: string | null
    registrationDate: string | null
    principalAddressLine1: string | null
    principalAddressLine2: string | null
    locality: string | null
    district: string | null
    pincode: string | null
    stateCode: string | null
    possessionType: string | null
    locationSource: "manual" | "browser_geolocation"
  }
}

export type CaAuthResponse = LoginResponse

export type RegisterPayload = {
  identifier: string
  password: string
  emailRedirectTo?: string
  caReferralCode: string
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

export async function caLogin(payload: CaLoginPayload) {
  const response = await apiRequest<BackendAuthResponse>("/auth/ca/login", {
    method: "POST",
    body: payload,
  })

  return toLoginResponse(response)
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

export async function caRegister(payload: CaRegisterPayload) {
  const response = await apiRequest<BackendAuthResponse>("/auth/ca/register", {
    method: "POST",
    body: payload,
  })

  return toLoginResponse(response)
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
    fullName?: string | null
    profileImageSeed: string | null
    profileImageStyle: "glyphs"
  }
  accessToken: string
  accessTokenExpiresIn: number
  redirectTo?: string
}

function toLoginResponse(response: BackendAuthResponse): LoginResponse {
  return {
    user: {
      id: response.user.id,
      email: response.user.email,
      phone: response.user.phoneE164,
      profileImageSeed: response.user.profileImageSeed,
      profileImageStyle: response.user.profileImageStyle,
    },
    session: {
      accessToken: response.accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + response.accessTokenExpiresIn,
    },
  }
}
