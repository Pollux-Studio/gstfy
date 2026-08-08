import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"

import type { AuthenticatedUser } from "../common/authenticated-user.js"
import { DatabaseService } from "../database/database.service.js"
import { OnboardingService } from "../onboarding/onboarding.service.js"
import { SupabaseService } from "../supabase/supabase.service.js"
import { normalizeIdentifier } from "./identity.util.js"
import type { LoginDto } from "./dto/login.dto.js"
import type { LookupIdentifierDto } from "./dto/lookup-identifier.dto.js"
import type { RegisterDto } from "./dto/register.dto.js"

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly onboardingService: OnboardingService,
    private readonly supabaseService: SupabaseService
  ) {}

  async register(dto: RegisterDto) {
    const identifier = normalizeIdentifier(dto.identifier)
    const metadata = {
      auth_identifier_type: identifier.type,
      registration_source: "web",
    }

    const { data, error } =
      identifier.type === "email"
        ? await this.supabaseService.publicClient.auth.signUp({
            email: identifier.value,
            password: dto.password,
            options: {
              emailRedirectTo: dto.emailRedirectTo,
              data: metadata,
            },
          })
        : await this.supabaseService.publicClient.auth.signUp({
            phone: identifier.value,
            password: dto.password,
            options: {
              data: metadata,
              channel: "sms",
            },
          })

    if (error) {
      throw this.mapAuthError(error)
    }

    if (!data.user) {
      throw new InternalServerErrorException("Supabase did not return a user")
    }

    await this.ensureProfileExists({
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
    })

    const onboardingResult = await this.onboardingService.complete(
      {
        userId: data.user.id,
        email: data.user.email ?? null,
        phone: data.user.phone ?? null,
        role: null,
        aal: null,
      },
      dto
    )

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        phone: data.user.phone ?? null,
      },
      session: data.session
        ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? null,
          }
        : null,
      requiresVerification: data.session === null,
      onboardingStatus: onboardingResult.onboardingStatus,
    }
  }

  async lookupIdentifier(dto: LookupIdentifierDto) {
    const identifier = normalizeIdentifier(dto.identifier)
    let account = await this.findAccountByIdentifier(identifier)

    if (!account) {
      const authUser = await this.findAuthUserByIdentifier(identifier)

      if (!authUser) {
        throw new NotFoundException("Account not found")
      }

      await this.ensureProfileExists({
        id: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone ?? null,
      })

      account = await this.findAccountByIdentifier(identifier)
    }

    if (!account) {
      throw new NotFoundException("Account not found")
    }

    return {
      account: {
        id: account.id,
        displayName:
          account.business_name ?? account.display_name ?? "GSTFY Workspace",
        gstin: account.gstin,
        email: account.email,
        phone: account.phone_e164,
      },
    }
  }

  async login(dto: LoginDto) {
    const identifier = normalizeIdentifier(dto.identifier)
    const credentials =
      identifier.type === "email"
        ? {
            email: identifier.value,
            password: dto.password,
          }
        : {
            phone: identifier.value,
            password: dto.password,
          }

    const { data, error } =
      await this.supabaseService.publicClient.auth.signInWithPassword(credentials)

    if (error) {
      throw this.mapAuthError(error)
    }

    if (!data.user || !data.session) {
      throw new InternalServerErrorException("Supabase did not return a session")
    }

    await this.ensureProfileExists({
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
    })

    await this.databaseService.sql`
      update public.profiles
      set last_login_at = now()
      where id = ${data.user.id}::uuid
    `

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        phone: data.user.phone ?? null,
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
      },
    }
  }

  async getCurrentUser(user: AuthenticatedUser) {
    await this.ensureProfileExists({
      id: user.userId,
      email: user.email,
      phone: user.phone,
    })

    const profiles = await this.databaseService.sql<{
      id: string
      email: string | null
      phone_e164: string | null
      display_name: string | null
      locale: string
      onboarding_status: string
      last_login_at: string | null
    }[]>`
      select
        id,
        email,
        phone_e164,
        display_name,
        locale,
        onboarding_status,
        last_login_at
      from public.profiles
      where id = ${user.userId}::uuid
      limit 1
    `
    const profile:
      | {
          id: string
          email: string | null
          phone_e164: string | null
          display_name: string | null
          locale: string
          onboarding_status: string
          last_login_at: string | null
        }
      | null = profiles[0] ?? null

    const memberships = await this.databaseService.sql<{
      business_id: string
      business_name: string
      role: string
      status: string
      gstin: string | null
    }[]>`
      select
        ubr.business_id,
        b.legal_name as business_name,
        ubr.role,
        ubr.status,
        bgr.gstin
      from public.user_business_roles ubr
      join public.businesses b on b.id = ubr.business_id
      left join public.business_gst_registrations bgr
        on bgr.business_id = b.id
       and bgr.is_primary = true
      where ubr.user_id = ${user.userId}::uuid
      order by ubr.created_at asc
    `

    return {
      auth: user,
      profile: profile ?? null,
      memberships,
    }
  }

  private async findAuthUserByIdentifier(
    identifier: ReturnType<typeof normalizeIdentifier>
  ) {
    let page = 1

    while (page <= 10) {
      const { data, error } = await this.supabaseService.adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      })

      if (error) {
        throw new BadRequestException(error.message)
      }

      const matchedUser =
        data.users.find((user) =>
          identifier.type === "email"
            ? (user.email ?? "").toLowerCase() === identifier.value
            : (user.phone ?? "") === identifier.value
        ) ?? null

      if (matchedUser) {
        return matchedUser
      }

      if (data.users.length < 200) {
        break
      }

      page += 1
    }

    return null
  }

  private findAccountByIdentifier(identifier: ReturnType<typeof normalizeIdentifier>) {
    return this.databaseService.sql<{
      id: string
      display_name: string | null
      business_name: string | null
      gstin: string | null
      email: string | null
      phone_e164: string | null
    }[]>`
      select
        p.id,
        p.display_name,
        b.legal_name as business_name,
        bgr.gstin,
        p.email,
        p.phone_e164
      from public.profiles p
      left join public.user_business_roles ubr
        on ubr.user_id = p.id
       and ubr.status = 'active'
      left join public.businesses b
        on b.id = ubr.business_id
      left join public.business_gst_registrations bgr
        on bgr.business_id = b.id
       and bgr.is_primary = true
      where
        ${
          identifier.type === "email"
            ? this.databaseService.sql`p.email = ${identifier.value}`
            : this.databaseService.sql`p.phone_e164 = ${identifier.value}`
        }
      order by ubr.created_at asc nulls last
      limit 1
    `.then((accounts) => accounts[0])
  }

  private async ensureProfileExists(user: {
    id: string
    email: string | null
    phone: string | null
  }) {
    const authIdentifierType = user.email ? "email" : user.phone ? "phone" : null

    await this.databaseService.sql`
      insert into public.profiles (
        id,
        auth_identifier_type,
        email,
        phone_e164
      )
      values (
        ${user.id}::uuid,
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

  private mapAuthError(error: { message: string; status?: number }) {
    if (error.status === 400 || error.status === 422) {
      return new BadRequestException(error.message)
    }

    return new BadRequestException(error.message)
  }
}
