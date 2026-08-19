import { apiRequest } from "@/lib/api/client"

export type CessRule = {
  id: string
  businessId: string | null
  ruleCode: string
  description: string
  calculationMethod: string
  ratePercent: string | null
  amountPerUnit: string | null
  effectiveFrom: string
  effectiveTo: string | null
  status: string
  version: string
}

export function listTaxRules(accessToken: string) {
  return apiRequest<{ cessRules: CessRule[]; rules: unknown[] }>("/tax/rules", {
    method: "GET",
    accessToken,
  })
}
