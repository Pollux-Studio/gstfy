import { Type } from "class-transformer"
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator"

const gstinPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/
const panPattern = /^[A-Z]{5}\d{4}[A-Z]$/
const phonePattern = /^\d{10}$/
const pincodePattern = /^\d{6}$/
const stateCodePattern = /^\d{2}$/

class CompanyOnboardingDto {
  @IsString()
  legalName!: string

  @IsString()
  tradeName!: string

  @Matches(panPattern)
  pan!: string

  @IsString()
  constitution!: string

  @IsOptional()
  @IsEmail()
  businessEmail?: string

  @IsOptional()
  @Matches(phonePattern)
  businessMobile?: string

  @IsString()
  primaryContactName!: string

  @Matches(phonePattern)
  primaryContactMobile!: string

  @IsEmail()
  primaryContactEmail!: string
}

class RegistrationOnboardingDto {
  @Matches(gstinPattern)
  gstin!: string

  @IsString()
  taxpayerType!: string

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  registrationDate!: string

  @IsString()
  principalAddressLine1!: string

  @IsOptional()
  @IsString()
  principalAddressLine2?: string

  @IsString()
  locality!: string

  @IsString()
  district!: string

  @Matches(pincodePattern)
  pincode!: string

  @Matches(stateCodePattern)
  stateCode!: string

  @IsString()
  possessionType!: string

  @IsOptional()
  @IsIn(["manual", "browser_geolocation"])
  locationSource?: "manual" | "browser_geolocation"
}

export class CompleteOnboardingDto {
  @ValidateNested()
  @Type(() => CompanyOnboardingDto)
  company!: CompanyOnboardingDto

  @ValidateNested()
  @Type(() => RegistrationOnboardingDto)
  registration!: RegistrationOnboardingDto
}
