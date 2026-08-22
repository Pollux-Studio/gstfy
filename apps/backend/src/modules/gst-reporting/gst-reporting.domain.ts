import { createHash } from "node:crypto"

export type GstReportingRunStatus =
  | "DRAFT"
  | "REVIEW"
  | "READY_FOR_CA_REVIEW"
  | "CA_APPROVED"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "FILED"
  | "LOCKED"
export type GstReportingExportFormat = "csv" | "json" | "xlsx"
export type GstReportingExceptionSeverity = "HIGH" | "MEDIUM" | "LOW"

export type ReportTable = {
  name: string
  headers: string[]
  rows: Array<Array<string | number | boolean | null | undefined>>
}

export function taxPeriodFromDate(value: string) {
  return value.slice(0, 7)
}

export function periodToRange(period: string) {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  return {
    start: formatDateOnly(start),
    endInclusive: formatDateOnly(new Date(end.getTime() - 24 * 60 * 60 * 1000)),
    endExclusive: formatDateOnly(end),
  }
}

export function classifyOutwardSupply(input: {
  supplyType?: string | null
  invoiceType?: string | null
  partyGstin?: string | null
  taxability?: string | null
}) {
  const taxability = input.taxability?.toUpperCase()
  const supplyType = input.supplyType?.toLowerCase()
  const invoiceType = input.invoiceType?.toLowerCase()

  if (taxability === "NIL_RATED") {
    return "NIL_RATED"
  }

  if (taxability === "EXEMPT") {
    return "EXEMPT"
  }

  if (taxability === "NON_GST") {
    return "NON_GST"
  }

  if (supplyType === "export" || invoiceType === "export") {
    return "EXPORT"
  }

  if (supplyType === "sez" || invoiceType === "sez") {
    return "SEZ"
  }

  if (supplyType === "deemed_export" || invoiceType === "deemed_export") {
    return "DEEMED_EXPORT"
  }

  if (supplyType === "b2b" || Boolean(input.partyGstin)) {
    return "B2B"
  }

  return "B2C"
}

export function classifyAdjustment(type: string) {
  const normalized = type.toUpperCase()

  if (normalized === "CREDIT_NOTE" || normalized === "SALES_RETURN") {
    return "CREDIT_NOTE"
  }

  if (normalized === "DEBIT_NOTE" || normalized === "PURCHASE_RETURN") {
    return "DEBIT_NOTE"
  }

  return normalized
}

export function isBlockingSeverity(severity: GstReportingExceptionSeverity) {
  return severity === "HIGH"
}

export function buildGstReportingRequestHash(payload: unknown) {
  return createHash("sha256")
    .update(stableStringify(removeIdempotencyKey(payload)))
    .digest("hex")
}

export function createCsvExport(
  fileName: string,
  tables: ReportTable[]
) {
  const content = tables
    .flatMap((table) => [
      [table.name],
      table.headers,
      ...table.rows,
      [],
    ])
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n")

  return {
    fileName,
    contentType: "text/csv" as const,
    content,
    encoding: "utf8" as const,
  }
}

export function createJsonExport(fileName: string, payload: unknown) {
  return {
    fileName,
    contentType: "application/json" as const,
    content: JSON.stringify(payload, null, 2),
    encoding: "utf8" as const,
  }
}

export function createXlsxExport(fileName: string, tables: ReportTable[]) {
  const bytes = buildSimpleXlsxWorkbook(tables)

  return {
    fileName,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const,
    content: Buffer.from(bytes).toString("base64"),
    encoding: "base64" as const,
  }
}

export function toCents(value: string | number | null | undefined) {
  const normalized = String(value ?? "0").trim()

  if (!normalized) {
    return 0
  }

  return Math.round(Number(normalized) * 100)
}

export function formatCents(cents: number) {
  const sign = cents < 0 ? "-" : ""
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / 100)
  const fraction = String(absolute % 100).padStart(2, "0")

  return `${sign}${whole}.${fraction}`
}

function buildSimpleXlsxWorkbook(tables: ReportTable[]) {
  const sheetXml = buildWorksheetXml(tables)
  const files = new Map<string, Uint8Array>([
    [
      "[Content_Types].xml",
      textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    ],
    [
      "_rels/.rels",
      textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    ],
    [
      "xl/workbook.xml",
      textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="GST Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      textEncoder.encode(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    ],
    ["xl/worksheets/sheet1.xml", textEncoder.encode(sheetXml)],
  ])

  return buildZip(files)
}

function buildWorksheetXml(tables: ReportTable[]) {
  const rows: string[] = []
  let rowIndex = 1

  for (const table of tables) {
    rows.push(buildXlsxRow(rowIndex, [table.name]))
    rowIndex += 1
    rows.push(buildXlsxRow(rowIndex, table.headers))
    rowIndex += 1

    for (const row of table.rows) {
      rows.push(buildXlsxRow(rowIndex, row))
      rowIndex += 1
    }

    rowIndex += 1
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.join("\n")}
  </sheetData>
</worksheet>`
}

function buildXlsxRow(
  rowIndex: number,
  cells: Array<string | number | boolean | null | undefined>
) {
  return `<row r="${rowIndex}">${cells
    .map((cell, index) => buildXlsxCell(rowIndex, index, cell))
    .join("")}</row>`
}

function buildXlsxCell(
  rowIndex: number,
  columnIndex: number,
  value: string | number | boolean | null | undefined
) {
  const ref = `${columnName(columnIndex)}${rowIndex}`

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(
    value === null || value === undefined ? "" : String(value)
  )}</t></is></c>`
}

function columnName(index: number) {
  let value = ""
  let current = index + 1

  while (current > 0) {
    const remainder = (current - 1) % 26
    value = String.fromCharCode(65 + remainder) + value
    current = Math.floor((current - 1) / 26)
  }

  return value
}

function buildZip(files: Map<string, Uint8Array>) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const [name, content] of files) {
    const nameBytes = textEncoder.encode(name)
    const crc = crc32(content)
    const localHeader = concatBytes(
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(content.length),
      uint32(content.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes
    )
    const centralHeader = concatBytes(
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(content.length),
      uint32(content.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nameBytes
    )

    localParts.push(localHeader, content)
    centralParts.push(centralHeader)
    offset += localHeader.length + content.length
  }

  const centralDirectory = concatBytes(...centralParts)
  const endRecord = concatBytes(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.size),
    uint16(files.size),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0)
  )

  return concatBytes(...localParts, centralDirectory, endRecord)
}

function uint16(value: number) {
  const bytes = new Uint8Array(2)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, value, true)
  return bytes
}

function uint32(value: number) {
  const bytes = new Uint8Array(4)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, value >>> 0, true)
  return bytes
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ (crc32Table[(crc ^ byte) & 0xff] ?? 0)
  }

  return (crc ^ 0xffffffff) >>> 0
}

const textEncoder = new TextEncoder()

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value)
  const escaped = text.replaceAll('"', '""')

  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function removeIdempotencyKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => removeIdempotencyKey(entry))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const result: Record<string, unknown> = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (key === "idempotencyKey") {
      continue
    }

    result[key] = removeIdempotencyKey(entryValue)
  }

  return result
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
