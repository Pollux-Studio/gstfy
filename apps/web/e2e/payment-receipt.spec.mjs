import { test, expect } from "@playwright/test"

const businessAuthState = process.env.GSTFY_E2E_AUTH_STATE ?? "playwright/.auth/business.json"

test.use({ storageState: businessAuthState })

test.describe("Payment and receipt workspace", () => {
  test("loads receipt, payment, reports, and reconciliation surfaces", async ({ page }) => {
    await page.goto("/receipts")
    await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible()
    await expect(page.getByRole("button", { name: /new receipt/i })).toBeVisible()

    await page.goto("/payments")
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible()
    await expect(page.getByRole("button", { name: /new payment/i })).toBeVisible()

    await page.goto("/payment-reports")
    await expect(page.getByRole("heading", { name: "Payment reports" })).toBeVisible()
    await expect(page.getByRole("button", { name: /export cash-flow/i })).toBeVisible()

    await page.goto("/bank-reconciliation")
    await expect(page.getByRole("heading", { name: "Bank reconciliation" })).toBeVisible()
    await expect(page.getByRole("button", { name: /import statement/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /auto-match/i })).toBeVisible()
  })

  test("opens the bank statement import dialog", async ({ page }) => {
    await page.goto("/bank-reconciliation")
    await page.getByRole("button", { name: /import statement/i }).click()

    await expect(page.getByRole("dialog", { name: "Import bank statement" })).toBeVisible()
    await expect(page.getByText(/CSV with date, description/i)).toBeVisible()
  })
})
