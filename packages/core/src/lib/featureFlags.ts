export const PLANS = {
  micro: "micro",
  small: "small",
  pro: "pro",
  ca: "ca",
} as const

export const MODULE_ACCESS = {
  overview: ["micro", "small", "pro", "ca"],
  invoices: ["micro", "small", "pro", "ca"],
  expenses: ["micro", "small", "pro", "ca"],
  gstr: ["micro", "small", "pro", "ca"],
  aireview: ["micro", "small", "pro", "ca"],
  parties: ["micro", "small", "pro", "ca"],
  integrations: ["micro", "small", "pro", "ca"],
  einvoice: ["small", "pro", "ca"],
  ewaybill: ["small", "pro", "ca"],
  purchases: ["small", "pro", "ca"],
  inventory: ["small", "pro", "ca"],
  reports: ["small", "pro", "ca"],
  accounting: ["small", "pro", "ca"],
  pos: ["pro", "ca"],
  multigstin: ["pro", "ca"],
} as const

export type PlanKey = (typeof PLANS)[keyof typeof PLANS]
export type ModuleKey = keyof typeof MODULE_ACCESS

export function canAccess(module: ModuleKey, userPlan: string): boolean {
  const allowed: readonly string[] = MODULE_ACCESS[module]
  return allowed.indexOf(userPlan) !== -1
}
