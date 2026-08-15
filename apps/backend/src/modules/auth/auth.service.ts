import argon2 from "argon2"
import { and, eq, gt, isNull } from "drizzle-orm"
import { SignJWT } from "jose"

import { getEnv } from "../../config/env.js"
import { db } from "../../db/client.js"
import {
  businessBranches,
  businessLocations,
  businessMembers,
  businessProfiles,
  businesses,
  caBusinessLinks,
  caClientInvites,
  caPracticeMembers,
  caPractices,
  emailVerificationTokens,
  financialYears,
  gstRegistrations,
  invoiceSeries,
  passwordResetTokens,
  sessions,
  users,
  type BusinessRecord,
  type UserRecord,
} from "../../db/schema/index.js"
import { createUrlToken, sha256 } from "../../utils/crypto.js"
import { createProfileImage } from "../../utils/avatar.js"
import { HttpError } from "../../utils/http-error.js"
import { createTenantSlug } from "../../utils/tenant-slug.js"
import { getCaAppUrl, getTenantUrl } from "../../utils/tenant-url.js"
import { verifyFirebaseIdToken } from "../firebase/firebase-admin.js"
import { buildActionEmailHtml, MailService } from "../mail/mail.service.js"
import type {
  BusinessRegisterInput,
  CaRegisterInput,
  CaReferralVerifyInput,
  ForgotPasswordInput,
  IdentifierLoginInput,
  LoginInput,
  LookupIdentifierInput,
  PhoneTokenVerifyInput,
  ResetPasswordInput,
  VerifyEmailInput,
  WorkspaceRegisterInput,
} from "./auth.schemas.js"

type RequestContext = {
  userAgent?: string
  ipAddress?: string
  tenantSlug?: string | null
}

type AuthSessionPayload = {
  user: PublicUser
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  redirectTo: string
  tenant: PublicTenant | null
}

type PublicUser = {
  id: string
  email: string | null
  phoneE164: string | null
  fullName: string | null
  profileImageSeed: string | null
  profileImageStyle: string
  emailVerified: boolean
  phoneVerified: boolean
}

type PublicTenant = {
  id: string
  slug: string
  legalName: string
  tradeName: string
  url: string
}

const refreshCookieName = "gstfy_refresh"
const accessTokenEncoder = new TextEncoder()

export class AuthService {
  private readonly env = getEnv()
  private readonly mailService = new MailService()

  getRefreshCookieName() {
    return refreshCookieName
  }

  async lookupIdentifier(input: LookupIdentifierInput, context: RequestContext = {}) {
    const identifier = input.identifier.trim()
    const user = isPhoneIdentifier(identifier)
      ? await db.query.users.findFirst({
          where: eq(users.phoneE164, toIndianE164(identifier)),
        })
      : await db.query.users.findFirst({
          where: eq(users.email, normalizeEmail(identifier)),
        })

    if (!user || user.status !== "active") {
      throw new HttpError(404, "Account not found.")
    }

    const business = await this.findPrimaryBusinessAccount(user.id, context.tenantSlug)

    if (!business) {
      throw new HttpError(404, "Business account not found.")
    }

    return {
      account: {
        id: user.id,
        displayName: business.tradeName || user.fullName || user.email || user.phoneE164,
        gstin: business.gstin,
        tenantSlug: business.tenantSlug,
        tenantUrl: this.getBusinessUrl(business),
        email: user.email,
        phone: user.phoneE164,
      },
    }
  }

