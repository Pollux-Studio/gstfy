import { getGstStateMeta } from "@/lib/gst-state"

export const gstApiSample = {
  code: 200,
  data: {
    data: {
      adadr: [],
      ctb: "Proprietorship",
      ctj: "RANGE-DED8",
      ctjCd: "YT0804",
      cxdt: "",
      dty: "Regular",
      einvoiceStatus: "No",
      gstin: "33AFSPB9500E1ZY",
      lgnm: "Vicky Pvt Ltd",
      lstupdt: "18/10/2019",
      nba: ["Supplier of Services"],
      pradr: {
        addr: {
          bnm: "Olympia Tech Park",
          bno: "Plot 1A, SIDCO Estate",
          dst: "Chennai",
          flno: "Level 05",
          geocodelvl: "NA",
          landMark: "",
          lg: "",
          loc: "Guindy",
          locality: "",
          lt: "",
          pncd: "600032",
          st: "Anna Salai",
          stcd: "Tamil Nadu",
        },
        ntr: "Supplier of Services",
      },
      rgdt: "18/10/2019",
      stj: "LGSTO 087 - Chennai South",
      stjCd: "TN201",
      sts: "Active",
      tradeNam: "Vicky Pvt Ltd",
    },
    status_cd: "1",
  },
  timestamp: 1763446641000,
  transaction_id: "5248feb5-dd09-4f0d-9a42-14b34b849087",
} as const

export type GstProfile = {
  adadr: readonly unknown[]
  ctb: string
  ctj: string
  ctjCd: string
  cxdt: string
  dty: string
  einvoiceStatus: string
  gstin: string
  lgnm: string
  lstupdt: string
  nba: readonly string[]
  pradr: {
    addr: {
      bnm: string
      bno: string
      dst: string
      flno: string
      geocodelvl: string
      landMark: string
      lg: string
      loc: string
      locality: string
      lt: string
      pncd: string
      st: string
      stcd: string
    }
    ntr: string
  }
  rgdt: string
  stj: string
  stjCd: string
  sts: string
  tradeNam: string
}

export function buildMockProfile(gstin: string): GstProfile {
  const stateMeta = getGstStateMeta(gstin)

  return {
    ...gstApiSample.data.data,
    gstin,
    pradr: {
      ...gstApiSample.data.data.pradr,
      addr: {
        ...gstApiSample.data.data.pradr.addr,
        stcd: stateMeta?.name ?? gstApiSample.data.data.pradr.addr.stcd,
      },
    },
  }
}

export function formatGstAddress(profile: GstProfile) {
  const address = profile.pradr.addr

  return [
    address.flno,
    address.bno,
    address.bnm,
    address.st,
    address.loc,
    address.dst,
    address.stcd,
    address.pncd,
  ]
    .filter(Boolean)
    .join(", ")
}
