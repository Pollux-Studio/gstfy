import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common"

import { CurrentUser } from "./current-user.decorator.js"
import type { AuthenticatedUser } from "../common/authenticated-user.js"
import { AuthService } from "./auth.service.js"
import { LoginDto } from "./dto/login.dto.js"
import { LookupIdentifierDto } from "./dto/lookup-identifier.dto.js"
import { RegisterDto } from "./dto/register.dto.js"
import { SupabaseAuthGuard } from "./supabase-auth.guard.js"

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post("lookup")
  lookup(@Body() dto: LookupIdentifierDto) {
    return this.authService.lookupIdentifier(dto)
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @UseGuards(SupabaseAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user)
  }
}
