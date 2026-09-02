import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  calculateOverallStatus,
  deriveServiceStatusFromMonitorResult,
} from "./status.domain.js"

describe("status domain", () => {
  it("calculates operational when all public services are operational", () => {
    assert.equal(
      calculateOverallStatus([
        {
          isPublic: true,
          status: "operational",
        },
        {
          isPublic: true,
          status: "operational",
        },
      ]),
      "operational"
    )
  })

  it("uses the strongest public service status for the overall status", () => {
    assert.equal(
      calculateOverallStatus([
        {
          isPublic: true,
          status: "degraded_performance",
        },
        {
          isPublic: true,
          status: "major_outage",
        },
        {
          isPublic: false,
          status: "operational",
        },
      ]),
      "major_outage"
    )
  })

  it("marks a monitor recovered only after the recovery threshold is reached", () => {
    assert.equal(
      deriveServiceStatusFromMonitorResult("success", 0, 3, 2, 3),
      null
    )
    assert.equal(
      deriveServiceStatusFromMonitorResult("success", 0, 3, 3, 3),
      "operational"
    )
  })

  it("marks failures as an outage only after the failure threshold is reached", () => {
    assert.equal(
      deriveServiceStatusFromMonitorResult("failed", 2, 3, 0, 3),
      null
    )
    assert.equal(
      deriveServiceStatusFromMonitorResult("failed", 3, 3, 0, 3),
      "major_outage"
    )
  })
})
