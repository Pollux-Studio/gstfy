import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createRemoteJWKSet, jwtVerify } from "jose"

import type { AuthenticatedRequest } from "../common/authenticated-user.js"
import type { AppEnv } from "../config/env.js"

type SupabaseJwtPayload = {
  sub?: string
  email?: string
  phone?: string
  role?: string
  aal?: string
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwks

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    this.jwks = createRemoteJWKSet(
      new URL(this.configService.get("SUPABASE_JWKS_URL", { infer: true }))
    )
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorizationHeader = request.headers.authorization

    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token")
    }

    const token = authorizationHeader.slice("Bearer ".length).trim()

    try {
      const { payload } = await jwtVerify(token, this.jwks)
      const typedPayload = payload as SupabaseJwtPayload

      if (!typedPayload.sub) {
        throw new UnauthorizedException("Token subject is missing")
      }

      request.user = {
        userId: typedPayload.sub,
        email: typedPayload.email ?? null,
        phone: typedPayload.phone ?? null,
        role: typedPayload.role ?? null,
        aal: typedPayload.aal ?? null,
      }

      return true
    } catch {
      throw new UnauthorizedException("Invalid or expired token")
    }
  }
}
