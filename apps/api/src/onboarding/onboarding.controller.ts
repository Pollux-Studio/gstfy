import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common"

import { CurrentUser } from "../auth/current-user.decorator.js"
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js"
import type { AuthenticatedUser } from "../common/authenticated-user.js"
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto.js"
import { OnboardingService } from "./onboarding.service.js"

@UseGuards(SupabaseAuthGuard)
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get("status")
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getStatus(user)
  }

  @Post("complete")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteOnboardingDto
  ) {
    return this.onboardingService.complete(user, dto)
  }
}
