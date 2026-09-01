# Gstfy IRP5 E-Invoice Implementation

## Product Goal

Gstfy lets a business create an e-invoice from a posted sales invoice, submit it to the configured IRP5 sandbox provider, store the government response for audit, and display the resulting IRN and signed QR code in the application and invoice PDF.

The integration is designed so that provider-specific authentication, encryption, response handling, and cancellation remain in the backend. The frontend consumes normalized e-invoice records and presents a simple invoice lifecycle to the user.

## Provider Configuration

IRP5 configuration is loaded by the backend environment schema. The integration requires the IRP5 base URL, client ID, client secret, GSTIN, username, password, app key, and authentication public key.

The sandbox authentication GSTIN is currently resolved to the approved test GSTIN when the e-invoice environment is `sandbox`. Production GSTIN resolution remains separate and live operations are protected by the live-enable flag.

Secrets must remain backend-only. They must never be exposed through frontend environment variables or returned in API responses.

## IRP5 Authentication Flow

1. The backend builds the authentication payload:

   ```json
   {
     "UserName": "...",
     "Password": "...",
     "AppKey": "...",
     "ForceRefreshAccessToken": true
   }
   ```

2. The JSON is base64 encoded.
3. The base64 value is encrypted with the configured IRP5 RSA public key using RSA PKCS#1 padding.
4. The backend sends the encrypted value as `{ "Data": "..." }` to the IRP5 authentication endpoint.
5. Authentication headers include `client_id`, `client_secret`, and `Gstin`.
6. IRP5 returns an `AuthToken` and encrypted `Sek`.
7. The backend decrypts `Sek` using the configured app key and caches the token/session key for the token lifetime.
8. The provider token is passed to later requests with the `Bearer` prefix unchanged.

The authentication cache is invalidated and authentication is retried once when the provider reports request decryption failure.

## IRP5 Request Encryption

For generate, search/status, and cancellation requests:

- The request JSON is encrypted with AES ECB using the decrypted IRP5 session key.
- The encrypted request is sent as `{ "Data": "..." }`.
- Backend headers include client ID, client secret, GSTIN, username, and the complete provider `AuthToken`.
- The returned encrypted `Data` field is decrypted with the same session key.

The decrypted session key is accepted according to its actual AES length. IRP5 sandbox responses can return a 16-byte key; the implementation supports valid AES-128, AES-192, and AES-256 key lengths.

## Generate IRN Workflow

1. A sales invoice is checked for e-invoice eligibility.
2. The backend builds and validates the canonical e-invoice payload.
3. The payload is mapped to the IRP5 schema, including seller, buyer, document, item, and value details.
4. HSN values are validated before submission. The provider requires valid goods HSN values with six to eight characters.
5. The backend submits the encrypted payload to IRP5.
6. The response is decrypted and normalized.
7. The e-invoice record stores:
   - IRN
   - acknowledgement number
   - acknowledgement date
   - signed invoice value
   - signed QR value
   - provider reference
   - raw provider response
   - response timestamp
   - payload hash and schema version
8. A response payload, status event, and audit event are stored.

## Response Status Mapping

IRP5 does not return the GSTfy status names directly. A successful generate response normally contains `Status: 1`, `Data.Status: "ACT"`, an IRN, and an acknowledgement number.

GSTfy maps a successful response to:

```text
IRN_GENERATED
```

`ACT` means the IRP5 e-invoice is active. It is not the same as the internal GSTfy status name.

Failed responses retain the provider error code and message, such as `IRP5_REQUEST_FAILED`. Existing records are not automatically rewritten merely because the detail dialog is opened.

## Queue and Retry Behavior

IRN generation can be queued through the automation job system. A queued record can remain in `SUBMITTING` or `PROCESSING` until the worker completes it.

Retry behavior covers:

- Failed generation
- Provider decryption failures
- Stuck submissions without an IRN or provider reference
- Queue attempts that exceed their configured maximum

Status lookup is only meaningful when an IRN or provider reference exists. When neither exists, the user must retry generation instead of repeatedly checking status.

