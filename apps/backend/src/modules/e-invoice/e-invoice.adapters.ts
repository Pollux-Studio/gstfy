import { createHash } from "node:crypto"

import type {
  CanonicalEInvoicePayload,
  EInvoiceMockMode,
  EInvoiceProviderResult,
  EInvoiceSubmissionStatus,
} from "./e-invoice.domain.js"

export type EInvoiceGenerateInput = {
  mode: EInvoiceMockMode
  payload: CanonicalEInvoicePayload
  payloadHash: string
}

export type EInvoiceStatusInput = {
  currentStatus: EInvoiceSubmissionStatus
  mode: EInvoiceMockMode | null
  providerReference: string | null
  irn: string | null
}

export type EInvoiceCancelInput = {
  mode: EInvoiceMockMode
  providerReference: string | null
  irn: string
  reason: string
}

export type EInvoiceProviderAdapter = {
  name: string
  validate: (payload: CanonicalEInvoicePayload) => { ok: boolean; rawResponse: Record<string, unknown> }
  generateIRN: (input: EInvoiceGenerateInput) => EInvoiceProviderResult
  getStatus: (input: EInvoiceStatusInput) => EInvoiceProviderResult
  cancelIRN: (input: EInvoiceCancelInput) => EInvoiceProviderResult
}

export function getEInvoiceProviderAdapter(adapterName: string | null | undefined) {
  if (!adapterName || adapterName === mockEInvoiceProviderAdapter.name) {
    return mockEInvoiceProviderAdapter
  }

  throw new Error(`E-invoice adapter ${adapterName} is not configured.`)
}

export const mockEInvoiceProviderAdapter: EInvoiceProviderAdapter = {
  name: "mock",
  validate(payload) {
    return {
      ok: true,
      rawResponse: {
        provider: "mock",
        documentNumber: payload.document.number,
        status: "validated",
      },
    }
  },
  generateIRN(input) {
    const providerReference = buildProviderReference(input.payload, input.payloadHash)

    if (input.mode === "MOCK_REJECT") {
      return {
        status: "FAILED",
        providerReference,
        irn: null,
        ackNumber: null,
        ackDate: null,
        signedInvoiceReference: null,
        signedQrCode: null,
        errorCode: "MOCK_IRP_REJECTED",
        errorMessage: "Mock IRP rejected this e-invoice payload.",
        rawResponse: { mode: input.mode, status: "rejected", providerReference },
      }
    }

    if (input.mode === "MOCK_TIMEOUT") {
      return {
        status: "FAILED",
        providerReference: null,
        irn: null,
        ackNumber: null,
        ackDate: null,
        signedInvoiceReference: null,
        signedQrCode: null,
        errorCode: "MOCK_IRP_TIMEOUT",
        errorMessage: "Mock IRP timed out before accepting the e-invoice.",
        rawResponse: { mode: input.mode, status: "timeout" },
      }
    }

    if (input.mode === "MOCK_PROCESSING") {
      return {
        status: "PROCESSING",
        providerReference,
        irn: null,
        ackNumber: null,
        ackDate: null,
        signedInvoiceReference: null,
        signedQrCode: null,
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: "processing", providerReference },
      }
    }

    return buildGeneratedResult(input.payload, input.payloadHash, providerReference, input.mode)
  },
  getStatus(input) {
    if (input.currentStatus === "PROCESSING" && input.providerReference) {
      const irn = buildMockIrn(input.providerReference)
      return {
        status: "IRN_GENERATED",
        providerReference: input.providerReference,
        irn,
        ackNumber: `ACK-${input.providerReference}`,
        ackDate: new Date().toISOString(),
        signedInvoiceReference: `mock://signed-invoice/${irn}`,
        signedQrCode: buildMockQr(input.providerReference, irn),
        errorCode: null,
        errorMessage: null,
        rawResponse: { mode: input.mode, status: "generated" },
      }
    }

    return {
      status: input.currentStatus === "IRN_GENERATED" ? "IRN_GENERATED" : "PROCESSING",
      providerReference: input.providerReference,
      irn: input.irn,
      ackNumber: input.irn ? `ACK-${input.providerReference ?? input.irn.slice(0, 12)}` : null,
      ackDate: input.irn ? new Date().toISOString() : null,
      signedInvoiceReference: input.irn ? `mock://signed-invoice/${input.irn}` : null,
      signedQrCode:
        input.irn && input.providerReference ?
          buildMockQr(input.providerReference, input.irn)
        : null,
      errorCode: null,
      errorMessage: null,
      rawResponse: { mode: input.mode, status: input.currentStatus.toLowerCase() },
    }
  },
  cancelIRN(input) {
    if (input.mode === "MOCK_CANCEL_FAIL") {
      return {
        status: "CANCELLATION_FAILED",
        providerReference: input.providerReference,
        irn: input.irn,
        ackNumber: null,
        ackDate: null,
        signedInvoiceReference: null,
        signedQrCode: null,
        errorCode: "MOCK_CANCEL_FAILED",
        errorMessage: "Mock IRP cancellation failed.",
        rawResponse: { mode: input.mode, status: "cancel_failed", reason: input.reason },
      }
    }

    return {
      status: "CANCELLED",
      providerReference: input.providerReference,
      irn: input.irn,
      ackNumber: null,
      ackDate: new Date().toISOString(),
      signedInvoiceReference: null,
      signedQrCode: null,
      errorCode: null,
      errorMessage: null,
      rawResponse: { mode: input.mode, status: "cancelled", reason: input.reason },
    }
  },
}

function buildGeneratedResult(
  payload: CanonicalEInvoicePayload,
  payloadHash: string,
  providerReference: string,
  mode: EInvoiceMockMode
): EInvoiceProviderResult {
  const irn = buildMockIrn(`${providerReference}:${payloadHash}`)

  return {
    status: "IRN_GENERATED",
    providerReference,
    irn,
    ackNumber: `ACK-${providerReference}`,
    ackDate: new Date().toISOString(),
    signedInvoiceReference: `mock://signed-invoice/${irn}`,
    signedQrCode: buildMockQr(providerReference, irn),
    errorCode: null,
    errorMessage: null,
    rawResponse: {
      mode,
      status: "generated",
      providerReference,
      documentNumber: payload.document.number,
    },
  }
}

function buildProviderReference(payload: CanonicalEInvoicePayload, payloadHash: string) {
  const suffix = payloadHash.slice(0, 12).toUpperCase()
  return `MOCK-EINV-${payload.document.number.replace(/[^A-Za-z0-9]/g, "")}-${suffix}`
}

function buildMockIrn(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase()
}

function buildMockQr(providerReference: string, irn: string) {
  return Buffer.from(
    JSON.stringify({
      provider: "mock",
      providerReference,
      irn,
    })
  ).toString("base64")
}