  async getCurrentUser(user: UserRecord) {
    const memberships = await db
      .select({
        businessId: businesses.id,
        businessName: businesses.tradeName,
        tenantSlug: businesses.tenantSlug,
        role: businessMembers.role,
        status: businessMembers.status,
        gstin: businessProfiles.gstin,
        registrationDate: businessProfiles.registrationDate,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .leftJoin(businessProfiles, eq(businessProfiles.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))

    return {
      auth: {
        userId: user.id,
        email: user.email,
        phone: user.phoneE164,
        role: "authenticated",
        aal: "aal1",
      },
      profile: {
        id: user.id,
        email: user.email,
        phone_e164: user.phoneE164,
        display_name: user.fullName,
        profile_image_seed: user.profileImageSeed,
        profile_image_style: user.profileImageStyle,
        locale: user.locale,
        onboarding_status:
          memberships.some((membership) => membership.status === "active") ?
            "completed"
          : "pending",
        last_login_at: user.lastLoginAt,
      },
      memberships: memberships.map((membership) => ({
        business_id: membership.businessId,
        business_name: membership.businessName,
        tenant_slug: membership.tenantSlug,
        tenant_url: this.getBusinessUrl({ tenantSlug: membership.tenantSlug }),
        role: membership.role,
        status: membership.status,
        gstin: membership.gstin,
        registration_date: membership.registrationDate,
      })),
    }
  }

  async registerBusiness(input: BusinessRegisterInput, context: RequestContext) {
    const email = normalizeEmail(input.email)
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    })

    try {
      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            fullName: input.fullName.trim(),
            ...createProfileImage(),
          })
          .returning()

        if (!user) {
          throw new HttpError(500, "Unable to create user.")
        }

        const tenantSlug = await this.createUniqueTenantSlug(
          input.company.tradeName,
          async (slug) => {
            const existing = await tx.query.businesses.findFirst({
              where: eq(businesses.tenantSlug, slug),
            })
            return Boolean(existing)
          }
        )

        const [business] = await tx
          .insert(businesses)
          .values({
            tenantSlug,
            legalName: input.company.legalName.trim(),
            tradeName: input.company.tradeName.trim(),
            pan: input.company.pan.trim().toUpperCase(),
            constitution: input.company.constitution.trim(),
            createdBy: user.id,
          })
          .returning()

        if (!business) {
          throw new HttpError(500, "Unable to create business.")
        }

        await tx.insert(businessMembers).values({
          businessId: business.id,
          userId: user.id,
          role: "owner",
          designation: "Owner",
          permissionPreset: "owner",
          status: "active",
        })

