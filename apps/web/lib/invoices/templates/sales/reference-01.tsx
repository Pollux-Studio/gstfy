import * as React from "react"

import { getAllGstStates } from "@/lib/gst-state"
import type {
  SalesInvoiceBusinessInfo,
  SalesInvoiceTemplateProps,
} from "@/lib/invoices/templates/sales/types"
import { Image as PdfImage } from "@/lib/pdf-primitives"
import { Path, Svg } from "@/lib/pdf-svg"
import type { SalesInvoiceDetail } from "@/lib/sales/api"

const border = "#111827"
const muted = "#4b5563"
const lightBorder = "#d1d5db"
const gstStates = getAllGstStates()
const itemGridColumns = "6% 39% 8% 6% 10% 8% 6% 17%"
const taxGridColumns = "46% 9% 11% 9% 11% 14%"
const paymentModeLabels = {
  bank: "Bank transfer",
  card: "Card",
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
} as const

export function createReferenceSalesInvoiceTemplate({
  invoice,
  seller,
  template,
  watermarkText,
}: SalesInvoiceTemplateProps) {
  const taxRows = getTaxRows(invoice)
  const totalQuantity = invoice.lines.reduce(
    (total, line) => total + Number(line.quantity || 0),
    0
  )
  const amountInWords = formatAmountInWords(Number(invoice.totalAmount || 0))

  return (
    <main
      style={{
        color: border,
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: 9,
        lineHeight: 1.2,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 0.8,
          marginBottom: 6,
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        {invoice.invoiceType === "bill_of_supply" ? "Bill of Supply" : "Tax Invoice"}
      </div>
      <section
        style={{
          border: `1px solid ${border}`,
          minHeight: 778,
          position: "relative",
        }}
      >
        <InvoiceWatermark text={watermarkText} />
        <HeaderGrid invoice={invoice} seller={seller} />

        <ItemsTable
          dense={template.sourcePage === 7 || template.sourcePage === 3}
          invoice={invoice}
        />

        <TotalsBlock
          amountInWords={amountInWords}
          invoice={invoice}
          taxRows={taxRows}
          totalQuantity={totalQuantity}
        />

        <FooterBlock sellerName={resolveSellerName(seller)} />
      </section>
      <ComputerGeneratedNote />
    </main>
  )
}

function InvoiceWatermark({ text }: { text?: string | null }) {
  const normalizedText = text?.trim().toUpperCase()

  if (!normalizedText) {
    return null
  }

  const fontSize = getWatermarkFontSize(normalizedText)
  const letterSpacing = getWatermarkLetterSpacing(normalizedText)

  return (
    <div
      style={{
        color: "#111827",
        fontSize,
        fontWeight: 700,
        left: 0,
        letterSpacing,
        lineHeight: 1,
        opacity: 0.055,
        position: "absolute",
        right: 0,
        textAlign: "center",
        textTransform: "uppercase",
        top: 355,
        transform: "rotate(-28deg)",
        whiteSpace: "nowrap",
      }}
    >
      {normalizedText}
    </div>
  )
}

function getWatermarkFontSize(value: string) {
  const length = value.length

  if (length <= 8) {
    return 52
  }

  if (length <= 14) {
    return 42
  }

  if (length <= 22) {
    return 32
  }

  return 24
}

function getWatermarkLetterSpacing(value: string) {
  const length = value.length

  if (length <= 8) {
    return 5
  }

  if (length <= 14) {
    return 3
  }

  if (length <= 22) {
    return 1.5
  }

  return 0.5
}

function HeaderGrid({
  invoice,
  seller,
}: {
  invoice: SalesInvoiceDetail
  seller: SalesInvoiceBusinessInfo | null
}) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr" }}>
      <SellerBlock seller={seller} />
      <div style={{ borderLeft: `1px solid ${border}` }}>
        <TwoColumnMeta
          rows={[
            ["Invoice No.", invoice.invoiceNumber],
            ["Dated:", formatDate(invoice.invoiceDate)],
            ["Due Date", formatOptionalDate(invoice.dueDate)],
            ["Mode/ Terms of Payment", getPaymentTerms(invoice)],
            ["Reference No. & Date", getReferenceNumberAndDate(invoice)],
            ["Other References", getOtherReferences(invoice)],
          ]}
        />
      </div>
      <BuyerBlock invoice={invoice} />
      <div style={{ borderLeft: `1px solid ${border}`, borderTop: `1px solid ${border}` }}>
        <TwoColumnMeta
          rows={[
            ["Buyer Type", invoice.supplyType?.toUpperCase() || ""],
            ["Invoice Type", formatInvoiceType(invoice.invoiceType)],
            ["Place of Supply", formatStateNameWithCode(invoice.placeOfSupplyStateCode)],
            ["Payment Status", getPaymentStatus(invoice)],
            ["Amount Received", formatCurrencyText(invoice.amountPaid)],
            ["Amount Due", formatCurrencyText(invoice.amountDue)],
          ]}
        />
        <div
          style={{
            borderTop: `1px solid ${border}`,
            minHeight: 38,
            padding: "7px 10px",
          }}
        >
          <p style={{ color: muted, margin: 0 }}>Terms of Delivery</p>
          <p style={{ fontWeight: 700, margin: "4px 0 0" }}>
            {invoice.notes?.trim() || "Counter / direct sale"}
          </p>
        </div>
      </div>
    </section>
  )
}

