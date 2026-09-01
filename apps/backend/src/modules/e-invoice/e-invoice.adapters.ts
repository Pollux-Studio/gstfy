import { getEnv } from "../../config/env.js"
import { Irp5Client } from "./irp5/irp5.client.js"
import { toIrp5Payload } from "./irp5/irp5.mapper.js"

import type {
  CanonicalEInvoicePayload,
  EInvoiceProviderResult,
  EInvoiceSubmissionStatus,
} from "./e-invoice.domain.js"

export type EInvoiceGenerateInput = {
  payload: CanonicalEInvoicePayload
  payloadHash: string
}

export type EInvoiceStatusInput = {
  currentStatus: EInvoiceSubmissionStatus
  providerReference: string | null
  irn: string | null
  gstin?: string
}

export type EInvoiceCancelInput = {
  providerReference: string | null
  irn: string
  reason: string
  gstin?: string
}

export type EInvoiceProviderAdapter = {
  name: string
  validate: (payload: CanonicalEInvoicePayload) => Promise<{ ok: boolean; rawResponse: Record<string, unknown> }> | { ok: boolean; rawResponse: Record<string, unknown> }
  generateIRN: (input: EInvoiceGenerateInput) => Promise<EInvoiceProviderResult> | EInvoiceProviderResult
  getStatus: (input: EInvoiceStatusInput) => Promise<EInvoiceProviderResult> | EInvoiceProviderResult
  cancelIRN: (input: EInvoiceCancelInput) => Promise<EInvoiceProviderResult> | EInvoiceProviderResult
}

export function getEInvoiceProviderAdapter(adapterName: string | null | undefined) {
  const configuredProvider = getEnv().EINVOICE_PROVIDER
  const provider = adapterName ?? configuredProvider

  if (provider === irp5EInvoiceProviderAdapter.name) {
    return irp5EInvoiceProviderAdapter
  }

  throw new Error("IRP5 e-invoice provider is not configured.")
}

export const irp5EInvoiceProviderAdapter: EInvoiceProviderAdapter = {
  name: "irp5",
  validate(payload) {
    return {
      ok: true,
      rawResponse: {
        provider: "irp5",
        status: "validated_locally",
        documentNumber: payload.document.number,
      },
    }
  },
  async generateIRN(input) {
    const client = new Irp5Client()
    const response = await client.generate(toIrp5Payload(input.payload))

    return normalizeIrp5Result(response, "generate")
  },
  async getStatus(input) {
    const client = new Irp5Client()
    const response = await client.search({
      irn: input.irn,
      providerReference: input.providerReference,
      gstin: input.gstin,
    })

    return normalizeIrp5Result(response, "status", input)
  },
  async cancelIRN(input) {
    const client = new Irp5Client()
    const response = await client.cancel({
      irn: input.irn,
      reason: input.reason,
      gstin: input.gstin,
    })

    return normalizeIrp5Result(response, "cancel", input)
  },
}

function normalizeIrp5Result(
  response: Record<string, unknown>,
  operation: "generate" | "status" | "cancel",
  input?: EInvoiceStatusInput | EInvoiceCancelInput
): EInvoiceProviderResult {
  const responseData = getResponseData(response)
  const statusCode = getString(responseData, "status", "Status", "statusCode", "StatusCode")
  const providerStatus = getString(response, "status", "Status", "statusCode", "StatusCode")
  const success = isSuccessful(responseData, statusCode, operation) || providerStatus === "1"
  const responseIrn = getString(responseData, "Irn", "IRN", "irn")
  const irn = responseIrn ??
    (input && "irn" in input ? input.irn : null)
  const providerReference = getString(
    responseData,
    "providerReference",
    "referenceId",
    "ReferenceId",
    "AckNo",
    "ackNumber"
  ) ?? (input && "providerReference" in input ? input.providerReference : null)
  const ackNumber = getString(responseData, "AckNo", "ackNumber", "AckNumber")
  const ackDate = getString(responseData, "AckDt", "ackDate", "AckDate")
  const signedInvoiceReference = getString(responseData, "SignedInvoice", "signedInvoiceReference")
  const signedQrCode = getExactString(responseData, "SignedQRCode", "signedQrCode")
  const providerError = getProviderError(responseData) ?? getProviderError(response)
  const errorCode = getString(responseData, "ErrorCode", "errorCode") ?? providerError?.code
  const errorMessage = getString(responseData, "ErrorMessage", "errorMessage", "message") ?? providerError?.message
  const successfulResponse = success || (operation === "generate" && Boolean(responseIrn))

  return {
    status:
      operation === "cancel" ?
        success ? "CANCELLED" : "CANCELLATION_FAILED"
      : successfulResponse && irn ? "IRN_GENERATED"
      : statusCode?.toLowerCase().includes("process") ? "PROCESSING"
      : "FAILED",
    providerReference,
    irn,
    ackNumber,
    ackDate,
    signedInvoiceReference,
    signedQrCode,
    errorCode: successfulResponse ? null : errorCode ?? "IRP5_REQUEST_FAILED",
    errorMessage: successfulResponse ? null : errorMessage ?? "IRP5 rejected the request.",
    rawResponse: response,
  }
}

function getProviderError(response: Record<string, unknown>) {
  const errorDetails = response.ErrorDetails
  if (!Array.isArray(errorDetails)) {
    return null
  }

  const firstError = errorDetails.find((error) =>
    error && typeof error === "object" && !Array.isArray(error)
  )
  if (!firstError) {
    return null
  }

  const errorRecord = firstError as Record<string, unknown>
  const code = getString(errorRecord, "ErrorCode", "errorCode")
  const message = getString(errorRecord, "ErrorMessage", "errorMessage", "message")

  return code || message ? { code, message } : null
}

function getResponseData(response: Record<string, unknown>) {
  const data = response.Data ?? response.data ?? response.Result ?? response.result

  return data && typeof data === "object" && !Array.isArray(data) ?
    data as Record<string, unknown>
    : response
}

function getString(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number") {
      return String(value)
    }
  }

  return null
}

function getExactString(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }

  return null
}

function isSuccessful(
  source: Record<string, unknown>,
  status: string | null,
  operation: "generate" | "status" | "cancel"
) {
  const success = source.Success ?? source.success ?? source.IsSuccess ?? source.isSuccess

  if (typeof success === "boolean") {
    return success
  }

  if (typeof success === "string") {
    return ["true", "1", "success", "successful", "ok"].includes(success.toLowerCase())
  }

  if (operation === "cancel") {
    return status?.toLowerCase().includes("cancel") ?? false
  }

  return Boolean(status && ["success", "successful", "ok", "generated", "processed"].some((value) => status.toLowerCase().includes(value)))
}
