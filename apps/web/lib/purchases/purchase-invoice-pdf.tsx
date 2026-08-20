import * as React from "react"
import { render } from "takumi-pdf/next"

import type { PurchaseBill, PurchaseBillDetail } from "@/lib/purchases/api"

export async function renderPurchaseInvoicePdf(bill: PurchaseBillDetail) {
  const bytes = await render(createPurchaseInvoicePdfNode(bill), {
    size: "a4",
    margin: { top: 36, right: 32, bottom: 36, left: 32 },
  })
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)

  return buffer
}

function createPurchaseInvoicePdfNode(bill: PurchaseBillDetail) {
  const tableHeadStyle: React.CSSProperties = {
    borderBottom: "1px solid #d1d5db",
    color: "#4b5563",
    fontSize: 10,
    fontWeight: 700,
    padding: "8px 6px",
    textAlign: "left",
    textTransform: "uppercase",
  }
  const cellStyle: React.CSSProperties = {
    borderBottom: "1px solid #e5e7eb",
    padding: "8px 6px",
    verticalAlign: "top",
  }
  const amountHeadStyle: React.CSSProperties = {
    ...tableHeadStyle,
    textAlign: "right",
  }
  const amountCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: "right",
    whiteSpace: "nowrap",
  }
  const gstAmount = getPurchaseGstAmount(bill)

  return (
    <main style={{ color: "#111827", fontFamily: "Arial, sans-serif", fontSize: 12 }}>
      <section
        style={{
          alignItems: "flex-start",
          borderBottom: "2px solid #111827",
          display: "flex",
          justifyContent: "space-between",
          paddingBottom: 18,
        }}
      >
        <div>
          <p
            style={{
              color: "#2563eb",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.8,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Gstfy purchase record
          </p>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, margin: "8px 0 0" }}>
            Purchase invoice
          </h1>
          <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
            Supplier bill captured for input GST, stock and payable tracking.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>Bill number</p>
          <p
            style={{
              fontFamily: "Courier, monospace",
              fontSize: 16,
              fontWeight: 700,
              margin: "4px 0 0",
            }}
          >
            {bill.billNumber}
          </p>
          <p style={{ color: "#6b7280", margin: "10px 0 0" }}>
            {formatDate(bill.billDate)}
          </p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "1fr 1fr",
          marginTop: 20,
        }}
      >
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <p
            style={{
              color: "#6b7280",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              margin: 0,
            }}
          >
            SUPPLIER
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 0" }}>
            {bill.supplierName}
          </p>
          <p style={{ color: "#6b7280", margin: "6px 0 0" }}>
            Supplier invoice: {bill.supplierInvoiceNumber || "Not provided"}
          </p>
          <p style={{ color: "#6b7280", margin: "4px 0 0" }}>
            Invoice date: {formatDate(bill.invoiceDate)}
          </p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <p
            style={{
              color: "#6b7280",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              margin: 0,
            }}
          >
            SUMMARY
          </p>
          <PdfSummaryRow label="Taxable" value={formatCurrency(bill.taxableValue)} />
          <PdfSummaryRow label="GST" value={formatCurrency(gstAmount)} />
          <PdfSummaryRow label="Paid" value={formatCurrency(bill.amountPaid)} />
          <PdfSummaryRow label="Due" value={formatCurrency(bill.amountDue)} strong />
        </div>
      </section>

      <table style={{ borderCollapse: "collapse", marginTop: 22, width: "100%" }}>
        <thead>
          <tr>
            <th style={tableHeadStyle}>Item</th>
            <th style={amountHeadStyle}>Qty</th>
            <th style={amountHeadStyle}>Rate</th>
            <th style={amountHeadStyle}>Taxable</th>
            <th style={amountHeadStyle}>GST</th>
            <th style={amountHeadStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((line) => (
            <tr key={line.id}>
              <td style={cellStyle}>
                <div style={{ fontWeight: 700 }}>{line.itemNameSnapshot}</div>
                <div style={{ color: "#6b7280", fontSize: 10, marginTop: 3 }}>
                  {line.hsnSacCode || "No HSN"} | GST {line.gstRate}% | {line.unit}
                </div>
              </td>
              <td style={amountCellStyle}>{line.quantity}</td>
              <td style={amountCellStyle}>{formatCurrency(line.rate)}</td>
              <td style={amountCellStyle}>{formatCurrency(line.taxableValue)}</td>
              <td style={amountCellStyle}>
                {formatCurrency(
                  Number(line.cgstAmount) + Number(line.sgstAmount) + Number(line.igstAmount)
                )}
              </td>
              <td style={amountCellStyle}>{formatCurrency(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, width: 260 }}>
          <PdfSummaryRow label="CGST" value={formatCurrency(bill.cgstAmount)} />
          <PdfSummaryRow label="SGST" value={formatCurrency(bill.sgstAmount)} />
          <PdfSummaryRow label="IGST" value={formatCurrency(bill.igstAmount)} />
          <PdfSummaryRow label="Total" value={formatCurrency(bill.totalAmount)} strong />
        </div>
      </section>

      {bill.notes ? (
        <section
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 12,
            marginTop: 18,
            padding: 14,
          }}
        >
          <p
            style={{
              color: "#6b7280",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              margin: 0,
            }}
          >
            NOTES
          </p>
          <p style={{ margin: "8px 0 0" }}>{bill.notes}</p>
        </section>
      ) : null}
    </main>
  )
}

function PdfSummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        marginTop: 8,
      }}
    >
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontFamily: "Courier, monospace", fontWeight: strong ? 700 : 400 }}>
        {value}
      </span>
    </div>
  )
}

function getPurchaseGstAmount(bill: PurchaseBill) {
  return Number(bill.cgstAmount) + Number(bill.sgstAmount) + Number(bill.igstAmount)
}

function formatCurrency(value: string | number) {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

  return `INR ${formatted}`
}

function formatDate(value: string) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}