function SellerBlock({ seller }: { seller: SalesInvoiceBusinessInfo | null }) {
  return (
    <PartyIdentityBlock
      addressFallback="Seller address not provided"
      addressLines={formatSellerAddressLines(seller)}
      gstn={seller?.gstin}
      logoUrl={seller?.logoUrl}
      name={resolveSellerName(seller)}
      stateLine={formatStateNameWithCode(seller?.stateCode)}
    />
  )
}

function BuyerBlock({ invoice }: { invoice: SalesInvoiceDetail }) {
  const partySnapshot = invoice.partySnapshot
  const buyerName =
    partySnapshot?.tradeName ||
    partySnapshot?.legalName ||
    partySnapshot?.displayName ||
    invoice.customerName ||
    "Walk-in customer"
  const buyerGstin =
    partySnapshot?.gstin || (invoice.supplyType === "b2c" ? "Unregistered" : null)
  const stateCode = partySnapshot?.stateCode || invoice.placeOfSupplyStateCode

  return (
    <PartyIdentityBlock
      addressFallback={
        invoice.supplyType === "b2c" ?
          "Retail customer address not required for B2C sale"
        : "Buyer address not provided"
      }
      addressLines={[]}
      borderTop
      gstn={buyerGstin}
      label="Buyer (Bill to)"
      name={buyerName}
      stateLine={formatStateNameWithCode(stateCode)}
    />
  )
}

function PartyIdentityBlock({
  addressFallback,
  addressLines,
  borderTop = false,
  gstn,
  label,
  logoUrl,
  name,
  stateLine,
}: {
  addressFallback: string
  addressLines: string[]
  borderTop?: boolean
  gstn?: string | null
  label?: string
  logoUrl?: string | null
  name: string
  stateLine: string
}) {
  return (
    <div
      style={{
        borderTop: borderTop ? `1px solid ${border}` : undefined,
        minHeight: 132,
        padding: "9px 10px",
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "grid",
          gap: 8,
          gridTemplateColumns: logoUrl ? "42px 1fr" : "1fr",
        }}
      >
        {logoUrl ?
          <div
            style={{
              alignItems: "center",
              border: `1px solid ${lightBorder}`,
              display: "flex",
              height: 38,
              justifyContent: "center",
              padding: 3,
              width: 38,
            }}
          >
            <PdfImage
              src={logoUrl}
              alt={`${name} logo`}
              style={{
                maxHeight: 30,
                maxWidth: 30,
                objectFit: "contain",
              }}
            />
          </div>
        : null}
        <div>
          {label ?
            <p style={{ color: muted, margin: 0 }}>{label}</p>
          : null}
          <p style={{ fontSize: 13, fontWeight: 700, margin: label ? "4px 0 0" : 0 }}>
            {name}
          </p>
          <p style={{ fontWeight: 700, margin: "5px 0 0" }}>
            GSTN : {gstn || "Not provided"}
          </p>
          {addressLines.length ?
            <div style={{ marginTop: 5 }}>
              {addressLines.map((line, index) => (
                <p key={`${line}-${index}`} style={{ margin: "2px 0 0" }}>
                  {line}
                </p>
              ))}
            </div>
          : <p style={{ margin: "5px 0 0" }}>{addressFallback}</p>
          }
          <p style={{ margin: "5px 0 0" }}>State Name : {stateLine}</p>
        </div>
      </div>
    </div>
  )
}

