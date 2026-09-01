import type { CanonicalEInvoicePayload } from "../e-invoice.domain.js"

export function toIrp5Payload(payload: CanonicalEInvoicePayload) {
  return {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: payload.document.supplyType.toUpperCase(),
      RegRev: "N",
      EcmGstin: null,
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: payload.document.type,
      No: payload.document.number,
      Dt: toIrpDate(payload.document.date),
    },
    SellerDtls: toParty(payload.supplier),
    BuyerDtls: toParty(
      payload.recipient,
      payload.document.placeOfSupplyStateCode ?? payload.recipient.stateCode
    ),
    ItemList: payload.items.map((item) => ({
      SlNo: String(item.serialNumber),
      IsServc: "N",
      PrdDesc: item.description,
      HsnCd: requireString(item.hsnSac, `Line ${item.serialNumber} HSN/SAC`),
      Qty: Number(item.quantity),
      Unit: item.uqc,
      UnitPrice: Number(item.unitPrice),
      Discount: Number(item.discount),
      TotAmt: Number(item.taxableValue) + Number(item.discount),
      PreTaxVal: 0,
      AssAmt: Number(item.taxableValue),
      GstRt: Number(item.gstRate),
      IgstAmt: Number(item.igstAmount),
      CgstAmt: Number(item.cgstAmount),
      SgstAmt: Number(item.sgstAmount),
      CesAmt: Number(item.cessAmount),
      TotItemVal: Number(item.totalAmount),
    })),
    ValDtls: {
      AssVal: Number(payload.totals.taxableValue),
      CgstVal: Number(payload.totals.cgstAmount),
      SgstVal: Number(payload.totals.sgstAmount),
      IgstVal: Number(payload.totals.igstAmount),
      CesVal: Number(payload.totals.cessAmount),
      Discount: sumDiscounts(payload),
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: Number(payload.totals.totalAmount),
      TotInvValFc: Number(payload.totals.totalAmount),
    },
  }
}

function requireString(value: string | null, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required for IRP5 e-invoice submission.`)
  }

  return value.trim()
}

function sumDiscounts(payload: CanonicalEInvoicePayload) {
  return payload.items.reduce((total, item) => total + Number(item.discount), 0)
}

function toIrpDate(value: string) {
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}/${month}/${year}` : value
}

function toParty(
  party: CanonicalEInvoicePayload["supplier"],
  placeOfSupplyStateCode?: string | null
) {
  return {
    Gstin: party.gstin,
    LglNm: party.legalName,
    TrdNm: party.tradeName,
    Addr1: party.addressLine1,
    Addr2: party.addressLine2,
    Loc: party.locality ?? party.city,
    Stcd: party.stateCode,
    State: party.state,
    Pin: party.pincode ? Number(party.pincode) : null,
    ...(placeOfSupplyStateCode ? { Pos: placeOfSupplyStateCode } : {}),
  }
}
