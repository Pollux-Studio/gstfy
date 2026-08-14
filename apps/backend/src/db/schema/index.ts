import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    phoneE164: text("phone_e164"),
    passwordHash: text("password_hash"),
    fullName: text("full_name"),
    profileImageSeed: text("profile_image_seed"),
    profileImageStyle: text("profile_image_style").notNull().default("glyphs"),
    locale: text("locale").notNull().default("en"),
    status: text("status").notNull().default("active"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    phoneUnique: uniqueIndex("users_phone_e164_unique").on(table.phoneE164),
  })
)

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug: text("tenant_slug").notNull(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name").notNull(),
    pan: text("pan").notNull(),
    constitution: text("constitution").notNull(),
    status: text("status").notNull().default("pending_verification"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    tenantSlugUnique: uniqueIndex("businesses_tenant_slug_unique").on(
      table.tenantSlug
    ),
    panIndex: index("businesses_pan_idx").on(table.pan),
  })
)

export const businessMembers = pgTable(
  "business_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    memberUnique: uniqueIndex("business_members_business_user_unique").on(
      table.businessId,
      table.userId
    ),
  })
)

export const businessProfiles = pgTable("business_profiles", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  gstin: text("gstin"),
  businessEmail: text("business_email"),
  businessMobile: text("business_mobile"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactMobile: text("primary_contact_mobile"),
  taxpayerType: text("taxpayer_type"),
  registrationDate: text("registration_date"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  locality: text("locality"),
  district: text("district"),
  pincode: text("pincode"),
  stateCode: text("state_code"),
  possessionType: text("possession_type"),
  locationSource: text("location_source").notNull().default("manual"),
  ...timestamps,
})

export const businessPreferences = pgTable("business_preferences", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  invoiceTemplate: text("invoice_template").notNull().default("standard"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  invoiceNextNumber: integer("invoice_next_number").notNull().default(1),
  enabledGstSlabs: text("enabled_gst_slabs").notNull().default("5,12,18,28"),
  printerPaperSize: text("printer_paper_size").notNull().default("a4"),
  printerCopies: integer("printer_copies").notNull().default(1),
  printOrientation: text("print_orientation").notNull().default("portrait"),
  autoOpenPrintDialog: boolean("auto_open_print_dialog").notNull().default(true),
  compactPrintLayout: boolean("compact_print_layout").notNull().default(false),
  ...timestamps,
})

export const businessMemberPermissions = pgTable(
  "business_member_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessMemberId: uuid("business_member_id")
      .notNull()
      .references(() => businessMembers.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    canView: boolean("can_view").notNull().default(false),
    canCreate: boolean("can_create").notNull().default(false),
    canEdit: boolean("can_edit").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    memberModuleUnique: uniqueIndex(
      "business_member_permissions_member_module_unique"
    ).on(table.businessMemberId, table.module),
  })
)

export const caPractices = pgTable(
  "ca_practices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    practiceName: text("practice_name").notNull(),
    status: text("status").notNull().default("active"),
    contactEmail: text("contact_email"),
    contactPhoneE164: text("contact_phone_e164"),
    ...timestamps,
  },
  (table) => ({
    ownerUnique: uniqueIndex("ca_practices_owner_user_unique").on(
      table.ownerUserId
    ),
  })
)

export const caPracticeMembers = pgTable(
  "ca_practice_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => caPractices.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    memberUnique: uniqueIndex("ca_practice_members_practice_user_unique").on(
      table.practiceId,
      table.userId
    ),
  })
)

export const caClientInvites = pgTable(
  "ca_client_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => caPractices.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    clientGstin: text("client_gstin"),
    referralCode: text("referral_code").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBusinessId: uuid("accepted_business_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    practiceIndex: index("ca_client_invites_practice_id_idx").on(table.practiceId),
    referralCodeUnique: uniqueIndex("ca_client_invites_referral_code_unique").on(
      table.referralCode
    ),
  })
)

export const caBusinessLinks = pgTable(
  "ca_business_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => caPractices.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    accessScope: text("access_scope").notNull().default("gst_read_write"),
    status: text("status").notNull().default("active"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    practiceBusinessUnique: uniqueIndex(
      "ca_business_links_practice_business_unique"
    ).on(table.practiceId, table.businessId),
    practiceIndex: index("ca_business_links_practice_id_idx").on(table.practiceId),
    businessIndex: index("ca_business_links_business_id_idx").on(table.businessId),
  })
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tokenUnique: uniqueIndex("sessions_refresh_token_hash_unique").on(
      table.refreshTokenHash
    ),
    userIndex: index("sessions_user_id_idx").on(table.userId),
  })
)

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tokenUnique: uniqueIndex("email_verification_tokens_hash_unique").on(
      table.tokenHash
    ),
  })
)

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tokenUnique: uniqueIndex("password_reset_tokens_hash_unique").on(
      table.tokenHash
    ),
  })
)

export type UserRecord = typeof users.$inferSelect
export type BusinessRecord = typeof businesses.$inferSelect
export type CaPracticeRecord = typeof caPractices.$inferSelect
export type BusinessMemberRecord = typeof businessMembers.$inferSelect
export type CaBusinessLinkRecord = typeof caBusinessLinks.$inferSelect
export type CaClientInviteRecord = typeof caClientInvites.$inferSelect