function TwoColumnMeta({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {rows.map(([label, value], index) => (
        <div
          key={`${label}-${index}`}
          style={{
            borderBottom: index < rows.length - 2 ? `1px solid ${border}` : undefined,
            borderRight: index % 2 === 0 ? `1px solid ${border}` : undefined,
            minHeight: 44,
            padding: "6px 7px",
          }}
        >
          <p style={{ color: muted, fontSize: 8, margin: 0 }}>{label}</p>
          <p style={{ fontWeight: value ? 700 : 400, margin: "5px 0 0" }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function ItemsTable({
  dense,
  invoice,
}: {
  dense: boolean
  invoice: SalesInvoiceDetail
}) {
  const adjustmentRows = getItemAdjustmentRows(invoice)
  const hasAdjustments = adjustmentRows.length > 0
  const visibleBodyRows = invoice.lines.length + (hasAdjustments ? 1 : 0)
  const fillerHeight = Math.max(dense ? 30 : 44, (9 - visibleBodyRows) * (dense ? 14 : 18))

  return (
    <section>
      <InvoiceGrid columns={itemGridColumns} showLeftBorder={false}>
        <InvoiceGridRow columns={itemGridColumns}>
          <InvoiceGridCell align="center" header>
            Sl no.
          </InvoiceGridCell>
          <InvoiceGridCell header>Description of Goods</InvoiceGridCell>
          <InvoiceGridCell header>HSN/SAC</InvoiceGridCell>
          <InvoiceGridCell align="right" header>
            GST
          </InvoiceGridCell>
          <InvoiceGridCell align="right" header>
            Quantity
          </InvoiceGridCell>
          <InvoiceGridCell align="right" header>
            Rate
          </InvoiceGridCell>
          <InvoiceGridCell align="center" header>
            Per
          </InvoiceGridCell>
          <InvoiceGridCell align="right" header hideRightBorder>
            Amount
          </InvoiceGridCell>
        </InvoiceGridRow>
        {invoice.lines.map((line, index) => (
          <InvoiceGridRow key={line.id} columns={itemGridColumns}>
            <InvoiceGridCell align="center">{index + 1}</InvoiceGridCell>
            <InvoiceGridCell strong>{line.itemNameSnapshot}</InvoiceGridCell>
            <InvoiceGridCell>{line.hsnSacCode || "-"}</InvoiceGridCell>
            <InvoiceGridCell align="right">{formatPercent(line.gstRate)}</InvoiceGridCell>
            <InvoiceGridCell align="right">
              {formatQuantity(line.quantity, line.unit)}
            </InvoiceGridCell>
            <InvoiceGridCell align="right">
              <CurrencyValue value={line.rate} />
            </InvoiceGridCell>
            <InvoiceGridCell align="center">{line.unit || "-"}</InvoiceGridCell>
            <InvoiceGridCell align="right" hideRightBorder>
              <CurrencyValue value={line.taxableValue} />
            </InvoiceGridCell>
          </InvoiceGridRow>
        ))}
        <InvoiceGridRow columns={itemGridColumns}>
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell height={fillerHeight} hideBottomBorder={hasAdjustments} />
          <InvoiceGridCell
            height={fillerHeight}
            hideBottomBorder={hasAdjustments}
            hideRightBorder
          />
        </InvoiceGridRow>
        {hasAdjustments ?
          <InvoiceGridRow columns={itemGridColumns}>
            <InvoiceGridCell />
            <InvoiceGridCell align="right" strong>
              <StackedLines align="right" lines={adjustmentRows.map((row) => row.label)} />
            </InvoiceGridCell>
            <InvoiceGridCell />
            <InvoiceGridCell />
            <InvoiceGridCell />
            <InvoiceGridCell />
            <InvoiceGridCell />
            <InvoiceGridCell align="right" hideRightBorder>
              <StackedCurrencyValues values={adjustmentRows.map((row) => row.amount)} />
            </InvoiceGridCell>
          </InvoiceGridRow>
        : null}
        <InvoiceGridRow columns={itemGridColumns}>
          <InvoiceGridCell />
          <InvoiceGridCell align="right" strong>
            Total
          </InvoiceGridCell>
          <InvoiceGridCell />
          <InvoiceGridCell />
          <InvoiceGridCell align="right" strong>
            {formatQuantity(String(getTotalQuantity(invoice)), getPrimaryUnit(invoice))}
          </InvoiceGridCell>
          <InvoiceGridCell />
          <InvoiceGridCell />
          <InvoiceGridCell align="right" hideRightBorder strong>
            <CurrencyValue value={invoice.totalAmount} />
          </InvoiceGridCell>
        </InvoiceGridRow>
      </InvoiceGrid>
    </section>
  )
}

function InvoiceGrid({
  children,
  columns,
  showLeftBorder = true,
}: {
  children: React.ReactNode
  columns: string
  showLeftBorder?: boolean
}) {
  return (
    <div
      data-grid-columns={columns}
      style={{
        borderLeft: showLeftBorder ? `1px solid ${border}` : undefined,
        borderTop: `1px solid ${border}`,
        width: "100%",
      }}
    >
      {children}
    </div>
  )
}

function InvoiceGridRow({
  children,
  columns,
}: {
  children: React.ReactNode
  columns: string
}) {
  return (
    <div
      style={{
        display: "grid",
        gridColumn: "1 / -1",
        gridTemplateColumns: columns,
      }}
    >
      {children}
    </div>
  )
}

function InvoiceGridCell({
  borderless = false,
  children,
  align = "left",
  header = false,
  hideBottomBorder = false,
  hideRightBorder = false,
  strong = false,
  height,
  span,
}: {
  borderless?: boolean
  children?: React.ReactNode
  align?: "left" | "center" | "right"
  header?: boolean
  hideBottomBorder?: boolean
  hideRightBorder?: boolean
  strong?: boolean
  height?: number
  span?: number
}) {
  return (
    <div
      style={{
        backgroundColor: header ? "#f9fafb" : undefined,
        borderBottom:
          borderless || hideBottomBorder ? undefined : `1px solid ${header ? border : lightBorder}`,
        borderRight: borderless || hideRightBorder ? undefined : `1px solid ${lightBorder}`,
        fontSize: 8,
        fontWeight: header || strong ? 700 : 400,
        gridColumn: span ? `span ${span}` : undefined,
        height,
        padding: "5px",
        textAlign: align,
        verticalAlign: "top",
      }}
    >
      {children}
    </div>
  )
}

function StackedLines({
  align = "left",
  lines,
}: {
  align?: "left" | "right"
  lines: string[]
}) {
  return (
    <div style={{ textAlign: align }}>
      {lines.map((line) => (
        <p key={line} style={{ margin: "0 0 3px" }}>
          {line}
        </p>
      ))}
    </div>
  )
}

function StackedCurrencyValues({ values }: { values: number[] }) {
  return (
    <div style={{ textAlign: "right" }}>
      {values.map((value, index) => (
        <p key={`${value}-${index}`} style={{ margin: "0 0 3px" }}>
          <AdjustmentCurrencyValue value={value} />
        </p>
      ))}
    </div>
  )
}

function AdjustmentCurrencyValue({ value }: { value: number }) {
  if (value < 0) {
    return (
      <span
        style={{
          alignItems: "center",
          display: "inline-flex",
          gap: 2,
          justifyContent: "flex-end",
          whiteSpace: "nowrap",
        }}
      >
        <span>(- )</span>
        <CurrencyValue value={Math.abs(value)} />
      </span>
    )
  }

  return <CurrencyValue value={value} />
}

function TotalsBlock({
  amountInWords,
  invoice,
  taxRows,
  totalQuantity,
}: {
  amountInWords: string
  invoice: SalesInvoiceDetail
  taxRows: TaxRow[]
  totalQuantity: number
}) {
  return (
    <section style={{ borderTop: `1px solid ${border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 150px" }}>
        <div style={{ padding: "7px 10px" }}>
          <p style={{ color: muted, margin: 0 }}>Amount Chargeable (in words)</p>
          <p style={{ fontWeight: 700, margin: "4px 0 0" }}>{amountInWords}</p>
        </div>
        <div style={{ borderLeft: `1px solid ${border}`, padding: "7px 10px", textAlign: "right" }}>
          <p style={{ color: muted, margin: 0 }}>E & O.E</p>
          <p style={{ fontWeight: 700, margin: "4px 0 0" }}>
            <CurrencyValue value={invoice.totalAmount} />
          </p>
        </div>
      </div>
      <InvoiceGrid columns={taxGridColumns} showLeftBorder={false}>
        <TaxSummaryHeader />
        {taxRows.map((row) => (
          <InvoiceGridRow key={row.rate} columns={taxGridColumns}>
            <InvoiceGridCell align="right">
              <CurrencyValue value={row.taxableValue} />
            </InvoiceGridCell>
            <InvoiceGridCell align="right">{row.cgstRate}</InvoiceGridCell>
            <InvoiceGridCell align="right">
              <CurrencyValue value={row.cgstAmount} />
            </InvoiceGridCell>
            <InvoiceGridCell align="right">{row.sgstRate}</InvoiceGridCell>
            <InvoiceGridCell align="right">
              <CurrencyValue value={row.sgstAmount} />
            </InvoiceGridCell>
            <InvoiceGridCell align="right" hideRightBorder>
              <CurrencyValue value={row.totalTaxAmount} />
            </InvoiceGridCell>
          </InvoiceGridRow>
        ))}
        <InvoiceGridRow columns={taxGridColumns}>
          <InvoiceGridCell align="right" strong>
            Total: <CurrencyValue value={invoice.taxableValue} />
          </InvoiceGridCell>
          <InvoiceGridCell />
          <InvoiceGridCell align="right" strong>
            <CurrencyValue value={invoice.cgstAmount} />
          </InvoiceGridCell>
          <InvoiceGridCell />
          <InvoiceGridCell align="right" strong>
            <CurrencyValue value={invoice.sgstAmount} />
          </InvoiceGridCell>
          <InvoiceGridCell align="right" hideRightBorder strong>
            <CurrencyValue value={getSalesGstAmount(invoice)} />
          </InvoiceGridCell>
        </InvoiceGridRow>
      </InvoiceGrid>
      <div style={{ borderTop: `1px solid ${border}`, padding: "7px 10px" }}>
        <p style={{ margin: 0 }}>
          Tax Amount (in words): {formatAmountInWords(getSalesGstAmount(invoice))}
        </p>
        <p style={{ color: muted, margin: "4px 0 0" }}>
          Total Quantity: {formatNumber(totalQuantity)}
        </p>
      </div>
    </section>
  )
}

function TaxSummaryHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: taxGridColumns,
        gridTemplateRows: "20px 20px",
      }}
    >
      <TaxHeaderCell align="right" gridColumn="1" gridRow="1 / span 2">
        Taxable Value
      </TaxHeaderCell>
      <TaxHeaderCell align="center" gridColumn="2 / span 2" gridRow="1">
        CGST
      </TaxHeaderCell>
      <TaxHeaderCell align="center" gridColumn="4 / span 2" gridRow="1">
        SGST/UTGST
      </TaxHeaderCell>
      <TaxHeaderCell align="right" gridColumn="6" gridRow="1 / span 2" hideRightBorder>
        Total Tax Amount
      </TaxHeaderCell>
      <TaxHeaderCell align="right" gridColumn="2" gridRow="2">
        Rate
      </TaxHeaderCell>
      <TaxHeaderCell align="right" gridColumn="3" gridRow="2">
        Amount
      </TaxHeaderCell>
      <TaxHeaderCell align="right" gridColumn="4" gridRow="2">
        Rate
      </TaxHeaderCell>
      <TaxHeaderCell align="right" gridColumn="5" gridRow="2">
        Amount
      </TaxHeaderCell>
    </div>
  )
}

function TaxHeaderCell({
  align,
  children,
  gridColumn,
  gridRow,
  hideRightBorder = false,
}: {
  align: "center" | "right"
  children: React.ReactNode
  gridColumn: string
  gridRow: string
  hideRightBorder?: boolean
}) {
  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#f9fafb",
        borderBottom: `1px solid ${border}`,
        borderRight: hideRightBorder ? undefined : `1px solid ${lightBorder}`,
        display: "flex",
        fontSize: 8,
        fontWeight: 700,
        gridColumn,
        gridRow,
        justifyContent: align === "right" ? "flex-end" : "center",
        padding: "5px",
        textAlign: align,
      }}
    >
      {children}
    </div>
  )
}

function FooterBlock({ sellerName }: { sellerName: string }) {
  return (
    <section
      style={{
        borderTop: `1px solid ${border}`,
        display: "grid",
        gridTemplateColumns: "1fr 190px",
        minHeight: 82,
      }}
    >
      <div style={{ padding: "8px 10px" }}>
        <p style={{ fontWeight: 700, margin: 0 }}>Declaration</p>
        <p style={{ margin: "5px 0 0" }}>
          We declare that this sales invoice shows the actual price of the goods or services
          supplied and that all particulars are true and correct.
        </p>
      </div>
      <div style={{ borderLeft: `1px solid ${border}`, padding: "8px 10px", textAlign: "right" }}>
        <p style={{ fontWeight: 700, margin: 0 }}>for {sellerName}</p>
        <p style={{ margin: "44px 0 0" }}>Authorised Signatory</p>
      </div>
    </section>
  )
}

function ComputerGeneratedNote() {
  return (
    <div
      style={{
        color: "#6b7280",
        fontSize: 8,
        marginTop: 6,
        textAlign: "center",
      }}
    >
      This is a Computer Generated Invoice
    </div>
  )
}

type TaxRow = {
  rate: string
  taxableValue: number
  cgstRate: string
  cgstAmount: number
  sgstRate: string
  sgstAmount: number
  igstAmount: number
  totalTaxAmount: number
}

type ItemAdjustmentRow = {
  label: string
  amount: number
}

function getTaxRows(invoice: SalesInvoiceDetail): TaxRow[] {
  const rows = new Map<string, TaxRow>()

  for (const line of invoice.lines) {
    const rate = line.gstRate
    const gstRate = Number(rate || 0)
    const existing =
      rows.get(rate) ??
      {
        rate,
        taxableValue: 0,
        cgstRate: line.cgstAmount !== "0.00" ? `${formatNumber(gstRate / 2)}%` : "-",
        cgstAmount: 0,
        sgstRate: line.sgstAmount !== "0.00" ? `${formatNumber(gstRate / 2)}%` : "-",
        sgstAmount: 0,
        igstAmount: 0,
        totalTaxAmount: 0,
      }

    existing.taxableValue += Number(line.taxableValue || 0)
    existing.cgstAmount += Number(line.cgstAmount || 0)
    existing.sgstAmount += Number(line.sgstAmount || 0)
    existing.igstAmount += Number(line.igstAmount || 0)
    existing.totalTaxAmount +=
      Number(line.cgstAmount || 0) +
      Number(line.sgstAmount || 0) +
      Number(line.igstAmount || 0)
    rows.set(rate, existing)
  }

  return Array.from(rows.values())
}

function getItemAdjustmentRows(invoice: SalesInvoiceDetail): ItemAdjustmentRow[] {
  const rows: ItemAdjustmentRow[] = []
  const cgstAmount = toAmount(invoice.cgstAmount)
  const sgstAmount = toAmount(invoice.sgstAmount)
  const igstAmount = toAmount(invoice.igstAmount)

  if (isNonZeroAmount(sgstAmount)) {
    rows.push({ label: "SGST", amount: sgstAmount })
  }

  if (isNonZeroAmount(cgstAmount)) {
    rows.push({ label: "CGST", amount: cgstAmount })
  }

  if (isNonZeroAmount(igstAmount)) {
    rows.push({ label: "IGST", amount: igstAmount })
  }

  const roundOff =
    toAmount(invoice.totalAmount) -
    toAmount(invoice.taxableValue) -
    cgstAmount -
    sgstAmount -
    igstAmount

  if (isNonZeroAmount(roundOff)) {
    rows.push({ label: "Round Off", amount: roundOff })
  }

  return rows
}

function getSalesGstAmount(invoice: SalesInvoiceDetail) {
  return toAmount(invoice.cgstAmount) + toAmount(invoice.sgstAmount) + toAmount(invoice.igstAmount)
}

function getTotalQuantity(invoice: SalesInvoiceDetail) {
  return invoice.lines.reduce((total, line) => total + Number(line.quantity || 0), 0)
}

function getPrimaryUnit(invoice: SalesInvoiceDetail) {
  const units = Array.from(new Set(invoice.lines.map((line) => line.unit).filter(Boolean)))
  return units.length === 1 ? units[0] : ""
}

function getPaymentTerms(invoice: SalesInvoiceDetail) {
  const paymentModes = Array.from(
    new Set(
      invoice.payments
        .map((payment) => payment.paymentMode)
        .filter((mode): mode is keyof typeof paymentModeLabels => Boolean(mode))
        .map((mode) => paymentModeLabels[mode])
    )
  )

  if (paymentModes.length) {
    return paymentModes.join(", ")
  }

  if (toAmount(invoice.amountDue) > 0) {
    return "Credit"
  }

  if (toAmount(invoice.amountPaid) > 0) {
    return "Paid"
  }

  return "Not recorded"
}

function getReferenceNumberAndDate(invoice: SalesInvoiceDetail) {
  return `${invoice.invoiceNumber} / ${formatDate(invoice.invoiceDate)}`
}

function getOtherReferences(invoice: SalesInvoiceDetail) {
  const paymentReferences = invoice.payments
    .map((payment) => payment.referenceNumber?.trim())
    .filter((value): value is string => Boolean(value))

  if (paymentReferences.length) {
    return paymentReferences.join(", ")
  }

  return invoice.notes?.trim() || ""
}

function getPaymentStatus(invoice: SalesInvoiceDetail) {
  if (invoice.status !== "posted") {
    return invoice.status === "quotation" ? "Quotation" : "Draft"
  }

  if (toAmount(invoice.amountDue) <= 0) {
    return "Paid"
  }

  if (toAmount(invoice.amountPaid) > 0) {
    return "Partly paid"
  }

  return "Unpaid"
}

function formatInvoiceType(value: string) {
  return value === "bill_of_supply" ? "Bill of Supply" : "Tax Invoice"
}

function resolveSellerName(seller: SalesInvoiceBusinessInfo | null) {
  return seller?.tradeName || seller?.legalName || "Seller"
}

function formatSellerAddressLines(seller: SalesInvoiceBusinessInfo | null) {
  if (!seller) {
    return []
  }

  return formatPartyAddressLines({
    addressLine1: seller.addressLine1,
    addressLine2: seller.addressLine2,
    locality: seller.locality,
    district: seller.district,
    stateCode: seller.stateCode,
    pincode: seller.pincode,
  })
}

function formatPartyAddressLines(address: {
  addressLine1?: string | null
  addressLine2?: string | null
  locality?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  stateCode?: string | null
  pincode?: string | null
  country?: string | null
}) {
  const cityLine = joinParts([address.locality, address.city])
  const districtStateLine = joinParts([
    address.district,
    getAddressStateName(address.stateCode, address.state),
    address.pincode,
  ])
  const countryLine = address.country && address.country !== "India" ? address.country : null

  return [
    address.addressLine1,
    address.addressLine2,
    cityLine,
    districtStateLine,
    countryLine,
  ].filter((line): line is string => Boolean(line))
}

function formatStateNameWithCode(
  stateCode: string | null | undefined,
  explicitStateName?: string | null
) {
  if (!stateCode) {
    return explicitStateName || "Not provided"
  }

  const stateName = explicitStateName || getStateName(stateCode)

  return stateName ? `${stateName}, Code : ${stateCode}` : `Code : ${stateCode}`
}

function getAddressStateName(
  stateCode: string | null | undefined,
  explicitStateName?: string | null
) {
  if (!stateCode && !explicitStateName) {
    return null
  }

  return explicitStateName || (stateCode ? getStateName(stateCode) : null)
}

function getStateName(stateCode: string) {
  return gstStates.find((state) => state.code === stateCode)?.name ?? null
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ") || null
}

function formatNumber(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value || 0))
}

function formatPercent(value: string | number) {
  const numericValue = toAmount(value)

  return isNonZeroAmount(numericValue) ? `${formatNumber(numericValue)}%` : "-"
}

function formatCurrencyText(value: string | number) {
  return `Rs. ${formatNumber(value)}`
}

function toAmount(value: string | number | null | undefined) {
  return Number(value || 0)
}

function isNonZeroAmount(value: number) {
  return Math.abs(value) >= 0.01
}

function CurrencyValue({ value }: { value: string | number }) {
  return (
    <span
      style={{
        alignItems: "center",
        display: "inline-flex",
        gap: 2,
        justifyContent: "flex-end",
        whiteSpace: "nowrap",
      }}
    >
      <RupeeMark />
      <span>{formatNumber(value)}</span>
    </span>
  )
}

function RupeeMark() {
  return (
    <Svg
      aria-hidden="true"
      height={8}
      style={{
        display: "inline-block",
        flexShrink: 0,
      }}
      viewBox="0 0 24 24"
      width={8}
    >
      {[
        "M6 3h12",
        "M6 8h12",
        "M6 13h3",
        "M9 13c6.667 0 6.667-10 0-10",
        "m6 13 8.5 8",
      ].map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={border}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      ))}
    </Svg>
  )
}

function formatQuantity(quantity: string, unit: string) {
  return `${formatNumber(quantity)}${unit ? ` ${unit}` : ""}`
}

function formatDate(value: string) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(new Date(`${value}T00:00:00`))
}

function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDate(value) : ""
}

function formatAmountInWords(amount: number) {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  const rupeeWords = numberToIndianWords(rupees)

  if (paise > 0) {
    return `Rupees ${rupeeWords} and ${numberToIndianWords(paise)} Paise Only`
  }

  return `Rupees ${rupeeWords} Only`
}

function numberToIndianWords(value: number): string {
  if (value === 0) {
    return "Zero"
  }

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ]
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ]

  function belowHundred(num: number) {
    if (num < 20) {
      return ones[num]
    }

    return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ""}`
  }

  function belowThousand(num: number) {
    const hundred = Math.floor(num / 100)
    const rest = num % 100

    return [
      hundred ? `${ones[hundred]} Hundred` : "",
      rest ? belowHundred(rest) : "",
    ]
      .filter(Boolean)
      .join(" ")
  }

  const parts: string[] = []
  const crore = Math.floor(value / 10000000)
  value %= 10000000
  const lakh = Math.floor(value / 100000)
  value %= 100000
  const thousand = Math.floor(value / 1000)
  value %= 1000

  if (crore) {
    parts.push(`${belowThousand(crore)} Crore`)
  }

  if (lakh) {
    parts.push(`${belowThousand(lakh)} Lakh`)
  }

  if (thousand) {
    parts.push(`${belowThousand(thousand)} Thousand`)
  }

  if (value) {
    parts.push(belowThousand(value))
  }

  return parts.join(" ")
}
