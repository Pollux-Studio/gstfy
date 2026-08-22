import { test, expect } from "@playwright/test"

const businessAuthState = process.env.GSTFY_E2E_AUTH_STATE ?? "playwright/.auth/business.json"

test.use({ storageState: businessAuthState })

test.describe("GST reporting workspace", () => {
  test("covers reporting run review, CA approval, GSTR tabs, and export", async ({ page }) => {
    const gstRegistrationId = "11111111-1111-4111-8111-111111111111"
    const period = "2026-08"
    let run = makeRun({ gstRegistrationId, period, status: "REVIEW" })

    await mockBaseGstWorkspace(page, gstRegistrationId)
    await page.route("**/api/v1/gst-reporting/**", async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const pathname = url.pathname

      if (pathname.endsWith("/gst-reporting/runs") && request.method() === "GET") {
        await route.fulfill({ json: { runs: [run], pagination: pageOne(1) } })
        return
      }

      if (pathname.endsWith("/gst-reporting/runs") && request.method() === "POST") {
        run = makeRun({ gstRegistrationId, period, status: "REVIEW" })
        await route.fulfill({ json: { run } })
        return
      }

      if (pathname.endsWith(`/gst-reporting/runs/${run.id}/refresh`)) {
        run = { ...run, status: "REVIEW", sourceDataHash: "hash-after-refresh" }
        await route.fulfill({ json: { run } })
        return
      }

      if (pathname.endsWith(`/gst-reporting/runs/${run.id}/mark-ready`)) {
        run = { ...run, status: "READY_FOR_CA_REVIEW" }
        await route.fulfill({ json: { run } })
        return
      }

      if (pathname.endsWith(`/gst-reporting/runs/${run.id}/approve`)) {
        run = {
          ...run,
          status: "CA_APPROVED",
          approvedAt: "2026-08-22T10:00:00.000Z",
          approvalComment: "Approved from GST filing review",
        }
        await route.fulfill({ json: { run } })
        return
      }

      if (pathname.endsWith(`/gst-reporting/runs/${run.id}/lock`)) {
        run = {
          ...run,
          status: "READY_FOR_SUBMISSION",
          lockedAt: "2026-08-22T10:05:00.000Z",
        }
        await route.fulfill({ json: { run } })
        return
      }

      if (pathname.endsWith("/gst-reporting/review")) {
        await route.fulfill({ json: makeReview(run) })
        return
      }

      if (pathname.endsWith("/gst-reporting/gstr1")) {
        await route.fulfill({ json: makeGstr1(run) })
        return
      }

      if (pathname.endsWith("/gst-reporting/gstr3b")) {
        await route.fulfill({ json: makeGstr3b(run) })
        return
      }

      if (pathname.endsWith("/gst-reporting/gstr1/export")) {
        await route.fulfill({
          json: {
            fileName: "gstr1-33ABCDE1234F1Z5-2026-08-v1.csv",
            contentType: "text/csv",
            content: "Section,Tax\nB2B,180.00",
            encoding: "utf8",
          },
        })
        return
      }

      await route.fulfill({ status: 404, json: { message: "Unhandled mock route" } })
    })

    await page.goto("/gst")
    await page.getByRole("tab", { name: "Filing Review" }).click()

    await expect(page.getByText("Review")).toBeVisible()
    await expect(page.getByText("Output GST")).toBeVisible()
    await page.getByRole("button", { name: /generate/i }).click()
    await page.getByRole("button", { name: /refresh/i }).click()
    await page.getByRole("button", { name: /ready for ca review/i }).click()

    await expect(page.getByText("Ready For Ca Review")).toBeVisible()
    await page.getByRole("button", { name: /ca approve/i }).click()
    await expect(page.getByText("Ca Approved")).toBeVisible()

    await page.getByRole("button", { name: /ready to submit/i }).click()
    await expect(page.getByText("Ready For Submission")).toBeVisible()

    await page.getByRole("tab", { name: "GSTR-1" }).click()
    await expect(page.getByText("GSTR-1 dataset")).toBeVisible()
    await expect(page.getByText("HSN/SAC summary")).toBeVisible()
    await page.getByRole("button", { name: "CSV" }).click()

    await page.getByRole("tab", { name: "GSTR-3B" }).click()
    await expect(page.getByText("GSTR-3B dataset")).toBeVisible()
    await expect(page.getByText("Claimed ITC")).toBeVisible()
  })
})