        return {
          user,
          business,
        }
      })

      await this.sendEmailVerification(result.user)

      return this.createAuthSession({
        user: result.user,
        redirectTo: this.getBusinessRedirect(result.business),
        business: result.business,
        context,
      })
    } catch (error) {
      throw mapDatabaseError(error)
    }
  }

  async registerWorkspace(input: WorkspaceRegisterInput) {
    const identifier = input.identifier.trim()
    const phoneRegistration = isPhoneIdentifier(identifier)
    const email = phoneRegistration ? null : normalizeEmail(identifier)
    const phoneE164 = phoneRegistration ? toIndianE164(identifier) : null
    const referralCode = normalizeReferralCode(input.caReferralCode)

    if (!referralCode) {
      throw new HttpError(400, "CA referral code is required.")
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    })

    try {
      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email,
            phoneE164,
            passwordHash,
            fullName: input.company.primaryContactName.trim(),
            ...createProfileImage(),
          })
          .returning()

        if (!user) {
          throw new HttpError(500, "Unable to create user.")
        }

        const tenantSlug = await this.createUniqueTenantSlug(
          input.company.tradeName,
          async (slug) => {
            const existing = await tx.query.businesses.findFirst({
              where: eq(businesses.tenantSlug, slug),
            })
            return Boolean(existing)
          }
        )

        const [business] = await tx
          .insert(businesses)
          .values({
            tenantSlug,
            legalName: input.company.legalName.trim(),
            tradeName: input.company.tradeName.trim(),
            pan: input.company.pan.trim().toUpperCase(),
            constitution: input.company.constitution.trim(),
            createdBy: user.id,
          })
          .returning()

        if (!business) {
          throw new HttpError(500, "Unable to create business.")
        }

        await tx.insert(businessMembers).values({
          businessId: business.id,
          userId: user.id,
          role: "owner",
          designation: "Owner",
          permissionPreset: "owner",
          status: "active",
        })

        const [businessProfile] = await tx
          .insert(businessProfiles)
          .values({
            businessId: business.id,
            gstin: input.registration.gstin.trim().toUpperCase(),
            businessEmail: input.company.businessEmail?.trim() || null,
            businessMobile: input.company.businessMobile?.trim() || null,
            primaryContactName: input.company.primaryContactName.trim(),
            primaryContactEmail: input.company.primaryContactEmail.trim().toLowerCase(),
            primaryContactMobile: input.company.primaryContactMobile.trim(),
            taxpayerType: input.registration.taxpayerType.trim(),
            registrationDate: input.registration.registrationDate.trim(),
            addressLine1: input.registration.principalAddressLine1.trim(),
            addressLine2: input.registration.principalAddressLine2?.trim() || null,
            locality: input.registration.locality.trim(),
            district: input.registration.district.trim(),
            pincode: input.registration.pincode.trim(),
            stateCode: input.registration.stateCode.trim(),
            possessionType: input.registration.possessionType.trim(),
            locationSource: input.registration.locationSource ?? "manual",
          })
          .returning()

        if (!businessProfile) {
          throw new HttpError(500, "Unable to create business profile.")
        }

        const [principalLocation] = await tx
          .insert(businessLocations)
          .values({
            businessId: business.id,
            name: `${business.tradeName} Principal Place`,
            locationCode: "PRINCIPAL",
            addressLine1: businessProfile.addressLine1,
            addressLine2: businessProfile.addressLine2,
            locality: businessProfile.locality,
            district: businessProfile.district,
            city: businessProfile.district,
            pincode: businessProfile.pincode,
            stateCode: businessProfile.stateCode,
            status: "active",
            isPrincipalPlace: true,
            isSalesLocation: true,
            isPurchaseLocation: true,
            isDispatchLocation: true,
            isOffice: true,
          })
          .returning()

        if (!principalLocation) {
          throw new HttpError(500, "Unable to create principal business location.")
        }

        const [gstRegistration] = await tx
          .insert(gstRegistrations)
          .values({
            businessId: business.id,
            gstin: businessProfile.gstin ?? input.registration.gstin.trim().toUpperCase(),
            legalName: business.legalName,
            tradeName: business.tradeName,
            taxpayerType: businessProfile.taxpayerType,
            stateCode: businessProfile.stateCode ?? input.registration.stateCode.trim(),
            registrationDate: businessProfile.registrationDate,
            effectiveFrom: businessProfile.registrationDate,
            status: "active",
            principalLocationId: principalLocation.id,
          })
          .returning()

        if (!gstRegistration) {
          throw new HttpError(500, "Unable to create GST registration.")
        }

        const [mainBranch] = await tx
          .insert(businessBranches)
          .values({
            businessId: business.id,
            locationId: principalLocation.id,
            gstRegistrationId: gstRegistration.id,
            branchCode: "MAIN",
            name: business.tradeName,
            branchType: "retail_store",
            status: "active",
          })
          .returning()

        if (!mainBranch) {
          throw new HttpError(500, "Unable to create main branch.")
        }

        const currentFinancialYear = getCurrentFinancialYear()
        const [financialYear] = await tx
          .insert(financialYears)
          .values({
            businessId: business.id,
            name: currentFinancialYear.name,
            startDate: currentFinancialYear.startDate,
            endDate: currentFinancialYear.endDate,
            status: "active",
            isCurrent: true,
          })
          .returning()

        if (!financialYear) {
          throw new HttpError(500, "Unable to create financial year.")
        }

        await tx.insert(invoiceSeries).values({
          businessId: business.id,
          gstRegistrationId: gstRegistration.id,
          branchId: mainBranch.id,
          financialYearId: financialYear.id,
          documentType: "invoice",
          seriesCode: "DEFAULT",
          prefix: "INV",
          nextNumber: 1,
          status: "active",
        })

        const acceptedAt = new Date()
        const invite = await tx.query.caClientInvites.findFirst({
          where: and(
            eq(caClientInvites.referralCode, referralCode),
            eq(caClientInvites.status, "pending"),
            gt(caClientInvites.expiresAt, acceptedAt)
          ),
        })

        if (!invite) {
          throw new HttpError(400, "CA referral code is invalid or expired.")
        }

        if (
          invite.clientGstin &&
          invite.clientGstin.trim().toUpperCase() !==
            input.registration.gstin.trim().toUpperCase()
        ) {
          throw new HttpError(400, "This referral code is assigned to a different GSTIN.")
        }

        await tx
          .insert(caBusinessLinks)
          .values({
            practiceId: invite.practiceId,
            businessId: business.id,
            accessScope: "gst_read_write",
            status: "active",
            acceptedAt,
          })
          .onConflictDoUpdate({
            target: [caBusinessLinks.practiceId, caBusinessLinks.businessId],
            set: {
              accessScope: "gst_read_write",
              status: "active",
              acceptedAt,
              updatedAt: acceptedAt,
            },
          })

        await tx
          .update(caClientInvites)
          .set({
            status: "accepted",
            acceptedBusinessId: business.id,
            acceptedAt,
            updatedAt: acceptedAt,
          })
          .where(eq(caClientInvites.id, invite.id))

        return {
          user,
          business,
          businessProfile,
          gstRegistration,
          mainBranch,
        }
      })

      if (result.user.email) {
        await this.sendEmailVerification(result.user)
      }

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          phone: result.user.phoneE164,
          profileImageSeed: result.user.profileImageSeed,
          profileImageStyle: result.user.profileImageStyle,
        },
        session: null,
        tenant: this.toPublicTenant(result.business),
        redirectTo: this.getBusinessLoginRedirect(result.business),
        requiresVerification: true,
        onboardingStatus: "pending",
        business: {
          id: result.business.id,
          tenantSlug: result.business.tenantSlug,
          tenantUrl: this.getBusinessUrl(result.business),
          legalName: result.business.legalName,
          tradeName: result.business.tradeName,
          pan: result.business.pan,
          constitution: result.business.constitution,
          businessEmail: result.businessProfile.businessEmail,
          businessMobile: result.businessProfile.businessMobile,
          primaryContactName: result.businessProfile.primaryContactName,
          primaryContactMobile: result.businessProfile.primaryContactMobile,
          primaryContactEmail: result.businessProfile.primaryContactEmail,
        },
        registration: {
          id: result.gstRegistration.id,
          gstin: result.businessProfile.gstin,
          taxpayerType: result.businessProfile.taxpayerType,
          registrationDate: result.businessProfile.registrationDate,
          principalAddressLine1: result.businessProfile.addressLine1,
          principalAddressLine2: result.businessProfile.addressLine2,
          locality: result.businessProfile.locality,
          district: result.businessProfile.district,
          pincode: result.businessProfile.pincode,
          stateCode: result.businessProfile.stateCode,
          possessionType: result.businessProfile.possessionType,
          locationSource: result.businessProfile.locationSource,
        },
      }
    } catch (error) {
      throw mapDatabaseError(error)
    }
  }

  async verifyCaReferral(input: CaReferralVerifyInput) {
    const referralCode = normalizeReferralCode(input.referralCode)
    const checkedAt = new Date()
    const [invite] = await db
      .select({
        referralCode: caClientInvites.referralCode,
        clientGstin: caClientInvites.clientGstin,
        practiceName: caPractices.practiceName,
      })
      .from(caClientInvites)
      .innerJoin(caPractices, eq(caPractices.id, caClientInvites.practiceId))
      .where(
        and(
          eq(caClientInvites.referralCode, referralCode),
          eq(caClientInvites.status, "pending"),
          gt(caClientInvites.expiresAt, checkedAt)
        )
      )
      .limit(1)

    if (!invite) {
      throw new HttpError(400, "CA referral code is invalid or expired.")
    }

    const gstin = input.gstin?.trim().toUpperCase() ?? ""

    if (
      invite.clientGstin &&
      gstin &&
      invite.clientGstin.trim().toUpperCase() !== gstin
    ) {
      throw new HttpError(400, "This referral code is assigned to a different GSTIN.")
    }

    return {
      valid: true,
      referralCode: invite.referralCode,
      practiceName: invite.practiceName,
      clientGstin: invite.clientGstin,
    }
  }

  async registerCa(input: CaRegisterInput, context: RequestContext) {
    const email = normalizeEmail(input.email)
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    })

    try {
      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            fullName: input.fullName.trim(),
            ...createProfileImage(),
          })
          .returning()

        if (!user) {
          throw new HttpError(500, "Unable to create user.")
        }

        const [practice] = await tx
          .insert(caPractices)
          .values({
            ownerUserId: user.id,
            practiceName: input.practiceName.trim(),
            contactEmail: email,
          })
          .returning()

        if (!practice) {
          throw new HttpError(500, "Unable to create CA practice.")
        }

        await tx.insert(caPracticeMembers).values({
          practiceId: practice.id,
          userId: user.id,
          role: "owner",
          status: "active",
        })

        return {
          user,
          practice,
        }
      })

      await this.sendEmailVerification(result.user)

      return this.createAuthSession({
        user: result.user,
        redirectTo: this.getCaRedirect(),
        business: null,
        context,
      })
    } catch (error) {
      throw mapDatabaseError(error)
    }
  }

  async loginBusiness(input: LoginInput, context: RequestContext) {
    const user = await this.verifyPasswordLogin(input)
    const business = await this.findPrimaryBusiness(user.id, context.tenantSlug)

    if (!business) {
      throw new HttpError(404, "Business account not found.")
    }

    await this.markLastLogin(user.id)

    return this.createAuthSession({
      user,
      redirectTo: this.getBusinessRedirect(business),
      business,
      context,
    })
  }

  async loginBusinessWithIdentifier(
    input: IdentifierLoginInput,
    context: RequestContext
  ) {
    if (isPhoneIdentifier(input.identifier)) {
      throw new HttpError(400, "Use OTP login for phone number accounts.")
    }

    return this.loginBusiness(
      {
        email: normalizeEmail(input.identifier),
        password: input.password,
      },
      context
    )
  }

  async loginCa(input: LoginInput, context: RequestContext) {
    const user = await this.verifyPasswordLogin(input)
    const practice = await this.findPrimaryCaPractice(user.id)

    if (!practice) {
      throw new HttpError(404, "CA account not found.")
    }

    await this.markLastLogin(user.id)

    return this.createAuthSession({
      user,
      redirectTo: this.getCaRedirect(),
      business: null,
      context,
    })
  }

  async verifyPhoneToken(input: PhoneTokenVerifyInput, context: RequestContext) {
    const decodedToken = await verifyFirebaseIdToken(input.idToken)
    const phoneE164 = normalizeE164Phone(decodedToken.phone_number)

    const user = await db.query.users.findFirst({
      where: eq(users.phoneE164, phoneE164),
    })

    if (!user || user.status !== "active") {
      throw new HttpError(404, "Phone account not found.")
    }

    const business = await this.findPrimaryBusiness(user.id, context.tenantSlug)

    if (!business) {
      throw new HttpError(404, "Business account not found.")
    }

    await db
      .update(users)
      .set({
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return this.createAuthSession({
      user: {
        ...user,
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      },
      redirectTo: this.getBusinessRedirect(business),
      business,
      context,
    })
  }

  async getSession(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new HttpError(401, "Not authenticated.")
    }

    const tokenHash = sha256(refreshToken)
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.refreshTokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      ),
    })

    if (!session) {
      throw new HttpError(401, "Session expired.")
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    })

    if (!user || user.status !== "active") {
      throw new HttpError(401, "Session expired.")
    }

    const accessToken = await this.createAccessToken(user)
    const business = await this.findPrimaryBusiness(user.id)

    return {
      user: toPublicUser(user),
      accessToken,
      accessTokenExpiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      tenant: business ? this.toPublicTenant(business) : null,
    }
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return
    }

    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(sessions.refreshTokenHash, sha256(refreshToken)))
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizeEmail(input.email)),
    })

    if (!user) {
      return
    }

    const token = createUrlToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt,
    })

    const resetUrl = `${this.env.WEB_ORIGIN}/auth/reset-password?token=${encodeURIComponent(token)}`
    await this.mailService.sendMail({
      to: input.email,
      subject: "Reset your GSTFY password",
      text: `Use this link to reset your GSTFY password: ${resetUrl}`,
      html: buildActionEmailHtml({
        eyebrow: "Password reset",
        title: "Reset your GSTFY password",
        body: "Use this secure link to create a new password for your GSTFY account. The link expires in 1 hour.",
        actionLabel: "Reset password",
        actionUrl: resetUrl,
      }),
    })
  }

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = sha256(input.token)
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
    })

    if (!resetToken) {
      throw new HttpError(400, "Password reset link is invalid or expired.")
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    })

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
        })
        .where(eq(users.id, resetToken.userId))

      await tx
        .update(passwordResetTokens)
        .set({
          consumedAt: new Date(),
        })
        .where(eq(passwordResetTokens.id, resetToken.id))
    })
  }

  async verifyEmail(input: VerifyEmailInput) {
    const tokenHash = sha256(input.token)
    const verificationToken = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.consumedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      ),
    })

    if (!verificationToken) {
      throw new HttpError(400, "Email verification link is invalid or expired.")
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          emailVerifiedAt: new Date(),
        })
        .where(eq(users.id, verificationToken.userId))

      await tx
        .update(emailVerificationTokens)
        .set({
          consumedAt: new Date(),
        })
        .where(eq(emailVerificationTokens.id, verificationToken.id))
    })
  }

  async regenerateProfileImage(user: UserRecord) {
    const avatar = createProfileImage()
    const [updatedUser] = await db
      .update(users)
      .set({
        ...avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()

    return updatedUser ?? {
      ...user,
      ...avatar,
    }
  }

  private async verifyPasswordLogin(input: LoginInput) {
    const email = normalizeEmail(input.email)
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user || user.status !== "active" || !user.passwordHash) {
      throw new HttpError(401, "Invalid email or password.")
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, input.password)

    if (!isPasswordValid) {
      throw new HttpError(401, "Invalid email or password.")
    }

    return user
  }

  private async createAuthSession(input: {
    user: UserRecord
    redirectTo: string
    business: Pick<BusinessRecord, "id" | "tenantSlug" | "legalName" | "tradeName"> | null
    context: RequestContext
  }): Promise<AuthSessionPayload> {
    const refreshToken = createUrlToken(48)
    const refreshTokenHash = sha256(refreshToken)
    const expiresAt = new Date(
      Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    )
    const [session] = await db
      .insert(sessions)
      .values({
        userId: input.user.id,
        refreshTokenHash,
        expiresAt,
        userAgent: input.context.userAgent,
        ipAddress: input.context.ipAddress,
      })
      .returning()

    if (!session) {
      throw new HttpError(500, "Unable to create session.")
    }

    return {
      user: toPublicUser(input.user),
      accessToken: await this.createAccessToken(input.user),
      accessTokenExpiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      refreshToken,
      redirectTo: input.redirectTo,
      tenant: input.business ? this.toPublicTenant(input.business) : null,
    }
  }

  private createAccessToken(user: UserRecord) {
    return new SignJWT({
      email: user.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.env.JWT_ACCESS_TTL_SECONDS}s`)
      .sign(accessTokenEncoder.encode(this.env.JWT_ACCESS_SECRET))
  }

  private async sendEmailVerification(user: UserRecord) {
    if (!user.email) {
      return
    }

    const token = createUrlToken()
    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      email: user.email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    })

    const verifyUrl = `${this.env.WEB_ORIGIN}/auth/verify-email?token=${encodeURIComponent(token)}`
    await this.mailService.sendMail({
      to: user.email,
      subject: "Verify your GSTFY email",
      text: `Use this link to verify your GSTFY email: ${verifyUrl}`,
      html: buildActionEmailHtml({
        eyebrow: "Email verification",
        title: "Verify your GSTFY email",
        body: "Confirm this email address to secure your GSTFY account and receive important registration, filing, and account notifications.",
        actionLabel: "Verify email",
        actionUrl: verifyUrl,
        footer: "This verification link expires in 24 hours.",
      }),
    })
  }

  private findPrimaryBusiness(userId: string, tenantSlug?: string | null) {
    return db
      .select({
        id: businesses.id,
        tenantSlug: businesses.tenantSlug,
        legalName: businesses.legalName,
        tradeName: businesses.tradeName,
        pan: businesses.pan,
        constitution: businesses.constitution,
        status: businesses.status,
        createdBy: businesses.createdBy,
        createdAt: businesses.createdAt,
        updatedAt: businesses.updatedAt,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          ...(tenantSlug ? [eq(businesses.tenantSlug, tenantSlug)] : [])
        )
      )
      .limit(1)
      .then((items) => items[0] ?? null)
  }

  private findPrimaryBusinessAccount(userId: string, tenantSlug?: string | null) {
    return db
      .select({
        id: businesses.id,
        tenantSlug: businesses.tenantSlug,
        legalName: businesses.legalName,
        tradeName: businesses.tradeName,
        pan: businesses.pan,
        constitution: businesses.constitution,
        status: businesses.status,
        createdBy: businesses.createdBy,
        createdAt: businesses.createdAt,
        updatedAt: businesses.updatedAt,
        gstin: gstRegistrations.gstin,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .leftJoin(gstRegistrations, eq(gstRegistrations.businessId, businesses.id))
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          ...(tenantSlug ? [eq(businesses.tenantSlug, tenantSlug)] : [])
        )
      )
      .limit(1)
      .then((items) => items[0] ?? null)
  }

  private findPrimaryCaPractice(userId: string) {
    return db
      .select({
        id: caPractices.id,
        ownerUserId: caPractices.ownerUserId,
        practiceName: caPractices.practiceName,
        status: caPractices.status,
        contactEmail: caPractices.contactEmail,
        contactPhoneE164: caPractices.contactPhoneE164,
        createdAt: caPractices.createdAt,
        updatedAt: caPractices.updatedAt,
      })
      .from(caPracticeMembers)
      .innerJoin(caPractices, eq(caPractices.id, caPracticeMembers.practiceId))
      .where(
        and(
          eq(caPracticeMembers.userId, userId),
          eq(caPracticeMembers.status, "active")
        )
      )
      .limit(1)
      .then((items) => items[0] ?? null)
  }

  private async markLastLogin(userId: string) {
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, userId))
  }

  private getBusinessRedirect(business: Pick<BusinessRecord, "tenantSlug">) {
    const businessUrl = this.getBusinessUrl(business)

    if (!businessUrl) {
      return "/dashboard"
    }

    return `${businessUrl}/dashboard`
  }

  private getBusinessLoginRedirect(business: Pick<BusinessRecord, "tenantSlug">) {
    const businessUrl = this.getBusinessUrl(business)

    if (!businessUrl) {
      return "/auth/login"
    }

    return `${businessUrl}/auth/login`
  }

  private getCaRedirect() {
    return getCaAppUrl("/dashboard", this.env)
  }

  private getBusinessUrl(business: Pick<BusinessRecord, "tenantSlug">) {
    return getTenantUrl(business.tenantSlug, this.env)
  }

  private toPublicTenant(
    business: Pick<BusinessRecord, "id" | "tenantSlug" | "legalName" | "tradeName">
  ): PublicTenant {
    return {
      id: business.id,
      slug: business.tenantSlug,
      legalName: business.legalName,
      tradeName: business.tradeName,
      url: this.getBusinessUrl(business),
    }
  }

  private async createUniqueTenantSlug(
    tradeName: string,
    exists: (slug: string) => Promise<boolean>
  ) {
    const baseSlug = createTenantSlug(tradeName)
    let slug = baseSlug
    let suffix = 2

    while (await exists(slug)) {
      slug = `${baseSlug}-${suffix}`
      suffix += 1
    }

    return slug
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase()
}

function isPhoneIdentifier(identifier: string) {
  return /^[+\d\s()-]+$/.test(identifier.trim())
}

function toIndianE164(identifier: string) {
  let digits = identifier.replace(/\D/g, "")

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2)
  }

  digits = digits.slice(0, 10)

  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new HttpError(400, "Enter a valid 10-digit Indian mobile number.")
  }

  return `+91${digits}`
}

function normalizeE164Phone(phoneNumber: string | undefined) {
  if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new HttpError(400, "Firebase token does not contain a valid phone number.")
  }

  return phoneNumber
}

function getCurrentFinancialYear(date = new Date()) {
  const calendarYear = date.getFullYear()
  const startYear = date.getMonth() + 1 >= 4 ? calendarYear : calendarYear - 1
  const endYear = startYear + 1

  return {
    name: `${startYear}-${String(endYear).slice(-2)}`,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
  }
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phoneE164: user.phoneE164,
    fullName: user.fullName,
    profileImageSeed: user.profileImageSeed,
    profileImageStyle: user.profileImageStyle,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
  }
}

function mapDatabaseError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  ) {
    return new HttpError(409, "An account with these details already exists.")
  }

  return error
}
