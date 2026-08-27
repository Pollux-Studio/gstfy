import { apiRequest } from "@/lib/api/client"

export type FeedbackCategory =
  | "ease_of_use"
  | "billing_pos"
  | "gst_filing"
  | "inventory"
  | "payments"
  | "performance"
  | "bug"
  | "feature_request"
  | "other"

export type SubmitFeedbackPayload = {
  accountType: "business" | "ca"
  category: FeedbackCategory
  rating: number
  effortScore: number
  message: string
  pageUrl?: string | null
  contactConsent: boolean
}

export type SubmitFeedbackResponse = {
  feedback: {
    id: string
    status: string
    createdAt: string
  }
  nextAllowedAt: string | null
}

export type FeedbackStatusResponse = {
  canSubmit: boolean
  latestFeedback: {
    id: string
    status: string
    category: FeedbackCategory
    rating: number
    effortScore: number
    createdAt: string
  } | null
  nextAllowedAt: string | null
}

export function submitFeedback(
  payload: SubmitFeedbackPayload,
  accessToken: string
) {
  return apiRequest<SubmitFeedbackResponse>("/feedback", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function getFeedbackStatus(
  accessToken: string,
  accountType: "business" | "ca"
) {
  return apiRequest<FeedbackStatusResponse>("/feedback/status", {
    accessToken,
    headers: {
      "X-GSTFY-Account-Type": accountType,
    },
  })
}
