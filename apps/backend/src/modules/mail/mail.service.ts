import nodemailer, { type Transporter } from "nodemailer"

import { getEnv } from "../../config/env.js"

type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

export class MailService {
  private readonly transporter: Transporter | null
  private readonly from: string

  constructor() {
    const env = getEnv()
    this.from = env.MAIL_FROM
    this.transporter = env.SMTP_HOST
        ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          authMethod: env.SMTP_AUTH_METHOD,
          auth:
            env.SMTP_USER && env.SMTP_PASS
              ? {
                  user: env.SMTP_USER,
                  pass: env.SMTP_PASS,
                }
              : undefined,
        })
      : null
  }

  async sendMail(input: SendMailInput) {
    if (!this.transporter) {
      return {
        skipped: true,
        reason: "SMTP is not configured.",
      }
    }

    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })

    return {
      skipped: false,
      reason: null,
    }
  }
}

export function buildActionEmailHtml(input: {
  eyebrow: string
  title: string
  body: string
  actionLabel: string
  actionUrl: string
  footer?: string
}) {
  const safeEyebrow = escapeHtml(input.eyebrow)
  const safeTitle = escapeHtml(input.title)
  const safeBody = escapeHtml(input.body)
  const safeActionLabel = escapeHtml(input.actionLabel)
  const safeActionUrl = escapeHtml(input.actionUrl)
  const safeFooter = escapeHtml(
    input.footer ?? "If you did not request this email, you can ignore it."
  )

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #e4e4e7;border-radius:18px;background:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0 0 12px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#71717a;">${safeEyebrow}</p>
                <h1 style="margin:0;font-size:24px;line-height:1.25;color:#18181b;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 24px;">
                <p style="margin:0;font-size:15px;line-height:1.7;color:#3f3f46;">${safeBody}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <a href="${safeActionUrl}" style="display:inline-block;border-radius:10px;background:#18181b;color:#ffffff;text-decoration:none;padding:11px 16px;font-size:14px;font-weight:600;">${safeActionLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e4e4e7;padding:18px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">${safeFooter}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
