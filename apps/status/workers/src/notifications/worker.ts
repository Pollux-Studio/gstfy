import { createHmac } from "node:crypto"
import { pathToFileURL } from "node:url"

import nodemailer from "nodemailer"

import { getEnv } from "../config/env.js"
import { createLogger } from "../logger.js"
import {
  type PendingNotificationDelivery,
  sleep,
  StatusApiClient,
} from "../status-api.js"

const env = getEnv()
const logger = createLogger(env)
const api = new StatusApiClient(env)

export async function startNotificationWorker() {
  logger.info(
    {
      workerId: env.STATUS_WORKER_ID,
      region: env.STATUS_WORKER_REGION,
    },
    "status notification worker starting"
  )

  await api.heartbeat({
    workerType: "notifications",
    status: "starting",
  })

  let stopped = false
  const stop = () => {
    stopped = true
  }

  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)

  while (!stopped) {
    try {
      const { items } = await api.listPendingNotifications(25)

      for (const delivery of items) {
        try {
          await sendDelivery(delivery)
          await api.markNotificationDelivered(delivery.id)
          logger.info(
            {
              deliveryId: delivery.id,
              event: delivery.event,
              type: delivery.subscriptionType,
            },
            "status notification delivered"
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : "Notification failed."
          await api.markNotificationFailed(delivery.id, message)
          logger.warn(
            {
              deliveryId: delivery.id,
              event: delivery.event,
              type: delivery.subscriptionType,
              error: message,
            },
            "status notification delivery failed"
          )
        }
      }

      await api.heartbeat({
        workerType: "notifications",
        status: "healthy",
        metadata: {
          pendingFetched: items.length,
          lastLoopAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error({ err: error }, "status notification worker loop failed")
      await api.heartbeat({
        workerType: "notifications",
        status: "degraded",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }).catch(() => undefined)
    }

    await sleep(env.STATUS_NOTIFICATION_POLL_SECONDS * 1_000)
  }

  await api.heartbeat({
    workerType: "notifications",
    status: "stopped",
  }).catch(() => undefined)
}

async function sendDelivery(delivery: PendingNotificationDelivery) {
  switch (delivery.subscriptionType) {
    case "email":
      return sendEmail(delivery)
    case "webhook":
      return postJsonWebhook(
        requireDestination(delivery.destination.webhookUrl, "Webhook URL is missing."),
        delivery
      )
    case "slack":
      return postJsonWebhook(
        requireDestination(delivery.destination.slackWebhookUrl, "Slack webhook URL is missing."),
        {
          ...delivery,
          payload: slackPayload(delivery),
        }
      )
    case "teams":
      return postJsonWebhook(
        requireDestination(delivery.destination.teamsWebhookUrl, "Teams webhook URL is missing."),
        {
          ...delivery,
          payload: teamsPayload(delivery),
        }
      )
    case null:
      throw new Error("Subscription type is missing.")
  }
}

async function sendEmail(delivery: PendingNotificationDelivery) {
  const email = requireDestination(delivery.destination.email, "Email address is missing.")

  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not configured.")
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD ?
        {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        }
      : undefined,
  })

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: `GSTfy Status: ${humanizeEvent(delivery.event)}`,
    text: renderPlainTextNotification(delivery),
  })
}

async function postJsonWebhook(url: string, delivery: PendingNotificationDelivery) {
  const payload = JSON.stringify(delivery.payload)
  const timestamp = Math.floor(Date.now() / 1_000).toString()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-GSTfy-Delivery-ID": delivery.deliveryId,
    "X-GSTfy-Event": delivery.event,
    "X-GSTfy-Timestamp": timestamp,
    ...delivery.headers,
  }

  if (delivery.destination.signingSecret) {
    headers["X-GSTfy-Signature"] = createHmac(
      "sha256",
      delivery.destination.signingSecret
    )
      .update(`${timestamp}.${payload}`)
      .digest("hex")
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: payload,
  })

  if (!response.ok) {
    throw new Error(`Webhook returned HTTP ${response.status}.`)
  }
}

function slackPayload(delivery: PendingNotificationDelivery) {
  return {
    text: `GSTfy Status: ${humanizeEvent(delivery.event)}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*GSTfy Status*\n${humanizeEvent(delivery.event)}`,
        },
      },
    ],
  }
}

function teamsPayload(delivery: PendingNotificationDelivery) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: "GSTfy Status",
              weight: "Bolder",
            },
            {
              type: "TextBlock",
              text: humanizeEvent(delivery.event),
            },
          ],
        },
      },
    ],
  }
}

function renderPlainTextNotification(delivery: PendingNotificationDelivery) {
  if (delivery.event === "subscription.verify") {
    const verificationUrl = getPayloadString(delivery.payload, "verificationUrl")
    const verificationToken = getPayloadString(delivery.payload, "verificationToken")

    return [
      "GSTfy Status",
      "",
      "Confirm your status notification subscription.",
      verificationUrl ? `Verification link: ${verificationUrl}` : null,
      verificationToken ? `Verification token: ${verificationToken}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  }

  return [
    "GSTfy Status",
    "",
    `Event: ${humanizeEvent(delivery.event)}`,
    `Delivery ID: ${delivery.deliveryId}`,
    "",
    "Open the GSTfy status page for details.",
  ].join("\n")
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === "string" ? value : null
}

function requireDestination(value: string | null, message: string) {
  if (!value) {
    throw new Error(message)
  }

  return value
}

function humanizeEvent(value: string) {
  return value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startNotificationWorker()
}
