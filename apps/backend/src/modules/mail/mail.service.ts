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
