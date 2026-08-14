"use client"

import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth"

let recaptchaVerifier: RecaptchaVerifier | null = null
let confirmationResult: ConfirmationResult | null = null
let confirmationPhoneE164 = ""

const recaptchaContainerId = "gstfy-firebase-recaptcha"

export type FirebaseOtpPurpose = "login" | "register" | "account"

export async function sendFirebasePhoneOtp(input: {
  identifier: string
  purpose: FirebaseOtpPurpose
}) {
  const auth = getFirebaseAuth()
  const phoneE164 = toIndianE164(input.identifier)
  const verifier = getRecaptchaVerifier(auth)

  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneE164, verifier)
    confirmationPhoneE164 = phoneE164
  } catch (error) {
    recaptchaVerifier?.clear()
    recaptchaVerifier = null
    throw error
  }

  return {
    identifier: input.identifier,
    deliveryMethod: "sms" as const,
    purpose: input.purpose,
  }
}

export async function confirmFirebasePhoneOtp(input: {
  identifier: string
  token: string
}) {
  const phoneE164 = toIndianE164(input.identifier)

  if (!confirmationResult || confirmationPhoneE164 !== phoneE164) {
    throw new Error("Request a fresh OTP before verifying this phone number.")
  }

  const credential = await confirmationResult.confirm(input.token)
  const idToken = await credential.user.getIdToken(true)
  confirmationResult = null
  confirmationPhoneE164 = ""

  return {
    idToken,
    phoneE164,
  }
}

function getFirebaseAuth() {
  const auth = getAuth(getFirebaseApp())

  if (process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION === "true") {
    auth.settings.appVerificationDisabledForTesting = true
  }

  return auth
}

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error("Firebase phone auth is not configured.")
  }

  return initializeApp({
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId,
  })
}

function getRecaptchaVerifier(auth: Auth) {
  if (recaptchaVerifier) {
    return recaptchaVerifier
  }

  ensureRecaptchaContainer()
  recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
    size: "invisible",
    "expired-callback": () => {
      recaptchaVerifier?.clear()
      recaptchaVerifier = null
    },
  })

  return recaptchaVerifier
}

function ensureRecaptchaContainer() {
  if (document.getElementById(recaptchaContainerId)) {
    return
  }

  const container = document.createElement("div")
  container.id = recaptchaContainerId
  container.setAttribute("aria-hidden", "true")
  document.body.appendChild(container)
}

function toIndianE164(value: string) {
  let digits = value.replace(/\D/g, "")

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2)
  }

  digits = digits.slice(0, 10)

  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.")
  }

  return `+91${digits}`
}
