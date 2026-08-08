import { Module } from "@nestjs/common"

import { OnboardingModule } from "../onboarding/onboarding.module.js"
import { AuthController } from "./auth.controller.js"
import { AuthService } from "./auth.service.js"
import { SupabaseAuthGuard } from "./supabase-auth.guard.js"

@Module({
  imports: [OnboardingModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
