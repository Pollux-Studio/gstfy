import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth, type DecodedIdToken } from "firebase-admin/auth"

import { getEnv } from "../../config/env.js"
import { HttpError } from "../../utils/http-error.js"

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return getFirebaseAuth()
    .verifyIdToken(idToken)
    .catch(() => {
      throw new HttpError(401, "Invalid or expired Firebase phone token.")
    })
}

function getFirebaseAuth() {
  if (getApps().length === 0) {
    initializeFirebaseAdmin()
  }

  return getAuth()
}

function initializeFirebaseAdmin() {
  const env = getEnv()

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    })
    return
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({
      credential: applicationDefault(),
      projectId: env.FIREBASE_PROJECT_ID || undefined,
    })
    return
  }

  throw new HttpError(503, "Firebase phone verification is not configured.")
}
