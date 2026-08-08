import { createParamDecorator, type ExecutionContext } from "@nestjs/common"

import type { AuthenticatedRequest, AuthenticatedUser } from "../common/authenticated-user.js"

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!request.user) {
      throw new Error("Authenticated user was not attached to the request")
    }

    return request.user
  }
)
