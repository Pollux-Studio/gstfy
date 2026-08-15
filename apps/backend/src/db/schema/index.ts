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
    designation: text("designation"),
    permissionPreset: text("permission_preset").notNull().default("custom"),
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

export const businessLocations = pgTable(
  "business_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    locationCode: text("location_code").notNull(),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    locality: text("locality"),
    district: text("district"),
    city: text("city"),
    pincode: text("pincode"),
    stateCode: text("state_code"),
    state: text("state"),
    country: text("country").notNull().default("India"),
    status: text("status").notNull().default("active"),
    isPrincipalPlace: boolean("is_principal_place").notNull().default(false),
    isAdditionalPlace: boolean("is_additional_place").notNull().default(false),
    isSalesLocation: boolean("is_sales_location").notNull().default(true),
    isPurchaseLocation: boolean("is_purchase_location").notNull().default(true),
    isDispatchLocation: boolean("is_dispatch_location").notNull().default(true),
    isWarehouseLocation: boolean("is_warehouse_location").notNull().default(false),
    isOffice: boolean("is_office").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("business_locations_business_id_idx").on(table.businessId),
    businessCodeUnique: uniqueIndex("business_locations_business_code_unique").on(
      table.businessId,
      table.locationCode
    ),
  })
)

export const gstRegistrations = pgTable(
  "gst_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstin: text("gstin").notNull(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name").notNull(),
    taxpayerType: text("taxpayer_type"),
    registrationType: text("registration_type").notNull().default("gst"),
    stateCode: text("state_code").notNull(),
    state: text("state"),
    registrationDate: text("registration_date"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("active"),
    principalLocationId: uuid("principal_location_id").references(
      () => businessLocations.id,
      { onDelete: "set null" }
    ),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("gst_registrations_business_id_idx").on(table.businessId),
    gstinIndex: index("gst_registrations_gstin_idx").on(table.gstin),
    businessGstinUnique: uniqueIndex("gst_registrations_business_gstin_unique").on(
      table.businessId,
      table.gstin
    ),
  })
)

export const businessBranches = pgTable(
  "business_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => businessLocations.id),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchCode: text("branch_code").notNull(),
    name: text("name").notNull(),
    branchType: text("branch_type").notNull().default("retail_store"),
    managerName: text("manager_name"),
    phone: text("phone"),
    email: text("email"),
    openingDate: text("opening_date"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("business_branches_business_id_idx").on(table.businessId),
    locationIndex: index("business_branches_location_id_idx").on(table.locationId),
    businessCodeUnique: uniqueIndex("business_branches_business_code_unique").on(
      table.businessId,
      table.branchCode
    ),
  })
)

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => businessLocations.id),
    warehouseCode: text("warehouse_code").notNull(),
    name: text("name").notNull(),
    warehouseType: text("warehouse_type"),
    capacity: text("capacity"),
    managerName: text("manager_name"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("warehouses_business_id_idx").on(table.businessId),
    locationIndex: index("warehouses_location_id_idx").on(table.locationId),
    businessCodeUnique: uniqueIndex("warehouses_business_code_unique").on(
      table.businessId,
      table.warehouseCode
    ),
  })
)

export const branchWarehouses = pgTable(
  "branch_warehouses",
  {
    branchId: uuid("branch_id")
      .notNull()
      .references(() => businessBranches.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    branchWarehouseUnique: uniqueIndex("branch_warehouses_unique").on(
      table.branchId,
      table.warehouseId
    ),
  })
)

export const businessMemberBranches = pgTable(
  "business_member_branches",
  {
    businessMemberId: uuid("business_member_id")
      .notNull()
      .references(() => businessMembers.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => businessBranches.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberBranchUnique: uniqueIndex("business_member_branches_unique").on(
      table.businessMemberId,
      table.branchId
    ),
  })
)

export const financialYears = pgTable(
  "financial_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    status: text("status").notNull().default("active"),
    isCurrent: boolean("is_current").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("financial_years_business_id_idx").on(table.businessId),
    businessNameUnique: uniqueIndex("financial_years_business_name_unique").on(
      table.businessId,
      table.name
    ),
  })
)

export const invoiceSeries = pgTable(
  "invoice_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    financialYearId: uuid("financial_year_id")
      .notNull()
      .references(() => financialYears.id),
    documentType: text("document_type").notNull().default("invoice"),
    seriesCode: text("series_code").notNull(),
    prefix: text("prefix").notNull(),
    suffix: text("suffix"),
    nextNumber: integer("next_number").notNull().default(1),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("invoice_series_business_id_idx").on(table.businessId),
    gstRegistrationIndex: index("invoice_series_gst_registration_id_idx").on(
      table.gstRegistrationId
    ),
    businessSeriesUnique: uniqueIndex("invoice_series_business_series_unique").on(
      table.businessId,
      table.seriesCode,
      table.financialYearId,
      table.documentType
    ),
  })
)

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
export type BusinessBranchRecord = typeof businessBranches.$inferSelect
export type BusinessLocationRecord = typeof businessLocations.$inferSelect
export type CaPracticeRecord = typeof caPractices.$inferSelect
export type BusinessMemberRecord = typeof businessMembers.$inferSelect
export type CaBusinessLinkRecord = typeof caBusinessLinks.$inferSelect
export type CaClientInviteRecord = typeof caClientInvites.$inferSelect
export type GstRegistrationRecord = typeof gstRegistrations.$inferSelect
export type WarehouseRecord = typeof warehouses.$inferSelect
