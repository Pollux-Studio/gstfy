import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { getEnv } from "../../config/env.js"
import { getTenantSlugFromRequest } from "../../utils/tenant-context.js"
import {
  businessRegisterSchema,
  caRegisterSchema,
  caReferralVerifySchema,
  forgotPasswordSchema,
  identifierLoginSchema,
  loginSchema,
  lookupIdentifierSchema,
  phoneTokenVerifySchema,
  resetPasswordSchema,
  verifyEmailSchema,
  workspaceRegisterSchema,
} from "./auth.schemas.js"
import { requireAuthenticatedUser } from "./auth.guard.js"
import { AuthService } from "./auth.service.js"

const authService = new AuthService()

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/business/register", async (request, reply) => {
    const body = businessRegisterSchema.parse(request.body)
    const session = await authService.registerBusiness(body, getRequestContext(request))
    setRefreshCookie(reply, session.refreshToken)
    return stripRefreshToken(session)
  })

  app.post("/auth/register", async (request) => {
    const body = workspaceRegisterSchema.parse(request.body)
    return authService.registerWorkspace(body)
  })

  app.post("/auth/lookup", async (request) => {
    const body = lookupIdentifierSchema.parse(request.body)
    return authService.lookupIdentifier(body, getRequestContext(request))
  })

  app.post("/auth/ca-referral/verify", async (request) => {
    const body = caReferralVerifySchema.parse(request.body)
    return authService.verifyCaReferral(body)
  })

  app.post("/auth/login", async (request, reply) => {
    const body = identifierLoginSchema.parse(request.body)
    const session = await authService.loginBusinessWithIdentifier(
      body,
      getRequestContext(request)
    )
    setRefreshCookie(reply, session.refreshToken)
    return stripRefreshToken(session)
  })

  app.post("/auth/business/login", async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const session = await authService.loginBusiness(body, getRequestContext(request))
    setRefreshCookie(reply, session.refreshToken)
    return stripRefreshToken(session)
  })

  app.post("/auth/ca/register", async (request, reply) => {
    const body = caRegisterSchema.parse(request.body)
    const session = await authService.registerCa(body, getRequestContext(request))
    setRefreshCookie(reply, session.refreshToken)
    return stripRefreshToken(session)
  })

  app.post("/auth/ca/login", async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const session = await authService.loginCa(body, getRequestContext(request))
    setRefreshCookie(reply, session.refreshToken)
    return stripRefreshToken(session)
  })

  app.post("/auth/phone/verify", async (request, reply) => {
    const body = phoneTokenVerifySchema.parse(request.body)
    const session = await authService.verifyPhoneToken(body, getRequestContext(request))
    setRefreshCookie(reply, session.refreshToken)
    return stripRefreshToken(session)
  })

  app.get("/auth/me", async (request) => {
    const user = await requireAuthenticatedUser(request)
    return authService.getCurrentUser(user)
  })

  app.get("/auth/session", async (request) => {
    const refreshToken = request.cookies[authService.getRefreshCookieName()]
    request.log.info(
      {
        hasRefreshCookie: Boolean(refreshToken),
        cookieNames: Object.keys(request.cookies),
      },
      "auth session cookie lookup"
    )
    return authService.getSession(refreshToken)
  })

  app.post("/auth/logout", async (request, reply) => {
    const refreshToken = request.cookies[authService.getRefreshCookieName()]
    await authService.logout(refreshToken)
    clearRefreshCookie(reply)
    return {
      success: true,
    }
  })

  app.post("/auth/password/forgot", async (request) => {
    const body = forgotPasswordSchema.parse(request.body)
    await authService.forgotPassword(body)
    return {
      success: true,
    }
  })

  app.post("/auth/password/reset", async (request) => {
    const body = resetPasswordSchema.parse(request.body)
    await authService.resetPassword(body)
    return {
      success: true,
    }
  })

  app.post("/auth/email/verify", async (request) => {
    const body = verifyEmailSchema.parse(request.body)
    await authService.verifyEmail(body)
    return {
      success: true,
    }
  })

}

function setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  const env = getEnv()
  reply.setCookie(authService.getRefreshCookieName(), refreshToken, {
    path: "/",
    domain: env.COOKIE_DOMAIN || undefined,
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  })
}

function clearRefreshCookie(reply: FastifyReply) {
  const env = getEnv()
  reply.clearCookie(authService.getRefreshCookieName(), {
    path: "/",
    domain: env.COOKIE_DOMAIN || undefined,
  })
}

function stripRefreshToken<T extends { refreshToken: string }>(payload: T) {
  const { refreshToken, ...safePayload } = payload
  void refreshToken
  return safePayload
}

function getRequestContext(request: FastifyRequest) {
  return {
    userAgent: request.headers["user-agent"],
    ipAddress: request.ip,
    tenantSlug: getTenantSlugFromRequest(request),
  }
}
