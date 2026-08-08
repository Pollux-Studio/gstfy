import { IsOptional, IsString, IsUrl, MinLength } from "class-validator"

import { CompleteOnboardingDto } from "../../onboarding/dto/complete-onboarding.dto.js"

export class RegisterDto extends CompleteOnboardingDto {
  @IsString()
  identifier!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsOptional()
  @IsUrl({
    require_protocol: true,
    require_tld: false,
  })
  emailRedirectTo?: string
}
