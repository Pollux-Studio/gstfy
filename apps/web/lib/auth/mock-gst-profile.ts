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

type GstStateMeta = {
  code: string
  name: string
  emblemSrc?: string
}

const GST_STATE_META: Record<string, GstStateMeta> = {
  "01": { code: "01", name: "Jammu & Kashmir", emblemSrc: "/state_flag/Jammu-and-Kashmir.png" },
  "02": { code: "02", name: "Himachal Pradesh", emblemSrc: "/state_flag/Himachal-Pradesh.png" },
  "03": { code: "03", name: "Punjab", emblemSrc: "/state_flag/Punjab.png" },
  "04": { code: "04", name: "Chandigarh", emblemSrc: "/state_flag/Chandigarh.png" },
  "05": { code: "05", name: "Uttarakhand", emblemSrc: "/state_flag/Uttarakhand.png" },
  "06": { code: "06", name: "Haryana", emblemSrc: "/state_flag/Haryana.png" },
  "07": { code: "07", name: "Delhi", emblemSrc: "/state_flag/Delhi.png" },
  "08": { code: "08", name: "Rajasthan", emblemSrc: "/state_flag/Rajasthan.png" },
  "09": { code: "09", name: "Uttar Pradesh", emblemSrc: "/state_flag/Uttar-Pradesh.png" },
  "10": { code: "10", name: "Bihar", emblemSrc: "/state_flag/Bihar.png" },
  "11": { code: "11", name: "Sikkim", emblemSrc: "/state_flag/Sikkim.png" },
  "12": { code: "12", name: "Arunachal Pradesh", emblemSrc: "/state_flag/Arunachal-Pradesh.png" },
  "13": { code: "13", name: "Nagaland", emblemSrc: "/state_flag/Nagaland.png" },
  "14": { code: "14", name: "Manipur", emblemSrc: "/state_flag/Manipur.png" },
  "15": { code: "15", name: "Mizoram", emblemSrc: "/state_flag/Mizoram.png" },
  "16": { code: "16", name: "Tripura", emblemSrc: "/state_flag/Tripura.png" },
  "17": { code: "17", name: "Meghalaya", emblemSrc: "/state_flag/Meghalaya.png" },
  "18": { code: "18", name: "Assam", emblemSrc: "/state_flag/Assam.png" },
  "19": { code: "19", name: "West Bengal", emblemSrc: "/state_flag/West-Bengal.png" },
  "20": { code: "20", name: "Jharkhand", emblemSrc: "/state_flag/Jharkhand.png" },
  "21": { code: "21", name: "Odisha", emblemSrc: "/state_flag/Odisha.png" },
  "22": { code: "22", name: "Chhattisgarh", emblemSrc: "/state_flag/Chhattisgarh.png" },
  "23": { code: "23", name: "Madhya Pradesh", emblemSrc: "/state_flag/Madhya-Pradesh.png" },
  "24": { code: "24", name: "Gujarat", emblemSrc: "/state_flag/Gujarat.png" },
  "25": { code: "25", name: "Dadra & Nagar Haveli and Daman & Diu", emblemSrc: "/state_flag/Dadra-and-Nagar-Haveli-and-Daman-and-Diu.png" },
  "26": { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu", emblemSrc: "/state_flag/Dadra-and-Nagar-Haveli-and-Daman-and-Diu.png" },
  "27": { code: "27", name: "Maharashtra", emblemSrc: "/state_flag/Maharashtra.png" },
  "28": { code: "28", name: "Andhra Pradesh", emblemSrc: "/state_flag/Andhra-Pradesh.png" },
  "29": { code: "29", name: "Karnataka", emblemSrc: "/state_flag/Karnataka.png" },
  "30": { code: "30", name: "Goa", emblemSrc: "/state_flag/Goa.png" },
  "31": { code: "31", name: "Lakshadweep", emblemSrc: "/state_flag/Lakshadweep.png" },
  "32": { code: "32", name: "Kerala", emblemSrc: "/state_flag/Kerala.png" },
  "33": { code: "33", name: "Tamil Nadu", emblemSrc: "/state_flag/Tamil-Nadu.png" },
  "34": { code: "34", name: "Puducherry", emblemSrc: "/state_flag/Puducherry.png" },
  "35": { code: "35", name: "Andaman & Nicobar Islands", emblemSrc: "/state_flag/Andaman-and-Nicobar.png" },
  "36": { code: "36", name: "Telangana", emblemSrc: "/state_flag/Telangana.png" },
  "37": { code: "37", name: "Andhra Pradesh", emblemSrc: "/state_flag/Andhra-Pradesh.png" },
  "38": { code: "38", name: "Ladakh", emblemSrc: "/state_flag/Ladakh.png" },
  "97": { code: "97", name: "Other Territory" },
  "99": { code: "99", name: "Centre Jurisdiction" },
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

export function getGstStateCode(gstin: string) {
  return gstin.slice(0, 2)
}

export function getGstStateMeta(gstin: string) {
  return GST_STATE_META[getGstStateCode(gstin)] ?? null
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
