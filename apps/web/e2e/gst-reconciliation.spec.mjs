import { test, expect } from "@playwright/test"

const businessAuthState = process.env.GSTFY_E2E_AUTH_STATE ?? "playwright/.auth/business.json"

test.use({ storageState: businessAuthState })

test.describe("GST reconciliation workspace", () => {
  test("loads reconciliation, ITC, exceptions, and imports tabs", async ({ page }) => {
    await page.goto("/gst")

    await expect(page.getByRole("heading", { name: "GST reconciliation" })).toBeVisible()
    await expect(page.getByRole("button", { name: /import gstr-2b/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Reconciliation" })).toBeVisible()

    await page.getByRole("tab", { name: "ITC" }).click()
    await expect(page.getByRole("tab", { name: "ITC" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByPlaceholder(/search supplier/i)).toBeVisible()

    await page.getByRole("tab", { name: "Exceptions" }).click()
    await expect(page.getByRole("tab", { name: "Exceptions" })).toHaveAttribute("aria-selected", "true")

    await page.getByRole("tab", { name: "Imports" }).click()
    await expect(page.getByRole("tab", { name: "Imports" })).toHaveAttribute("aria-selected", "true")
  })

  test("opens normalized GSTR import dialog", async ({ page }) => {
    await page.goto("/gst")
    await page.getByRole("button", { name: /import gstr-2b/i }).click()

    await expect(page.getByRole("dialog", { name: "Import GSTR-2B records" })).toBeVisible()
    await expect(page.getByText(/rows ready to import/i)).toBeVisible()
    await expect(page.getByPlaceholder(/supplierGstin/i)).toBeVisible()
  })
})