async function mockBaseGstWorkspace(page, gstRegistrationId) {
  await page.route("**/api/v1/gst-registrations", async (route) => {
    await route.fulfill({
      json: {
        gstRegistrations: [
          {
            id: gstRegistrationId,
            gstin: "33ABCDE1234F1Z5",
            legalName: "GSTFY Test Dealer",
            tradeName: "GSTFY Test Dealer",
            stateCode: "33",
            status: "active",
          },
        ],
      },
    })
  })

  await page.route("**/api/v1/gst-reconciliation**", async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith("/gst-reconciliation/imports")) {
      await route.fulfill({ json: { imports: [], pagination: pageOne(0) } })
      return
    }

    if (url.pathname.endsWith("/gst-reconciliation/exceptions")) {
      await route.fulfill({ json: { exceptions: [], pagination: pageOne(0) } })
      return
    }

    await route.fulfill({
      json: {
        items: [],
        summary: {
          booksItc: "0.00",
          externalItc: "0.00",
          matched: 0,
          mismatch: 0,
          claimed: 0,
        },
        pagination: pageOne(0),
      },
    })
  })

  await page.route("**/api/v1/itc**", async (route) => {
    await route.fulfill({
      json: {
        items: [],
        summary: {
          booksItc: "0.00",
          externalItc: "0.00",
          matched: 0,
          mismatch: 0,
          claimed: 0,
        },
        pagination: pageOne(0),
      },
    })
  })
}

function makeRun({ gstRegistrationId, period, status }) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    businessId: "33333333-3333-4333-8333-333333333333",
    gstRegistrationId,
    gstinSnapshot: "33ABCDE1234F1Z5",
    period,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    version: 1,
    status,
    generatedAt: "2026-08-22T09:00:00.000Z",
    sourceVersion: "GSTFY_REPORTING_V1",
    sourceDataHash: "source-hash",
    approvedAt: null,
    approvalComment: null,
    lockedAt: null,
    summary: {},
  }
}

function makeReview(run) {
  return {
    run,
    status: {
      canMarkReady: true,
      blockingCount: 0,
      exceptionCount: 0,
    },
    summary: {
      outputGst: "180.00",
      inputGst: "90.00",
      netGst: "90.00",
      rcm: "0.00",
      eligibleItc: "90.00",
      unresolvedExceptions: "0",
    },
    sections: {
      sales: [
        {
          classification: "B2B",
          count: 1,
          taxableValue: "1000.00",
          cgst: "90.00",
          sgst: "90.00",
          igst: "0.00",
          cess: "0.00",
          totalTax: "180.00",
        },
      ],
      hsn: [],
      documents: [],
      exceptions: [],
    },
  }
}

function makeGstr1(run) {
  return {
    run,
    sections: makeReview(run).sections.sales,
    hsn: [
      {
        hsnSac: "1001",
        description: "Test goods",
        uqc: "PCS",
        quantity: "1.000",
        taxableValue: "1000.00",
        cgst: "90.00",
        sgst: "90.00",
        igst: "0.00",
        cess: "0.00",
        totalTax: "180.00",
      },
    ],
    documents: [
      {
        sourceDocumentType: "sales_invoice",
        firstNumber: "INV-001",
        lastNumber: "INV-001",
        issuedCount: 1,
        taxableValue: "1000.00",
        totalTax: "180.00",
      },
    ],
    rows: [],
    totals: {
      taxableValue: "1000.00",
      cgst: "90.00",
      sgst: "90.00",
      igst: "0.00",
      cess: "0.00",
      totalTax: "180.00",
    },
  }
}

function makeGstr3b(run) {
  return {
    run,
    outward: makeReview(run).sections.sales,
    itc: {
      availableCgst: "45.00",
      availableSgst: "45.00",
      availableIgst: "0.00",
      availableCess: "0.00",
      claimedCgst: "45.00",
      claimedSgst: "45.00",
      claimedIgst: "0.00",
      claimedCess: "0.00",
      deferredCgst: "0.00",
      deferredSgst: "0.00",
      deferredIgst: "0.00",
      deferredCess: "0.00",
      ineligibleCgst: "0.00",
      ineligibleSgst: "0.00",
      ineligibleIgst: "0.00",
      ineligibleCess: "0.00",
      rcmTax: "0.00",
    },
    totals: {
      outputTax: "180.00",
      claimedItc: "90.00",
      netGst: "90.00",
    },
  }
}

function pageOne(total) {
  return {
    page: 1,
    limit: 15,
    total,
    hasMore: false,
  }
}

