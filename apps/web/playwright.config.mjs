import { defineConfig } from "@playwright/test"

const baseURL = process.env.GSTFY_E2E_BASE_URL ?? "http://localhost:3000"
const skipWebServer = process.env.GSTFY_E2E_SKIP_WEB_SERVER === "true"

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
