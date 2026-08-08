import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common"
import type { TransactionSql } from "postgres"

import type { AuthenticatedUser } from "../common/authenticated-user.js"
import { DatabaseService } from "../database/database.service.js"
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto.js"

@Injectable()
export class OnboardingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(user: AuthenticatedUser) {
    let profile:
      | {
          onboarding_status: string
        }
      | undefined

    try {
      await this.ensureProfileExists(this.databaseService.sql, user)

      ;[profile] = await this.databaseService.sql<{
        onboarding_status: string
      }[]>`
        select onboarding_status
        from public.profiles
        where id = ${user.userId}::uuid
        limit 1
      `
    } catch (error) {
      if (this.isMissingSchemaError(error)) {
        throw this.createMissingSchemaException()
      }

      throw error
    }

    if (!profile) {
      throw new NotFoundException("Profile not found")
    }

    return {
      onboardingStatus: profile.onboarding_status,
    }
  }

  async complete(user: AuthenticatedUser, dto: CompleteOnboardingDto) {
    try {
      return await this.databaseService.sql.begin(async (sql) => {
        await this.ensureProfileExists(sql, user)

        const [profile] = await sql<{ id: string }[]>`
          select id
          from public.profiles
          where id = ${user.userId}::uuid
          limit 1
        `

        if (!profile) {
          throw new NotFoundException("Profile not found")
        }

        const existingMembership = await sql<{
          business_id: string
        }[]>`
          select business_id
          from public.user_business_roles
          where user_id = ${user.userId}::uuid
            and status = 'active'
          order by created_at asc
          limit 1
        `

        const businessId =
          existingMembership[0]?.business_id ??
          (await this.insertBusiness(sql, user.userId, dto))

        if (existingMembership[0]) {
          await sql`
            update public.businesses
            set
              legal_name = ${dto.company.legalName},
              trade_name = ${dto.company.tradeName},
              pan = ${dto.company.pan},
              constitution = ${dto.company.constitution},
              business_email = ${dto.company.businessEmail ?? null},
              business_phone = ${dto.company.businessMobile ?? null},
              primary_contact_name = ${dto.company.primaryContactName},
              primary_contact_mobile = ${dto.company.primaryContactMobile},
              primary_contact_email = ${dto.company.primaryContactEmail},
              updated_at = now()
            where id = ${businessId}::uuid
          `
        } else {
          await sql`
            insert into public.user_business_roles (
              user_id,
              business_id,
              role,
              status
            )
            values (
              ${user.userId}::uuid,
              ${businessId}::uuid,
              'owner',
              'active'
            )
          `
        }

        const existingRegistration = await sql<{ id: string }[]>`
          select id
          from public.business_gst_registrations
          where business_id = ${businessId}::uuid
            and is_primary = true
          limit 1
        `

        if (existingRegistration[0]) {
          await sql`
            update public.business_gst_registrations
            set
              gstin = ${dto.registration.gstin},
              taxpayer_type = ${dto.registration.taxpayerType},
              registration_date = ${dto.registration.registrationDate},
              principal_address_line_1 = ${dto.registration.principalAddressLine1},
              principal_address_line_2 = ${dto.registration.principalAddressLine2 ?? null},
              locality = ${dto.registration.locality},
              district = ${dto.registration.district},
              pincode = ${dto.registration.pincode},
              state_code = ${dto.registration.stateCode},
              possession_type = ${dto.registration.possessionType},
              location_source = ${dto.registration.locationSource ?? "manual"},
              updated_at = now()
            where id = ${existingRegistration[0].id}::uuid
          `
        } else {
          await sql`
            insert into public.business_gst_registrations (
              business_id,
              gstin,
              taxpayer_type,
              registration_date,
              principal_address_line_1,
              principal_address_line_2,
              locality,
              district,
              pincode,
              state_code,
              possession_type,
              location_source,
              is_primary
            )
            values (
              ${businessId}::uuid,
              ${dto.registration.gstin},
              ${dto.registration.taxpayerType},
              ${dto.registration.registrationDate},
              ${dto.registration.principalAddressLine1},
              ${dto.registration.principalAddressLine2 ?? null},
              ${dto.registration.locality},
              ${dto.registration.district},
              ${dto.registration.pincode},
              ${dto.registration.stateCode},
              ${dto.registration.possessionType},
              ${dto.registration.locationSource ?? "manual"},
              true
            )
          `
        }

        await sql`
          update public.profiles
          set
            auth_identifier_type = ${user.email ? "email" : "phone"},
            email = ${user.email},
            phone_e164 = ${user.phone},
            onboarding_status = 'completed',
            updated_at = now()
          where id = ${user.userId}::uuid
        `

        await sql`
          insert into public.audit_logs (
            business_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            payload
          )
          values (
            ${businessId}::uuid,
            ${user.userId}::uuid,
            'onboarding.completed',
            'business',
            ${businessId}::uuid,
            ${JSON.stringify({
              company: dto.company,
              registration: {
                gstin: dto.registration.gstin,
                stateCode: dto.registration.stateCode,
              },
            })}::jsonb
          )
        `

        return {
          businessId,
          onboardingStatus: "completed",
        }
      })
    } catch (error) {
      if (this.isMissingSchemaError(error)) {
        throw this.createMissingSchemaException()
      }

      throw error
    }
  }

  private async insertBusiness(
    sql: TransactionSql,
    userId: string,
    dto: CompleteOnboardingDto
  ) {
    const insertedBusinesses = await sql<{ id: string }[]>`
      insert into public.businesses (
        legal_name,
        trade_name,
        pan,
        constitution,
        business_email,
        business_phone,
        primary_contact_name,
        primary_contact_mobile,
        primary_contact_email,
        created_by
      )
      values (
        ${dto.company.legalName},
        ${dto.company.tradeName},
        ${dto.company.pan},
        ${dto.company.constitution},
        ${dto.company.businessEmail ?? null},
        ${dto.company.businessMobile ?? null},
        ${dto.company.primaryContactName},
        ${dto.company.primaryContactMobile},
        ${dto.company.primaryContactEmail},
        ${userId}::uuid
      )
      returning id
    `

    const businessId = insertedBusinesses[0]?.id

    if (!businessId) {
      throw new InternalServerErrorException("Business could not be created")
    }

    return businessId
  }

  private createMissingSchemaException() {
    return new ServiceUnavailableException(
      "Supabase onboarding schema is not applied yet. Run the SQL in supabase/migrations/20260808193000_auth_onboarding.sql, then retry onboarding."
    )
  }

  private isMissingSchemaError(error: unknown) {
    return (
      !!error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "42P01"
    )
  }

  private async ensureProfileExists(
    sql: TransactionSql | typeof this.databaseService.sql,
    user: AuthenticatedUser
  ) {
    const authIdentifierType = user.email ? "email" : user.phone ? "phone" : null

    await sql`
      insert into public.profiles (
        id,
        auth_identifier_type,
        email,
        phone_e164
      )
      values (
        ${user.userId}::uuid,
        ${authIdentifierType},
        ${user.email},
        ${user.phone}
      )
      on conflict (id) do update
      set
        auth_identifier_type = excluded.auth_identifier_type,
        email = excluded.email,
        phone_e164 = excluded.phone_e164,
        updated_at = now()
    `
  }
}
