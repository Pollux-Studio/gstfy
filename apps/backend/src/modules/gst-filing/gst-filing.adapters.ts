import type {
  GstFilingMockMode,
  GstFilingReturnType,
  GstFilingStatus,
  MockAdapterResult,
} from "./gst-filing.domain.js"

export type GstFilingSubmitInput = {
  mode: GstFilingMockMode
  returnType: GstFilingReturnType
  period: string
}

export type GstFilingStatusInput = {
  currentStatus: GstFilingStatus
  mode: GstFilingMockMode | null
  externalReference: string | null
}

export type GstFilingAdapter = {
  name: string
  submit: (input: GstFilingSubmitInput) => MockAdapterResult
  getStatus: (input: GstFilingStatusInput) => MockAdapterResult
}

export function getGstFilingAdapter(adapterName: string | null | undefined) {
  if (!adapterName || adapterName === mockGstFilingAdapter.name) {
    return mockGstFilingAdapter
  }

  throw new Error(`GST filing adapter ${adapterName} is not configured.`)
}

export const mockGstFilingAdapter: GstFilingAdapter = {
  name: "mock",
  submit(input) {
    const externalReference = `MOCK-${input.returnType}-${input.period}-${Date.now().toString(36)}`

    if (input.mode === "MOCK_REJECT") {
      return {
        status: "REJECTED",
        externalReference,
        acknowledgementNumber: null,
        acknowledgementDate: null,
        errorCode: "MOCK_REJECTED",
        errorMessage: "Mock GST system rejected this return.",
        rawResponse: { mode: input.mode, status: "rejected" },
      }
    }

    if (input.mode === "MOCK_TIMEOUT") {
      return {
        status: "FAILED",
        externalReference: null,
        acknowledgementNumber: null,
        acknowledgementDate: null,
        errorCode: "MOCK_TIMEOUT",
        errorMessage: "Mock GST system timed out before accepting the return.",
        rawResponse: { mode: input.mode, status: "timeout" },
      }
    }

    if (input.mode === "MOCK_PROCESSING") {
      return {
        status: "PROCESSING",
        externalReference,
        acknowledgementNumber: null,
        acknowledgementDate: null,
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: "processing" },
      }
    }

    return {
      status: "ACCEPTED",
      externalReference,
      acknowledgementNumber: `ACK-${externalReference}`,
      acknowledgementDate: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
      rawResponse: { mode: input.mode, status: "accepted" },
    }
  },
  getStatus(input) {
    if (input.currentStatus === "SUBMITTED") {
      return {
        status: "PROCESSING",
        externalReference: input.externalReference,
        acknowledgementNumber: null,
        acknowledgementDate: null,
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: "processing" },
      }
    }

    if (input.currentStatus === "ACCEPTED") {
      return {
        status: "FILED",
        externalReference: input.externalReference,
        acknowledgementNumber:
          input.externalReference ? `ACK-${input.externalReference}` : null,
        acknowledgementDate: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: "filed" },
      }
    }

    if (input.currentStatus === "PROCESSING" && input.mode === "MOCK_PROCESSING") {
      return {
        status: "ACCEPTED",
        externalReference: input.externalReference,
        acknowledgementNumber:
          input.externalReference ? `ACK-${input.externalReference}` : null,
        acknowledgementDate: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: "accepted" },
      }
    }

    if (
      input.currentStatus === "FILED" ||
      input.currentStatus === "REJECTED" ||
      input.currentStatus === "FAILED"
    ) {
      return {
        status: input.currentStatus,
        externalReference: input.externalReference,
        acknowledgementNumber: null,
        acknowledgementDate: null,
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: input.currentStatus.toLowerCase() },
      }
    }

    return {
      status: "PROCESSING",
      externalReference: input.externalReference,
      acknowledgementNumber: null,
      acknowledgementDate: null,
      errorCode: null,
      errorMessage: null,
      rawResponse: { mode: input.mode, status: "processing" },
    }
  },
}