## IRN Cancellation

Cancellation is available only for an active generated IRN and only within the allowed cancellation window.

The backend validates:

- The record has `IRN_GENERATED` status.
- An IRN exists.
- The cancellation window has not expired.
- A cancellation remark is provided.

The encrypted IRP5 cancellation payload is exactly:

```json
{
  "Irn": "<IRN>",
  "CnlRsn": "1",
  "CnlRem": "<cancel remarks>"
}
```

The unsupported fields `ReferenceId`, `CancelRsnCode`, and `CancelRmrk` are not sent.

Successful cancellation changes the normalized record status to `CANCELLED`, stores the cancellation response, timestamp, user, reason, status event, and audit entry. A cancelled record cannot be cancelled again.

## Signed QR Code Handling

`Data.SignedQRCode` is treated as the complete IRP5 digitally signed JWS string.

Gstfy must not:

- Decode the JWS
- Parse or reconstruct its payload
- Replace it with invoice fields
- Modify whitespace or characters
- Re-sign it
- Generate a substitute QR value

The adapter preserves the returned signed QR string exactly and stores it in `signedQrCode`. The original provider response is also retained in `rawExternalResponse`.

The reusable `createSignedQrDataUrl` utility passes that stored string directly to the `qrcode` encoder. The same utility is used for:

- The e-invoice detail dialog preview
- Invoice PDF rendering

The QR is generated locally at high resolution with a proper quiet zone and can be downloaded from the detail view. The raw signed token is not displayed in the normal UI.

## Invoice PDF Integration

The sales invoice detail response includes the related e-invoice record for the invoice source document. During PDF generation:

1. The renderer reads `invoice.eInvoice.signedQrCode`.
2. The standalone QR utility generates a high-resolution image data URL.
3. The PDF template receives only the generated image data URL.
4. The template renders the QR with the IRN and a verification label.

This keeps QR image generation separate from IRN submission and allows the same stored signed value to be rendered again whenever the invoice PDF is generated.

## Frontend Detail View

The e-invoice detail dialog currently provides:

- Responsive viewport-constrained layout
- Overview tab for lifecycle, IRN, acknowledgement, errors, and current record details
- Verification tab for signed QR, validation details, and compact provider response
- Dedicated generated and cancelled state panels
- Copy and download actions for the QR image
- Provider response preview without rendering large signed JWS strings

The dialog is being extended with a separate History tab. The history view is intended to show status events in a vertical timeline with timestamps, event labels, and status-specific visual markers.

## Important Data Rules

- `rawExternalResponse` is retained for provider audit and troubleshooting.
- Signed values are sensitive provider artifacts and should not be logged unnecessarily.
- `IRN_GENERATED` and `CANCELLED` are GSTfy lifecycle statuses.
- `ACT` is the provider’s active status value.
- `IRP5_REQUEST_FAILED` represents a provider request failure and should remain available as diagnostic information for the relevant failed attempt.
- A successful IRP5 response must never be shown as failed only because the provider uses `Status: 1` and `Data.Status: "ACT"`.

## Main Implementation Locations

| Area | Location |
| --- | --- |
| IRP5 client and encryption flow | `apps/backend/src/modules/e-invoice/irp5/` |
| Provider adapter and response normalization | `apps/backend/src/modules/e-invoice/e-invoice.adapters.ts` |
| E-invoice routes, persistence, queue/retry, cancellation | `apps/backend/src/modules/e-invoice/e-invoice.routes.ts` |
| E-invoice API types and client | `apps/web/lib/e-invoice/api.ts` |
| E-invoice UI | `apps/web/components/e-invoice/e-invoice-page.tsx` |
| Shared QR generation | `apps/web/lib/invoices/signed-qr.ts` |
| Sales invoice PDF integration | `apps/web/lib/sales/sales-invoice-pdf.tsx` |
| Sales invoice PDF template | `apps/web/lib/invoices/templates/sales/reference-01.tsx` |
