import { lookup } from "node:dns/promises"
import net from "node:net"
import tls from "node:tls"

import type { MonitorResultPayload, StatusMonitor } from "../status-api.js"

export async function runMonitorCheck(
  monitor: StatusMonitor,
  region: string
): Promise<MonitorResultPayload> {
  const startedAt = Date.now()

  try {
    for (let attempt = 0; attempt <= monitor.retryCount; attempt += 1) {
      const result = await runSingleAttempt(monitor, startedAt, region)

      if (result.status === "success" || attempt === monitor.retryCount) {
        return result
      }
    }

    return buildResult(monitor, region, startedAt, "failed", "Monitor retry loop ended.")
  } catch (error) {
    return buildResult(
      monitor,
      region,
      startedAt,
      isAbortError(error) ? "timeout" : "failed",
      error instanceof Error ? error.message : "Monitor failed."
    )
  }
}

async function runSingleAttempt(
  monitor: StatusMonitor,
  startedAt: number,
  region: string
): Promise<MonitorResultPayload> {
  switch (monitor.checkType) {
    case "http":
    case "health":
      return runHttpCheck(monitor, startedAt, region)
    case "tcp":
      await runTcpCheck(monitor)
      return buildResult(monitor, region, startedAt, "success")
    case "dns":
      await lookup(extractHost(monitor.target))
      return buildResult(monitor, region, startedAt, "success")
    case "ssl":
      await runSslCheck(monitor)
      return buildResult(monitor, region, startedAt, "success")
  }
}

async function runHttpCheck(
  monitor: StatusMonitor,
  startedAt: number,
  region: string
): Promise<MonitorResultPayload> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), monitor.timeoutSeconds * 1_000)

  try {
    const response = await fetch(monitor.target, {
      method: "GET",
      signal: controller.signal,
      headers: monitor.expectedHeaders,
    })
    const body = monitor.expectedBody ? await response.text() : ""
    const expectedStatus = monitor.expectedStatus ?? 200

    if (response.status !== expectedStatus) {
      return buildResult(
        monitor,
        region,
        startedAt,
        "failed",
        `Expected HTTP ${expectedStatus}, received ${response.status}.`,
        response.status
      )
    }

    if (monitor.expectedBody && !body.includes(monitor.expectedBody)) {
      return buildResult(
        monitor,
        region,
        startedAt,
        "degraded",
        "Expected response text was not found.",
        response.status
      )
    }

    return buildResult(monitor, region, startedAt, "success", null, response.status)
  } finally {
    clearTimeout(timeout)
  }
}

function runTcpCheck(monitor: StatusMonitor) {
  const { host, port } = parseHostPort(monitor.target, 80)

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`TCP check timed out after ${monitor.timeoutSeconds}s.`))
    }, monitor.timeoutSeconds * 1_000)

    socket.once("connect", () => {
      clearTimeout(timeout)
      socket.end()
      resolve()
    })
    socket.once("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function runSslCheck(monitor: StatusMonitor) {
  const { host, port } = parseHostPort(monitor.target, 443)

  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host })
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`SSL check timed out after ${monitor.timeoutSeconds}s.`))
    }, monitor.timeoutSeconds * 1_000)

    socket.once("secureConnect", () => {
      clearTimeout(timeout)
      const certificate = socket.getPeerCertificate()
      const expiresAt = Date.parse(certificate.valid_to)
      socket.end()

      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        reject(new Error("SSL certificate is expired or unreadable."))
        return
      }

      resolve()
    })
    socket.once("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function buildResult(
  monitor: StatusMonitor,
  region: string,
  startedAt: number,
  status: MonitorResultPayload["status"],
  error: string | null = null,
  httpStatus: number | null = null
): MonitorResultPayload {
  return {
    monitorId: monitor.id,
    region,
    status,
    httpStatus,
    responseTimeMs: Date.now() - startedAt,
    error,
    checkedAt: new Date().toISOString(),
  }
}

function parseHostPort(target: string, defaultPort: number) {
  try {
    const url = new URL(target)
    return {
      host: url.hostname,
      port: Number(url.port || defaultPort),
    }
  } catch {
    const [host, port] = target.split(":")
    return {
      host: host ?? target,
      port: port ? Number(port) : defaultPort,
    }
  }
}

function extractHost(target: string) {
  try {
    return new URL(target).hostname
  } catch {
    return target.split(":")[0] ?? target
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}
