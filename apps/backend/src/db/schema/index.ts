import {
  sql,
} from "drizzle-orm"
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
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
    mustChangePassword: boolean("must_change_password").notNull().default(false),
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
  logoObjectKey: text("logo_object_key"),
  logoPublicUrl: text("logo_public_url"),
  logoFileName: text("logo_file_name"),
  logoContentType: text("logo_content_type"),
  logoFileSizeBytes: integer("logo_file_size_bytes"),
  logoUploadedAt: timestamp("logo_uploaded_at", { withTimezone: true }),
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
    businessIdentityUnique: uniqueIndex("gst_registrations_id_business_id_unique").on(
      table.id,
      table.businessId
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
    businessIdentityUnique: uniqueIndex("business_branches_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
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
    businessIdentityUnique: uniqueIndex("warehouses_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
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

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    voucherType: text("voucher_type").notNull(),
    voucherNumber: text("voucher_number").notNull(),
    voucherDate: text("voucher_date").notNull(),
    financialYearId: uuid("financial_year_id")
      .notNull()
      .references(() => financialYears.id),
    status: text("status").notNull().default("posted"),
    referenceVoucherId: uuid("reference_voucher_id").references(
      (): AnyPgColumn => vouchers.id,
      { onDelete: "set null" }
    ),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    sellerSnapshot: jsonb("seller_snapshot"),
    branchSnapshot: jsonb("branch_snapshot"),
    partySnapshot: jsonb("party_snapshot"),
    taxSnapshot: jsonb("tax_snapshot"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("vouchers_business_id_idx").on(table.businessId),
    branchIndex: index("vouchers_branch_id_idx").on(table.branchId),
    warehouseIndex: index("vouchers_warehouse_id_idx").on(table.warehouseId),
    gstRegistrationIndex: index("vouchers_gst_registration_id_idx").on(
      table.gstRegistrationId
    ),
    referenceVoucherIndex: index("vouchers_reference_voucher_id_idx").on(
      table.referenceVoucherId
    ),
    businessNumberUnique: uniqueIndex("vouchers_business_number_unique").on(
      table.businessId,
      table.financialYearId,
      table.voucherType,
      table.voucherNumber
    ),
    businessIdentityUnique: uniqueIndex("vouchers_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
  })
)

export const postingIdempotencyKeys = pgTable(
  "posting_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("in_progress"),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    responseBody: jsonb("response_body"),
    ...timestamps,
  },
  (table) => ({
    businessKeyUnique: uniqueIndex("posting_idempotency_business_key_unique").on(
      table.businessId,
      table.idempotencyKey
    ),
    businessIndex: index("posting_idempotency_business_id_idx").on(table.businessId),
  })
)

export const moneyOperationIdempotencyKeys = pgTable(
  "money_operation_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("in_progress"),
    responseBody: jsonb("response_body"),
    ...timestamps,
  },
  (table) => ({
    businessOperationKeyUnique: uniqueIndex(
      "money_operation_idempotency_business_operation_key_unique"
    ).on(table.businessId, table.operation, table.idempotencyKey),
    businessIndex: index("money_operation_idempotency_business_id_idx").on(
      table.businessId
    ),
    operationIndex: index("money_operation_idempotency_operation_idx").on(
      table.operation
    ),
  })
)

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "cascade",
    }),
    sourceType: text("source_type").notNull().default("VOUCHER"),
    sourceId: text("source_id"),
    entryDate: text("entry_date").notNull(),
    description: text("description"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("journal_entries_business_id_idx").on(table.businessId),
    voucherIndex: index("journal_entries_voucher_id_idx").on(table.voucherId),
  })
)

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    accountCode: text("account_code").notNull(),
    accountName: text("account_name").notNull(),
    accountType: text("account_type").notNull(),
    accountGroup: text("account_group").notNull().default("UNCATEGORIZED"),
    normalBalance: text("normal_balance").notNull(),
    parentAccountId: uuid("parent_account_id").references(
      (): AnyPgColumn => ledgerAccounts.id,
      { onDelete: "set null" }
    ),
    isSystem: boolean("is_system").notNull().default(false),
    allowPosting: boolean("allow_posting").notNull().default(true),
    description: text("description"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("ledger_accounts_business_id_idx").on(table.businessId),
    businessIdentityUnique: uniqueIndex("ledger_accounts_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    parentIndex: index("ledger_accounts_parent_account_id_idx").on(
      table.parentAccountId
    ),
    businessCodeUnique: uniqueIndex("ledger_accounts_business_code_unique").on(
      table.businessId,
      table.accountCode
    ),
  })
)

export const journalEntryLines = pgTable(
  "journal_entry_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, {
        onDelete: "restrict",
      }),
    accountCode: text("account_code").notNull(),
    accountName: text("account_name").notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    narration: text("narration"),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("journal_entry_lines_business_id_idx").on(table.businessId),
    journalEntryIndex: index("journal_entry_lines_entry_id_idx").on(
      table.journalEntryId
    ),
    accountIndex: index("journal_entry_lines_account_id_idx").on(table.accountId),
    branchIndex: index("journal_entry_lines_branch_id_idx").on(table.branchId),
    gstRegistrationIndex: index("journal_entry_lines_gst_registration_id_idx").on(
      table.gstRegistrationId
    ),
    warehouseIndex: index("journal_entry_lines_warehouse_id_idx").on(table.warehouseId),
  })
)

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "cascade",
    }),
    sourceType: text("source_type").notNull().default("VOUCHER"),
    sourceId: text("source_id"),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    itemId: text("item_id"),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    unitSnapshot: text("unit_snapshot"),
    itemSnapshot: jsonb("item_snapshot"),
    movementType: text("movement_type").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    quantityIn: numeric("quantity_in", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    quantityOut: numeric("quantity_out", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    unit: text("unit").notNull().default("pcs"),
    sourceUnit: text("source_unit"),
    baseQuantity: numeric("base_quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }),
    totalCost: numeric("total_cost", { precision: 14, scale: 2 }),
    inventoryValue: numeric("inventory_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    batchId: text("batch_id"),
    serialId: text("serial_id"),
    batchNumberSnapshot: text("batch_number_snapshot"),
    serialNumberSnapshot: text("serial_number_snapshot"),
    transactionDate: text("transaction_date").notNull().default("1970-01-01"),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("inventory_transactions_business_id_idx").on(
      table.businessId
    ),
    voucherIndex: index("inventory_transactions_voucher_id_idx").on(table.voucherId),
    warehouseIndex: index("inventory_transactions_warehouse_id_idx").on(
      table.warehouseId
    ),
    branchIndex: index("inventory_transactions_branch_id_idx").on(table.branchId),
    itemWarehouseIndex: index("inventory_transactions_item_warehouse_idx").on(
      table.businessId,
      table.itemId,
      table.warehouseId,
      table.transactionDate
    ),
  })
)

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    quantityOnHand: numeric("quantity_on_hand", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    inventoryValue: numeric("inventory_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("inventory_balances_business_id_idx").on(table.businessId),
    warehouseIndex: index("inventory_balances_warehouse_id_idx").on(table.warehouseId),
    itemWarehouseUnique: uniqueIndex("inventory_balances_item_warehouse_unique").on(
      table.businessId,
      table.itemId,
      table.warehouseId
    ),
  })
)

export const businessInventorySettings = pgTable("business_inventory_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  negativeStockPolicy: text("negative_stock_policy").notNull().default("WARN"),
  valuationMethod: text("valuation_method").notNull().default("WEIGHTED_AVERAGE"),
  ...timestamps,
})

export const inventoryCostLayers = pgTable(
  "inventory_cost_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    sourceTransactionId: uuid("source_transaction_id").references(
      () => inventoryTransactions.id,
      { onDelete: "set null" }
    ),
    quantityRemaining: numeric("quantity_remaining", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("inventory_cost_layers_business_id_idx").on(table.businessId),
    itemWarehouseIndex: index("inventory_cost_layers_item_warehouse_idx").on(
      table.businessId,
      table.itemId,
      table.warehouseId
    ),
  })
)

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sourceWarehouseId: uuid("source_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    destinationWarehouseId: uuid("destination_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("DRAFT"),
    transferDate: text("transfer_date").notNull(),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("stock_transfers_business_id_idx").on(table.businessId),
    sourceWarehouseIndex: index("stock_transfers_source_warehouse_id_idx").on(
      table.sourceWarehouseId
    ),
    destinationWarehouseIndex: index(
      "stock_transfers_destination_warehouse_id_idx"
    ).on(table.destinationWarehouseId),
  })
)

export const stockTransferLines = pgTable(
  "stock_transfer_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfers.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit").notNull().default("PCS"),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    batchId: text("batch_id"),
    serialId: text("serial_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    transferIndex: index("stock_transfer_lines_transfer_id_idx").on(table.transferId),
    itemIndex: index("stock_transfer_lines_item_id_idx").on(
      table.businessId,
      table.itemId
    ),
  })
)

export const inventoryBatches = pgTable(
  "inventory_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    batchNumber: text("batch_number").notNull(),
    manufacturingDate: text("manufacturing_date"),
    expiryDate: text("expiry_date"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("inventory_batches_business_id_idx").on(table.businessId),
    batchUnique: uniqueIndex("inventory_batches_business_item_number_unique").on(
      table.businessId,
      table.itemId,
      table.batchNumber
    ),
  })
)

export const inventorySerialNumbers = pgTable(
  "inventory_serial_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    serialNumber: text("serial_number").notNull(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    sourceTransactionId: uuid("source_transaction_id").references(
      () => inventoryTransactions.id,
      { onDelete: "set null" }
    ),
    status: text("status").notNull().default("IN_STOCK"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("inventory_serial_numbers_business_id_idx").on(
      table.businessId
    ),
    serialUnique: uniqueIndex("inventory_serial_numbers_business_serial_unique").on(
      table.businessId,
      table.serialNumber
    ),
  })
)

export const gstEntries = pgTable(
  "gst_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    entryType: text("entry_type").notNull(),
    taxComponent: text("tax_component").notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    placeOfSupplyStateCode: text("place_of_supply_state_code"),
    itcEligibility: text("itc_eligibility"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("gst_entries_business_id_idx").on(table.businessId),
    voucherIndex: index("gst_entries_voucher_id_idx").on(table.voucherId),
    registrationIndex: index("gst_entries_gst_registration_id_idx").on(
      table.gstRegistrationId
    ),
  })
)

export const receivablePayableEntries = pgTable(
  "receivable_payable_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    partyId: text("party_id"),
    partyNameSnapshot: text("party_name_snapshot").notNull(),
    partySnapshot: jsonb("party_snapshot"),
    entryType: text("entry_type").notNull(),
    originalAmount: numeric("original_amount", { precision: 14, scale: 2 }).notNull(),
    settledAmount: numeric("settled_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    adjustmentAmount: numeric("adjustment_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    effectiveAmount: numeric("effective_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    outstandingAmount: numeric("outstanding_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    excessSettledAmount: numeric("excess_settled_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    dueDate: text("due_date"),
    status: text("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("receivable_payable_entries_business_id_idx").on(
      table.businessId
    ),
    voucherIndex: index("receivable_payable_entries_voucher_id_idx").on(
      table.voucherId
    ),
    partyIndex: index("receivable_payable_entries_party_id_idx").on(table.partyId),
    businessIdentityUnique: uniqueIndex(
      "receivable_payable_entries_id_business_id_unique"
    ).on(table.id, table.businessId),
  })
)

export const paymentTerms = pgTable(
  "payment_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    days: integer("days").notNull().default(0),
    dueDateRule: text("due_date_rule")
      .notNull()
      .default("invoice_date_plus_days"),
    status: text("status").notNull().default("active"),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("payment_terms_business_id_idx").on(table.businessId),
    businessIdentityUnique: uniqueIndex("payment_terms_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    businessCodeUnique: uniqueIndex("payment_terms_business_code_unique").on(
      table.businessId,
      table.code
    ),
  })
)

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    paymentVoucherId: uuid("payment_voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    allocationKind: text("allocation_kind").notNull().default("payment"),
    receiptId: uuid("receipt_id").references(() => receipts.id, {
      onDelete: "cascade",
    }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "cascade",
    }),
    documentVoucherId: uuid("document_voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    receivablePayableEntryId: uuid("receivable_payable_entry_id").references(
      () => receivablePayableEntries.id,
      { onDelete: "set null" }
    ),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 }).notNull(),
    allocatedAt: timestamp("allocated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("payment_allocations_business_id_idx").on(table.businessId),
    paymentVoucherIndex: index("payment_allocations_payment_voucher_id_idx").on(
      table.paymentVoucherId
    ),
    documentVoucherIndex: index("payment_allocations_document_voucher_id_idx").on(
      table.documentVoucherId
    ),
    receivablePayableEntryIndex: index(
      "payment_allocations_receivable_payable_entry_id_idx"
    ).on(table.receivablePayableEntryId),
    statusIndex: index("payment_allocations_status_idx").on(table.status),
    kindIndex: index("payment_allocations_allocation_kind_idx").on(table.allocationKind),
    receiptIndex: index("payment_allocations_receipt_id_idx").on(table.receiptId),
    paymentIndex: index("payment_allocations_payment_id_idx").on(table.paymentId),
  })
)

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    cashBankAccountId: uuid("cash_bank_account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    receiptNumber: text("receipt_number").notNull(),
    receiptDate: date("receipt_date").notNull(),
    paymentMethod: text("payment_method").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    unallocatedAmount: numeric("unallocated_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    unallocatedTreatment: text("unallocated_treatment").notNull().default("advance"),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    partyNameSnapshot: text("party_name_snapshot").notNull(),
    partySnapshot: jsonb("party_snapshot"),
    cashBankAccountSnapshot: jsonb("cash_bank_account_snapshot"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("receipts_business_id_idx").on(table.businessId),
    partyIndex: index("receipts_party_id_idx").on(table.partyId),
    voucherIndex: index("receipts_voucher_id_idx").on(table.voucherId),
    statusIndex: index("receipts_status_idx").on(table.status),
    businessNumberUnique: uniqueIndex("receipts_business_number_unique").on(
      table.businessId,
      table.receiptNumber
    ),
    businessIdentityUnique: uniqueIndex("receipts_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "receipts_party_business_fk",
    }),
    branchBusinessFk: foreignKey({
      columns: [table.branchId, table.businessId],
      foreignColumns: [businessBranches.id, businessBranches.businessId],
      name: "receipts_branch_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "receipts_gst_registration_business_fk",
    }),
    cashBankAccountBusinessFk: foreignKey({
      columns: [table.cashBankAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "receipts_cash_bank_account_business_fk",
    }),
  })
)

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, { onDelete: "set null" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    cashBankAccountId: uuid("cash_bank_account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    paymentNumber: text("payment_number").notNull(),
    paymentDate: date("payment_date").notNull(),
    paymentMethod: text("payment_method").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    unallocatedAmount: numeric("unallocated_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    unallocatedTreatment: text("unallocated_treatment").notNull().default("advance"),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    partyNameSnapshot: text("party_name_snapshot").notNull(),
    partySnapshot: jsonb("party_snapshot"),
    cashBankAccountSnapshot: jsonb("cash_bank_account_snapshot"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("payments_business_id_idx").on(table.businessId),
    partyIndex: index("payments_party_id_idx").on(table.partyId),
    voucherIndex: index("payments_voucher_id_idx").on(table.voucherId),
    statusIndex: index("payments_status_idx").on(table.status),
    businessNumberUnique: uniqueIndex("payments_business_number_unique").on(
      table.businessId,
      table.paymentNumber
    ),
    businessIdentityUnique: uniqueIndex("payments_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "payments_party_business_fk",
    }),
    branchBusinessFk: foreignKey({
      columns: [table.branchId, table.businessId],
      foreignColumns: [businessBranches.id, businessBranches.businessId],
      name: "payments_branch_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "payments_gst_registration_business_fk",
    }),
    cashBankAccountBusinessFk: foreignKey({
      columns: [table.cashBankAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "payments_cash_bank_account_business_fk",
    }),
  })
)

export const bankStatementImports = pgTable(
  "bank_statement_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    cashBankAccountId: uuid("cash_bank_account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    fileName: text("file_name").notNull(),
    statementFrom: date("statement_from"),
    statementTo: date("statement_to"),
    importedBy: uuid("imported_by").references(() => users.id, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("bank_statement_imports_business_id_idx").on(
      table.businessId
    ),
    accountIndex: index("bank_statement_imports_account_id_idx").on(
      table.cashBankAccountId
    ),
    businessIdentityUnique: uniqueIndex(
      "bank_statement_imports_id_business_unique"
    ).on(table.id, table.businessId),
    accountBusinessFk: foreignKey({
      columns: [table.cashBankAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "bank_statement_imports_account_business_fk",
    }),
  })
)

export const bankStatementLines = pgTable(
  "bank_statement_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    importId: uuid("import_id").notNull(),
    cashBankAccountId: uuid("cash_bank_account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    statementDate: date("statement_date").notNull(),
    description: text("description").notNull().default(""),
    bankReference: text("bank_reference"),
    direction: text("direction").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    matchStatus: text("match_status").notNull().default("unmatched"),
    matchedReceiptId: uuid("matched_receipt_id").references(() => receipts.id, {
      onDelete: "set null",
    }),
    matchedPaymentId: uuid("matched_payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("bank_statement_lines_business_id_idx").on(table.businessId),
    importIndex: index("bank_statement_lines_import_id_idx").on(table.importId),
    accountIndex: index("bank_statement_lines_account_id_idx").on(
      table.cashBankAccountId
    ),
    statusIndex: index("bank_statement_lines_match_status_idx").on(table.matchStatus),
    businessIdentityUnique: uniqueIndex(
      "bank_statement_lines_id_business_unique"
    ).on(table.id, table.businessId),
    importBusinessFk: foreignKey({
      columns: [table.importId, table.businessId],
      foreignColumns: [bankStatementImports.id, bankStatementImports.businessId],
      name: "bank_statement_lines_import_business_fk",
    }),
    accountBusinessFk: foreignKey({
      columns: [table.cashBankAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "bank_statement_lines_account_business_fk",
    }),
    receiptBusinessFk: foreignKey({
      columns: [table.matchedReceiptId, table.businessId],
      foreignColumns: [receipts.id, receipts.businessId],
      name: "bank_statement_lines_receipt_business_fk",
    }),
    paymentBusinessFk: foreignKey({
      columns: [table.matchedPaymentId, table.businessId],
      foreignColumns: [payments.id, payments.businessId],
      name: "bank_statement_lines_payment_business_fk",
    }),
  })
)

export const bankReconciliationMatches = pgTable(
  "bank_reconciliation_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    receiptId: uuid("receipt_id").references(() => receipts.id, {
      onDelete: "cascade",
    }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "cascade",
    }),
    cashBankAccountId: uuid("cash_bank_account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    statementLineId: uuid("statement_line_id").references(() => bankStatementLines.id),
    statementDate: date("statement_date").notNull(),
    bankReference: text("bank_reference"),
    notes: text("notes"),
    reconciledBy: uuid("reconciled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("bank_reconciliation_matches_business_id_idx").on(
      table.businessId
    ),
    receiptIndex: index("bank_reconciliation_matches_receipt_id_idx").on(
      table.receiptId
    ),
    paymentIndex: index("bank_reconciliation_matches_payment_id_idx").on(
      table.paymentId
    ),
    accountIndex: index("bank_reconciliation_matches_account_id_idx").on(
      table.cashBankAccountId
    ),
    accountBusinessFk: foreignKey({
      columns: [table.cashBankAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "bank_reconciliation_matches_account_business_fk",
    }),
    statementLineBusinessFk: foreignKey({
      columns: [table.statementLineId, table.businessId],
      foreignColumns: [bankStatementLines.id, bankStatementLines.businessId],
      name: "bank_reconciliation_matches_statement_line_business_fk",
    }),
  })
)

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    partyId: uuid("party_id").references(() => parties.id, { onDelete: "set null" }),
    partySnapshot: jsonb("party_snapshot"),
    customerName: text("customer_name").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: text("invoice_date").notNull(),
    dueDate: text("due_date"),
    placeOfSupplyStateCode: text("place_of_supply_state_code"),
    supplyType: text("supply_type").notNull().default("b2c"),
    invoiceType: text("invoice_type").notNull().default("tax_invoice"),
    status: text("status").notNull().default("draft"),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    amountDue: numeric("amount_due", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("sales_invoices_business_id_idx").on(table.businessId),
    voucherIndex: index("sales_invoices_voucher_id_idx").on(table.voucherId),
    partyIndex: index("sales_invoices_party_id_idx").on(table.partyId),
    branchIndex: index("sales_invoices_branch_id_idx").on(table.branchId),
    businessNumberUnique: uniqueIndex("sales_invoices_business_number_unique").on(
      table.businessId,
      table.invoiceNumber
    ),
  })
)

export const salesInvoiceLines = pgTable(
  "sales_invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    hsnSacCode: text("hsn_sac_code"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit").notNull().default("PCS"),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    taxability: text("taxability").notNull().default("TAXABLE"),
    classification: text("classification"),
    supplyLocationTreatment: text("supply_location_treatment"),
    grossValue: numeric("gross_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxableCharges: numeric("taxable_charges", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    nonTaxableCharges: numeric("non_taxable_charges", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstRate: numeric("igst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessRuleId: text("cess_rule_id"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxRuleId: text("tax_rule_id"),
    taxRuleVersion: text("tax_rule_version").notNull().default("GSTFY_TAX_V1"),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    roundOff: numeric("round_off", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceIndex: index("sales_invoice_lines_invoice_id_idx").on(
      table.salesInvoiceId
    ),
    itemIndex: index("sales_invoice_lines_item_id_idx").on(table.itemId),
  })
)

export const salesInvoicePayments = pgTable(
  "sales_invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    paymentMode: text("payment_mode").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    referenceNumber: text("reference_number"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceIndex: index("sales_invoice_payments_invoice_id_idx").on(
      table.salesInvoiceId
    ),
  })
)

export const purchaseBills = pgTable(
  "purchase_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => parties.id, {
      onDelete: "set null",
    }),
    supplierSnapshot: jsonb("supplier_snapshot"),
    supplierName: text("supplier_name").notNull(),
    billNumber: text("bill_number").notNull(),
    supplierInvoiceNumber: text("supplier_invoice_number"),
    invoiceDate: text("invoice_date").notNull(),
    billDate: text("bill_date").notNull(),
    deliveryNoteNumber: text("delivery_note_number"),
    buyerOrderNumber: text("buyer_order_number"),
    buyerOrderDate: text("buyer_order_date"),
    dispatchDocumentNumber: text("dispatch_document_number"),
    deliveryNoteDate: text("delivery_note_date"),
    dispatchedThrough: text("dispatched_through"),
    destination: text("destination"),
    termsOfDelivery: text("terms_of_delivery"),
    placeOfSupplyStateCode: text("place_of_supply_state_code"),
    purchaseType: text("purchase_type").notNull().default("goods"),
    status: text("status").notNull().default("draft"),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    amountDue: numeric("amount_due", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    itcEligibleAmount: numeric("itc_eligible_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("purchase_bills_business_id_idx").on(table.businessId),
    voucherIndex: index("purchase_bills_voucher_id_idx").on(table.voucherId),
    supplierIndex: index("purchase_bills_supplier_id_idx").on(table.supplierId),
    branchIndex: index("purchase_bills_branch_id_idx").on(table.branchId),
    businessNumberUnique: uniqueIndex("purchase_bills_business_number_unique").on(
      table.businessId,
      table.billNumber
    ),
  })
)

export const purchaseBillLines = pgTable(
  "purchase_bill_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    purchaseBillId: uuid("purchase_bill_id")
      .notNull()
      .references(() => purchaseBills.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    hsnSacCode: text("hsn_sac_code"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit").notNull().default("PCS"),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    taxability: text("taxability").notNull().default("TAXABLE"),
    classification: text("classification"),
    supplyLocationTreatment: text("supply_location_treatment"),
    grossValue: numeric("gross_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxableCharges: numeric("taxable_charges", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    nonTaxableCharges: numeric("non_taxable_charges", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstRate: numeric("igst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessRuleId: text("cess_rule_id"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxRuleId: text("tax_rule_id"),
    taxRuleVersion: text("tax_rule_version").notNull().default("GSTFY_TAX_V1"),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    roundOff: numeric("round_off", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    itcEligible: boolean("itc_eligible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    billIndex: index("purchase_bill_lines_bill_id_idx").on(table.purchaseBillId),
    itemIndex: index("purchase_bill_lines_item_id_idx").on(table.itemId),
  })
)

export const purchaseBillPayments = pgTable(
  "purchase_bill_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    purchaseBillId: uuid("purchase_bill_id")
      .notNull()
      .references(() => purchaseBills.id, { onDelete: "cascade" }),
    paymentMode: text("payment_mode").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    referenceNumber: text("reference_number"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    billIndex: index("purchase_bill_payments_bill_id_idx").on(table.purchaseBillId),
  })
)

export const adjustmentDocuments = pgTable(
  "adjustment_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    adjustmentNumber: text("adjustment_number").notNull(),
    adjustmentType: text("adjustment_type").notNull(),
    originalVoucherId: uuid("original_voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id"),
    sourceDocumentType: text("source_document_type").notNull(),
    partyId: uuid("party_id").references(() => parties.id, { onDelete: "set null" }),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    adjustmentDate: date("adjustment_date").notNull(),
    reasonCode: text("reason_code"),
    reason: text("reason"),
    status: text("status").notNull().default("draft"),
    issuerType: text("issuer_type").notNull().default("GSTFY_BUSINESS"),
    documentDirection: text("document_direction").notNull().default("outgoing"),
    sourcePartyRole: text("source_party_role").notNull(),
    adjustmentContext: text("adjustment_context").notNull().default("goods_related"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxableTotal: numeric("taxable_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstTotal: numeric("cgst_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstTotal: numeric("sgst_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstTotal: numeric("igst_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessTotal: numeric("cess_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    roundOff: numeric("round_off", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    settlementEffectAmount: numeric("settlement_effect_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    excessCreditAmount: numeric("excess_credit_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    partySnapshot: jsonb("party_snapshot"),
    sourceSnapshot: jsonb("source_snapshot"),
    taxSnapshot: jsonb("tax_snapshot"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    reversedBy: uuid("reversed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("adjustment_documents_business_id_idx").on(
      table.businessId
    ),
    typeStatusIndex: index("adjustment_documents_type_status_idx").on(
      table.businessId,
      table.adjustmentType,
      table.status
    ),
    originalVoucherIndex: index("adjustment_documents_original_voucher_idx").on(
      table.businessId,
      table.originalVoucherId
    ),
    businessNumberUnique: uniqueIndex(
      "adjustment_documents_business_number_unique"
    ).on(table.businessId, table.adjustmentNumber),
    businessIdentityUnique: uniqueIndex(
      "adjustment_documents_id_business_id_unique"
    ).on(table.id, table.businessId),
    voucherBusinessFk: foreignKey({
      columns: [table.voucherId, table.businessId],
      foreignColumns: [vouchers.id, vouchers.businessId],
      name: "adjustment_documents_voucher_business_fk",
    }),
    originalVoucherBusinessFk: foreignKey({
      columns: [table.originalVoucherId, table.businessId],
      foreignColumns: [vouchers.id, vouchers.businessId],
      name: "adjustment_documents_original_voucher_business_fk",
    }),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "adjustment_documents_party_business_fk",
    }),
    branchBusinessFk: foreignKey({
      columns: [table.branchId, table.businessId],
      foreignColumns: [businessBranches.id, businessBranches.businessId],
      name: "adjustment_documents_branch_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "adjustment_documents_gst_registration_business_fk",
    }),
  })
)

export const adjustmentDocumentLines = pgTable(
  "adjustment_document_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    adjustmentDocumentId: uuid("adjustment_document_id")
      .notNull()
      .references(() => adjustmentDocuments.id, { onDelete: "cascade" }),
    originalLineId: uuid("original_line_id"),
    originalLineType: text("original_line_type"),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    descriptionSnapshot: text("description_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    hsnSacSnapshot: text("hsn_sac_snapshot"),
    uqcSnapshot: text("uqc_snapshot"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    unit: text("unit").notNull().default("PCS"),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxProfileSnapshot: jsonb("tax_profile_snapshot"),
    gstRateSnapshot: numeric("gst_rate_snapshot", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    igstRate: numeric("igst_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    cessRuleSnapshot: jsonb("cess_rule_snapshot"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    inventoryEffect: text("inventory_effect").notNull().default("NONE"),
    inventoryWarehouseId: uuid("inventory_warehouse_id").references(
      () => warehouses.id,
      { onDelete: "set null" }
    ),
    batchId: text("batch_id"),
    serialId: text("serial_id"),
    reason: text("reason"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentIndex: index("adjustment_document_lines_document_id_idx").on(
      table.adjustmentDocumentId
    ),
    originalLineIndex: index("adjustment_document_lines_original_line_idx").on(
      table.businessId,
      table.originalLineId,
      table.originalLineType
    ),
    documentBusinessFk: foreignKey({
      columns: [table.adjustmentDocumentId, table.businessId],
      foreignColumns: [adjustmentDocuments.id, adjustmentDocuments.businessId],
      name: "adjustment_document_lines_document_business_fk",
    }),
    itemBusinessFk: foreignKey({
      columns: [table.itemId, table.businessId],
      foreignColumns: [items.id, items.businessId],
      name: "adjustment_document_lines_item_business_fk",
    }),
    warehouseBusinessFk: foreignKey({
      columns: [table.inventoryWarehouseId, table.businessId],
      foreignColumns: [warehouses.id, warehouses.businessId],
      name: "adjustment_document_lines_warehouse_business_fk",
    }),
  })
)

export const receivablePayableAdjustmentEffects = pgTable(
  "receivable_payable_adjustment_effects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    adjustmentDocumentId: uuid("adjustment_document_id")
      .notNull()
      .references(() => adjustmentDocuments.id, { onDelete: "restrict" }),
    adjustmentVoucherId: uuid("adjustment_voucher_id").references(
      () => vouchers.id,
      { onDelete: "restrict" }
    ),
    sourceVoucherId: uuid("source_voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "restrict" }),
    receivablePayableEntryId: uuid("receivable_payable_entry_id")
      .notNull()
      .references(() => receivablePayableEntries.id, { onDelete: "restrict" }),
    effectKind: text("effect_kind").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("rp_adjustment_effects_business_id_idx").on(
      table.businessId
    ),
    adjustmentDocumentIndex: index(
      "rp_adjustment_effects_adjustment_document_id_idx"
    ).on(table.adjustmentDocumentId),
    targetEntryIndex: index("rp_adjustment_effects_target_entry_id_idx").on(
      table.receivablePayableEntryId
    ),
    documentBusinessFk: foreignKey({
      columns: [table.adjustmentDocumentId, table.businessId],
      foreignColumns: [adjustmentDocuments.id, adjustmentDocuments.businessId],
      name: "rp_adjustment_effects_document_business_fk",
    }),
    adjustmentVoucherBusinessFk: foreignKey({
      columns: [table.adjustmentVoucherId, table.businessId],
      foreignColumns: [vouchers.id, vouchers.businessId],
      name: "rp_adjustment_effects_adjustment_voucher_business_fk",
    }),
    sourceVoucherBusinessFk: foreignKey({
      columns: [table.sourceVoucherId, table.businessId],
      foreignColumns: [vouchers.id, vouchers.businessId],
      name: "rp_adjustment_effects_source_voucher_business_fk",
    }),
    targetEntryBusinessFk: foreignKey({
      columns: [table.receivablePayableEntryId, table.businessId],
      foreignColumns: [receivablePayableEntries.id, receivablePayableEntries.businessId],
      name: "rp_adjustment_effects_target_entry_business_fk",
    }),
  })
)

export const purchaseTaxRecords = pgTable(
  "purchase_tax_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    purchaseBillId: uuid("purchase_bill_id").references(() => purchaseBills.id, {
      onDelete: "restrict",
    }),
    adjustmentDocumentId: uuid("adjustment_document_id").references(
      () => adjustmentDocuments.id,
      { onDelete: "restrict" }
    ),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id").references(() => parties.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    supplierName: text("supplier_name").notNull().default(""),
    supplierGstin: text("supplier_gstin"),
    invoiceNumber: text("invoice_number").notNull(),
    normalizedInvoiceNumber: text("normalized_invoice_number").notNull(),
    invoiceDate: date("invoice_date").notNull(),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgst: numeric("cgst", { precision: 14, scale: 2 }).notNull().default("0"),
    sgst: numeric("sgst", { precision: 14, scale: 2 }).notNull().default("0"),
    igst: numeric("igst", { precision: 14, scale: 2 }).notNull().default("0"),
    cess: numeric("cess", { precision: 14, scale: 2 }).notNull().default("0"),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxPeriod: text("tax_period").notNull(),
    reconciliationStatus: text("reconciliation_status")
      .notNull()
      .default("NOT_MATCHED"),
    itcStatus: text("itc_status").notNull().default("NOT_REVIEWED"),
    eligibleCgst: numeric("eligible_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    eligibleSgst: numeric("eligible_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    eligibleIgst: numeric("eligible_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    eligibleCess: numeric("eligible_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleCgst: numeric("ineligible_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleSgst: numeric("ineligible_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleIgst: numeric("ineligible_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleCess: numeric("ineligible_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredCgst: numeric("deferred_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredSgst: numeric("deferred_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredIgst: numeric("deferred_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredCess: numeric("deferred_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    inputType: text("input_type").notNull().default("regular"),
    sourceSnapshot: jsonb("source_snapshot").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("purchase_tax_records_business_id_idx").on(
      table.businessId
    ),
    periodIndex: index("purchase_tax_records_business_period_idx").on(
      table.businessId,
      table.taxPeriod
    ),
    reconciliationStatusIndex: index(
      "purchase_tax_records_reconciliation_status_idx"
    ).on(table.reconciliationStatus),
    itcStatusIndex: index("purchase_tax_records_itc_status_idx").on(
      table.itcStatus
    ),
    normalizedMatchIndex: index("purchase_tax_records_normalized_match_idx").on(
      table.businessId,
      table.gstRegistrationId,
      table.supplierGstin,
      table.normalizedInvoiceNumber,
      table.invoiceDate
    ),
    businessIdentityUnique: uniqueIndex(
      "purchase_tax_records_id_business_unique"
    ).on(table.id, table.businessId),
    purchaseBusinessFk: foreignKey({
      columns: [table.purchaseBillId, table.businessId],
      foreignColumns: [purchaseBills.id, purchaseBills.businessId],
      name: "purchase_tax_records_purchase_business_fk",
    }),
    adjustmentBusinessFk: foreignKey({
      columns: [table.adjustmentDocumentId, table.businessId],
      foreignColumns: [adjustmentDocuments.id, adjustmentDocuments.businessId],
      name: "purchase_tax_records_adjustment_business_fk",
    }),
    voucherBusinessFk: foreignKey({
      columns: [table.voucherId, table.businessId],
      foreignColumns: [vouchers.id, vouchers.businessId],
      name: "purchase_tax_records_voucher_business_fk",
    }),
    supplierBusinessFk: foreignKey({
      columns: [table.supplierId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "purchase_tax_records_supplier_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "purchase_tax_records_gst_registration_business_fk",
    }),
    branchBusinessFk: foreignKey({
      columns: [table.branchId, table.businessId],
      foreignColumns: [businessBranches.id, businessBranches.businessId],
      name: "purchase_tax_records_branch_business_fk",
    }),
  })
)

export const externalGstImports = pgTable(
  "external_gst_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    period: text("period").notNull(),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    fileName: text("file_name").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    importedBy: uuid("imported_by").references(() => users.id, {
      onDelete: "set null",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("imported"),
    rawMetadata: jsonb("raw_metadata").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    businessPeriodIndex: index("external_gst_imports_business_period_idx").on(
      table.businessId,
      table.period
    ),
    businessIdentityUnique: uniqueIndex(
      "external_gst_imports_id_business_unique"
    ).on(table.id, table.businessId),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "external_gst_imports_gst_registration_business_fk",
    }),
  })
)

export const externalGstRecords = pgTable(
  "external_gst_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    importId: uuid("import_id").notNull(),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    supplierGstin: text("supplier_gstin").notNull(),
    supplierName: text("supplier_name"),
    documentNumber: text("document_number").notNull(),
    normalizedDocumentNumber: text("normalized_document_number").notNull(),
    documentDate: date("document_date").notNull(),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgst: numeric("cgst", { precision: 14, scale: 2 }).notNull().default("0"),
    sgst: numeric("sgst", { precision: 14, scale: 2 }).notNull().default("0"),
    igst: numeric("igst", { precision: 14, scale: 2 }).notNull().default("0"),
    cess: numeric("cess", { precision: 14, scale: 2 }).notNull().default("0"),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    period: text("period").notNull(),
    source: text("source").notNull().default("gstr_2b"),
    status: text("status").notNull().default("available"),
    rawReference: jsonb("raw_reference").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    businessPeriodIndex: index("external_gst_records_business_period_idx").on(
      table.businessId,
      table.period
    ),
    matchKeyIndex: index("external_gst_records_match_key_idx").on(
      table.businessId,
      table.supplierGstin,
      table.documentNumber,
      table.documentDate
    ),
    normalizedMatchIndex: index("external_gst_records_normalized_match_idx").on(
      table.businessId,
      table.gstRegistrationId,
      table.supplierGstin,
      table.normalizedDocumentNumber,
      table.documentDate
    ),
    duplicateReviewIndex: index("external_gst_records_duplicate_review_idx").on(
      table.businessId,
      table.gstRegistrationId,
      table.source,
      table.period,
      table.supplierGstin,
      table.normalizedDocumentNumber,
      table.documentDate,
      table.taxableValue,
      table.totalTax
    ),
    businessIdentityUnique: uniqueIndex(
      "external_gst_records_id_business_unique"
    ).on(table.id, table.businessId),
    importBusinessFk: foreignKey({
      columns: [table.importId, table.businessId],
      foreignColumns: [externalGstImports.id, externalGstImports.businessId],
      name: "external_gst_records_import_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "external_gst_records_gst_registration_business_fk",
    }),
  })
)

export const gstReconciliationMatches = pgTable(
  "gst_reconciliation_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    purchaseTaxRecordId: uuid("purchase_tax_record_id").notNull(),
    externalGstRecordId: uuid("external_gst_record_id").notNull(),
    matchStatus: text("match_status").notNull(),
    matchConfidence: text("match_confidence").notNull(),
    taxableDifference: numeric("taxable_difference", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstDifference: numeric("cgst_difference", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstDifference: numeric("sgst_difference", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstDifference: numeric("igst_difference", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessDifference: numeric("cess_difference", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    matchedBy: uuid("matched_by").references(() => users.id, {
      onDelete: "set null",
    }),
    matchedAt: timestamp("matched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    manualOverride: boolean("manual_override").notNull().default(false),
    reason: text("reason"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessStatusIndex: index("gst_reconciliation_matches_business_status_idx").on(
      table.businessId,
      table.matchStatus
    ),
    businessIdentityUnique: uniqueIndex(
      "gst_reconciliation_matches_id_business_unique"
    ).on(table.id, table.businessId),
    taxRecordBusinessFk: foreignKey({
      columns: [table.purchaseTaxRecordId, table.businessId],
      foreignColumns: [purchaseTaxRecords.id, purchaseTaxRecords.businessId],
      name: "gst_reconciliation_matches_tax_record_business_fk",
    }),
    externalRecordBusinessFk: foreignKey({
      columns: [table.externalGstRecordId, table.businessId],
      foreignColumns: [externalGstRecords.id, externalGstRecords.businessId],
      name: "gst_reconciliation_matches_external_record_business_fk",
    }),
  })
)

export const gstReconciliationExceptions = pgTable(
  "gst_reconciliation_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    matchId: uuid("match_id"),
    purchaseTaxRecordId: uuid("purchase_tax_record_id"),
    externalGstRecordId: uuid("external_gst_record_id"),
    exceptionType: text("exception_type").notNull(),
    severity: text("severity").notNull().default("MEDIUM"),
    status: text("status").notNull().default("OPEN"),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    businessStatusIndex: index(
      "gst_reconciliation_exceptions_business_status_idx"
    ).on(table.businessId, table.status),
    businessIdentityUnique: uniqueIndex(
      "gst_reconciliation_exceptions_id_business_unique"
    ).on(table.id, table.businessId),
    matchBusinessFk: foreignKey({
      columns: [table.matchId, table.businessId],
      foreignColumns: [gstReconciliationMatches.id, gstReconciliationMatches.businessId],
      name: "gst_reconciliation_exceptions_match_business_fk",
    }),
    taxRecordBusinessFk: foreignKey({
      columns: [table.purchaseTaxRecordId, table.businessId],
      foreignColumns: [purchaseTaxRecords.id, purchaseTaxRecords.businessId],
      name: "gst_reconciliation_exceptions_tax_record_business_fk",
    }),
    externalRecordBusinessFk: foreignKey({
      columns: [table.externalGstRecordId, table.businessId],
      foreignColumns: [externalGstRecords.id, externalGstRecords.businessId],
      name: "gst_reconciliation_exceptions_external_record_business_fk",
    }),
  })
)

export const itcClaims = pgTable(
  "itc_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    purchaseTaxRecordId: uuid("purchase_tax_record_id").notNull(),
    claimPeriod: text("claim_period").notNull(),
    claimedCgst: numeric("claimed_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    claimedSgst: numeric("claimed_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    claimedIgst: numeric("claimed_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    claimedCess: numeric("claimed_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sourceTaxRecord: jsonb("source_tax_record").notNull().default({}),
    status: text("status").notNull().default("active"),
    claimedBy: uuid("claimed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reversedBy: uuid("reversed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    ...timestamps,
  },
  (table) => ({
    businessPeriodIndex: index("itc_claims_business_period_idx").on(
      table.businessId,
      table.claimPeriod
    ),
    businessIdentityUnique: uniqueIndex("itc_claims_id_business_unique").on(
      table.id,
      table.businessId
    ),
    taxRecordBusinessFk: foreignKey({
      columns: [table.purchaseTaxRecordId, table.businessId],
      foreignColumns: [purchaseTaxRecords.id, purchaseTaxRecords.businessId],
      name: "itc_claims_tax_record_business_fk",
    }),
  })
)

export const itcStatusEvents = pgTable(
  "itc_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    purchaseTaxRecordId: uuid("purchase_tax_record_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    previousEligibleCgst: numeric("previous_eligible_cgst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousEligibleSgst: numeric("previous_eligible_sgst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousEligibleIgst: numeric("previous_eligible_igst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousEligibleCess: numeric("previous_eligible_cess", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousIneligibleCgst: numeric("previous_ineligible_cgst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousIneligibleSgst: numeric("previous_ineligible_sgst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousIneligibleIgst: numeric("previous_ineligible_igst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousIneligibleCess: numeric("previous_ineligible_cess", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousDeferredCgst: numeric("previous_deferred_cgst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousDeferredSgst: numeric("previous_deferred_sgst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousDeferredIgst: numeric("previous_deferred_igst", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    previousDeferredCess: numeric("previous_deferred_cess", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    eligibleCgst: numeric("eligible_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    eligibleSgst: numeric("eligible_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    eligibleIgst: numeric("eligible_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    eligibleCess: numeric("eligible_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleCgst: numeric("ineligible_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleSgst: numeric("ineligible_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleIgst: numeric("ineligible_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    ineligibleCess: numeric("ineligible_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredCgst: numeric("deferred_cgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredSgst: numeric("deferred_sgst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredIgst: numeric("deferred_igst", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deferredCess: numeric("deferred_cess", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    reason: text("reason"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessRecordIndex: index("itc_status_events_business_record_idx").on(
      table.businessId,
      table.purchaseTaxRecordId
    ),
    taxRecordBusinessFk: foreignKey({
      columns: [table.purchaseTaxRecordId, table.businessId],
      foreignColumns: [purchaseTaxRecords.id, purchaseTaxRecords.businessId],
      name: "itc_status_events_tax_record_business_fk",
    }),
  })
)

export const gstReconciliationIdempotencyKeys = pgTable(
  "gst_reconciliation_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    operationScope: text("operation_scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: jsonb("response_body"),
    status: text("status").notNull().default("completed"),
    ...timestamps,
  },
  (table) => ({
    businessScopeKeyUnique: uniqueIndex(
      "gst_reconciliation_idempotency_keys_business_scope_key_unique"
    ).on(table.businessId, table.operationScope, table.idempotencyKey),
  })
)

export const gstReportingRuns = pgTable(
  "gst_reporting_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id, { onDelete: "restrict" }),
    gstinSnapshot: text("gstin_snapshot"),
    period: text("period").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("DRAFT"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    sourceVersion: text("source_version").notNull().default("GSTFY_REPORTING_V1"),
    sourceDataHash: text("source_data_hash"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvalComment: text("approval_comment"),
    readyForSubmissionAt: timestamp("ready_for_submission_at", { withTimezone: true }),
    readyForSubmissionBy: uuid("ready_for_submission_by").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    filedBy: uuid("filed_by").references(() => users.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: uuid("locked_by").references(() => users.id, { onDelete: "set null" }),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    reopenedBy: uuid("reopened_by").references(() => users.id, { onDelete: "set null" }),
    reopenReason: text("reopen_reason"),
    summary: jsonb("summary").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    businessStatusIndex: index("gst_reporting_runs_business_status_idx").on(
      table.businessId,
      table.status
    ),
    businessGstinPeriodVersionUnique: uniqueIndex(
      "gst_reporting_runs_business_gstin_period_version_unique"
    ).on(table.businessId, table.gstRegistrationId, table.period, table.version),
    businessIdentityPeriodUnique: uniqueIndex(
      "gst_reporting_runs_id_business_gstin_period_unique"
    ).on(table.id, table.businessId, table.gstRegistrationId, table.period),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "gst_reporting_runs_gst_registration_business_fk",
    }),
  })
)

export const gstReportingFacts = pgTable(
  "gst_reporting_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => gstReportingRuns.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id, { onDelete: "restrict" }),
    gstinSnapshot: text("gstin_snapshot"),
    period: text("period").notNull(),
    sourceVoucherId: uuid("source_voucher_id"),
    sourceDocumentId: uuid("source_document_id"),
    sourceDocumentType: text("source_document_type").notNull(),
    sourceDocumentNumber: text("source_document_number").notNull(),
    sourceDocumentDate: date("source_document_date").notNull(),
    sourceLineId: uuid("source_line_id"),
    partyId: uuid("party_id"),
    partyName: text("party_name"),
    partyGstin: text("party_gstin"),
    placeOfSupplyStateCode: text("place_of_supply_state_code"),
    placeOfSupplyState: text("place_of_supply_state"),
    classification: text("classification").notNull(),
    hsnSac: text("hsn_sac"),
    description: text("description"),
    uqc: text("uqc"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgst: numeric("cgst", { precision: 14, scale: 2 }).notNull().default("0"),
    sgst: numeric("sgst", { precision: 14, scale: 2 }).notNull().default("0"),
    igst: numeric("igst", { precision: 14, scale: 2 }).notNull().default("0"),
    cess: numeric("cess", { precision: 14, scale: 2 }).notNull().default("0"),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }).notNull().default("0"),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    itcCategory: text("itc_category"),
    reportingStatus: text("reporting_status").notNull().default("included"),
    sourceSnapshot: jsonb("source_snapshot").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIndex: index("gst_reporting_facts_run_idx").on(table.runId),
    businessPeriodIndex: index("gst_reporting_facts_business_period_idx").on(
      table.businessId,
      table.gstRegistrationId,
      table.period
    ),
    classificationIndex: index("gst_reporting_facts_classification_idx").on(
      table.businessId,
      table.gstRegistrationId,
      table.period,
      table.classification
    ),
    sourceIndex: index("gst_reporting_facts_source_idx").on(
      table.businessId,
      table.sourceDocumentType,
      table.sourceDocumentId
    ),
    businessIdentityUnique: uniqueIndex("gst_reporting_facts_id_business_unique").on(
      table.id,
      table.businessId
    ),
    sourceLineUnique: uniqueIndex("gst_reporting_facts_source_line_unique")
      .on(table.runId, table.sourceDocumentType, table.sourceLineId)
      .where(sql`${table.sourceLineId} is not null`),
    runBusinessFk: foreignKey({
      columns: [
        table.runId,
        table.businessId,
        table.gstRegistrationId,
        table.period,
      ],
      foreignColumns: [
        gstReportingRuns.id,
        gstReportingRuns.businessId,
        gstReportingRuns.gstRegistrationId,
        gstReportingRuns.period,
      ],
      name: "gst_reporting_facts_run_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "gst_reporting_facts_gst_registration_business_fk",
    }),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "gst_reporting_facts_party_business_fk",
    }),
    voucherBusinessFk: foreignKey({
      columns: [table.sourceVoucherId, table.businessId],
      foreignColumns: [vouchers.id, vouchers.businessId],
      name: "gst_reporting_facts_voucher_business_fk",
    }),
  })
)

export const gstReportingExceptions = pgTable(
  "gst_reporting_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => gstReportingRuns.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id, { onDelete: "restrict" }),
    gstinSnapshot: text("gstin_snapshot"),
    period: text("period").notNull(),
    factId: uuid("fact_id"),
    sourceDocumentType: text("source_document_type"),
    sourceDocumentId: uuid("source_document_id"),
    exceptionType: text("exception_type").notNull(),
    severity: text("severity").notNull().default("MEDIUM"),
    status: text("status").notNull().default("OPEN"),
    message: text("message").notNull(),
    recommendation: text("recommendation"),
    isBlocking: boolean("is_blocking").notNull().default(false),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    ...timestamps,
  },
  (table) => ({
    runIndex: index("gst_reporting_exceptions_run_idx").on(table.runId),
    businessStatusIndex: index("gst_reporting_exceptions_status_idx").on(
      table.businessId,
      table.status,
      table.severity
    ),
    runBusinessFk: foreignKey({
      columns: [
        table.runId,
        table.businessId,
        table.gstRegistrationId,
        table.period,
      ],
      foreignColumns: [
        gstReportingRuns.id,
        gstReportingRuns.businessId,
        gstReportingRuns.gstRegistrationId,
        gstReportingRuns.period,
      ],
      name: "gst_reporting_exceptions_run_business_fk",
    }),
    factBusinessFk: foreignKey({
      columns: [table.factId, table.businessId],
      foreignColumns: [gstReportingFacts.id, gstReportingFacts.businessId],
      name: "gst_reporting_exceptions_fact_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "gst_reporting_exceptions_gst_registration_business_fk",
    }),
  })
)

export const gstReportingExports = pgTable(
  "gst_reporting_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => gstReportingRuns.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id, { onDelete: "restrict" }),
    gstinSnapshot: text("gstin_snapshot"),
    period: text("period").notNull(),
    reportType: text("report_type").notNull(),
    exportFormat: text("export_format").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    contentHash: text("content_hash").notNull(),
    exportedBy: uuid("exported_by").references(() => users.id, { onDelete: "set null" }),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    runIndex: index("gst_reporting_exports_run_idx").on(table.runId),
    runBusinessFk: foreignKey({
      columns: [
        table.runId,
        table.businessId,
        table.gstRegistrationId,
        table.period,
      ],
      foreignColumns: [
        gstReportingRuns.id,
        gstReportingRuns.businessId,
        gstReportingRuns.gstRegistrationId,
        gstReportingRuns.period,
      ],
      name: "gst_reporting_exports_run_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "gst_reporting_exports_gst_registration_business_fk",
    }),
  })
)

export const gstReportingIdempotencyKeys = pgTable(
  "gst_reporting_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    operationScope: text("operation_scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: jsonb("response_body"),
    status: text("status").notNull().default("completed"),
    ...timestamps,
  },
  (table) => ({
    businessScopeKeyUnique: uniqueIndex(
      "gst_reporting_idempotency_keys_business_scope_key_unique"
    ).on(table.businessId, table.operationScope, table.idempotencyKey),
  })
)

export const gstFilingRuns = pgTable(
  "gst_filing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id, { onDelete: "restrict" }),
    reportingRunId: uuid("reporting_run_id")
      .notNull()
      .references(() => gstReportingRuns.id, { onDelete: "restrict" }),
    returnType: text("return_type").notNull(),
    period: text("period").notNull(),
    status: text("status").notNull().default("DRAFT"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    adapterName: text("adapter_name").notNull().default("mock"),
    adapterMode: text("adapter_mode"),
    schemaVersion: text("schema_version"),
    payloadHash: text("payload_hash"),
    validationResult: jsonb("validation_result").notNull().default({}),
    externalReference: text("external_reference"),
    acknowledgementNumber: text("acknowledgement_number"),
    acknowledgementDate: timestamp("acknowledgement_date", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    rawExternalResponse: jsonb("raw_external_response"),
    externalResponseReceivedAt: timestamp("external_response_received_at", { withTimezone: true }),
    acknowledgementArtifactId: text("acknowledgement_artifact_id"),
    correctionRequiredAt: timestamp("correction_required_at", { withTimezone: true }),
    correctionReason: text("correction_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    reportingReturnAttemptUnique: uniqueIndex(
      "gst_filing_runs_reporting_return_attempt_unique"
    ).on(table.businessId, table.reportingRunId, table.returnType, table.attemptNumber),
    businessPeriodIndex: index("gst_filing_runs_business_period_idx").on(
      table.businessId,
      table.gstRegistrationId,
      table.period,
      table.returnType
    ),
    businessStatusIndex: index("gst_filing_runs_business_status_idx").on(
      table.businessId,
      table.status
    ),
    idBusinessReturnUnique: uniqueIndex("gst_filing_runs_id_business_return_unique").on(
      table.id,
      table.businessId,
      table.returnType
    ),
    idBusinessUnique: uniqueIndex("gst_filing_runs_id_business_unique").on(
      table.id,
      table.businessId
    ),
    reportingRunBusinessFk: foreignKey({
      columns: [
        table.reportingRunId,
        table.businessId,
        table.gstRegistrationId,
        table.period,
      ],
      foreignColumns: [
        gstReportingRuns.id,
        gstReportingRuns.businessId,
        gstReportingRuns.gstRegistrationId,
        gstReportingRuns.period,
      ],
      name: "gst_filing_runs_reporting_run_business_fk",
    }),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "gst_filing_runs_gst_registration_business_fk",
    }),
  })
)

export const gstFilingPayloads = pgTable(
  "gst_filing_payloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingRunId: uuid("filing_run_id")
      .notNull()
      .references(() => gstFilingRuns.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    reportingRunId: uuid("reporting_run_id")
      .notNull()
      .references(() => gstReportingRuns.id, { onDelete: "restrict" }),
    returnType: text("return_type").notNull(),
    payloadType: text("payload_type").notNull(),
    schemaVersion: text("schema_version").notNull(),
    contentHash: text("content_hash").notNull(),
    payload: jsonb("payload").notNull(),
    generatedBy: uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    runTypeUnique: uniqueIndex("gst_filing_payloads_run_type_unique").on(
      table.filingRunId,
      table.payloadType
    ),
    businessRunIndex: index("gst_filing_payloads_business_run_idx").on(
      table.businessId,
      table.filingRunId
    ),
    runBusinessFk: foreignKey({
      columns: [table.filingRunId, table.businessId, table.returnType],
      foreignColumns: [
        gstFilingRuns.id,
        gstFilingRuns.businessId,
        gstFilingRuns.returnType,
      ],
      name: "gst_filing_payloads_run_business_fk",
    }),
  })
)

export const gstFilingStatusEvents = pgTable(
  "gst_filing_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filingRunId: uuid("filing_run_id")
      .notNull()
      .references(() => gstFilingRuns.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status"),
    status: text("status").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message"),
    externalReference: text("external_reference"),
    rawResponse: jsonb("raw_response"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIndex: index("gst_filing_status_events_run_idx").on(
      table.filingRunId,
      table.createdAt
    ),
    runBusinessFk: foreignKey({
      columns: [table.filingRunId, table.businessId],
      foreignColumns: [gstFilingRuns.id, gstFilingRuns.businessId],
      name: "gst_filing_status_events_run_business_fk",
    }),
  })
)

export const gstFilingIdempotencyKeys = pgTable(
  "gst_filing_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    operationScope: text("operation_scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: jsonb("response_body"),
    status: text("status").notNull().default("completed"),
    ...timestamps,
  },
  (table) => ({
    businessScopeKeyUnique: uniqueIndex(
      "gst_filing_idempotency_keys_business_scope_key_unique"
    ).on(table.businessId, table.operationScope, table.idempotencyKey),
  })
)

export const eInvoiceRecords = pgTable(
  "e_invoice_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id")
      .notNull()
      .references(() => gstRegistrations.id, { onDelete: "restrict" }),
    sourceDocumentType: text("source_document_type").notNull(),
    sourceDocumentId: uuid("source_document_id").notNull(),
    sourceSalesInvoiceId: uuid("source_sales_invoice_id").references(
      () => salesInvoices.id,
      { onDelete: "restrict" }
    ),
    sourceAdjustmentDocumentId: uuid("source_adjustment_document_id").references(
      () => adjustmentDocuments.id,
      { onDelete: "restrict" }
    ),
    sourceVoucherId: uuid("source_voucher_id").references(() => vouchers.id, {
      onDelete: "restrict",
    }),
    sourceDocumentNumber: text("source_document_number").notNull(),
    documentDate: date("document_date").notNull(),
    partyId: uuid("party_id").references(() => parties.id, { onDelete: "set null" }),
    partyGstin: text("party_gstin"),
    eligibilityStatus: text("eligibility_status").notNull().default("ELIGIBLE"),
    submissionStatus: text("submission_status").notNull().default("ELIGIBLE"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    providerName: text("provider_name").notNull().default("mock"),
    providerMode: text("provider_mode"),
    providerReference: text("provider_reference"),
    payloadSchemaVersion: text("payload_schema_version"),
    payloadHash: text("payload_hash"),
    irn: text("irn"),
    ackNumber: text("ack_number"),
    ackDate: timestamp("ack_date", { withTimezone: true }),
    signedInvoiceReference: text("signed_invoice_reference"),
    signedQrCode: text("signed_qr_code"),
    rawResponseReference: text("raw_response_reference"),
    validationResult: jsonb("validation_result").notNull().default({}),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    rawExternalResponse: jsonb("raw_external_response"),
    externalResponseReceivedAt: timestamp("external_response_received_at", {
      withTimezone: true,
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    sourceUnique: uniqueIndex("e_invoice_records_business_source_unique").on(
      table.businessId,
      table.sourceDocumentType,
      table.sourceDocumentId
    ),
    businessIrnUnique: uniqueIndex("e_invoice_records_business_irn_unique").on(
      table.businessId,
      table.irn
    ),
    businessIdentityUnique: uniqueIndex(
      "e_invoice_records_id_business_id_unique"
    ).on(table.id, table.businessId),
    businessStatusIndex: index("e_invoice_records_business_status_idx").on(
      table.businessId,
      table.submissionStatus
    ),
    businessDateIndex: index("e_invoice_records_business_date_idx").on(
      table.businessId,
      table.documentDate
    ),
    gstRegistrationBusinessFk: foreignKey({
      columns: [table.gstRegistrationId, table.businessId],
      foreignColumns: [gstRegistrations.id, gstRegistrations.businessId],
      name: "e_invoice_records_gst_registration_business_fk",
    }),
    salesInvoiceBusinessFk: foreignKey({
      columns: [table.sourceSalesInvoiceId, table.businessId],
      foreignColumns: [salesInvoices.id, salesInvoices.businessId],
      name: "e_invoice_records_sales_invoice_business_fk",
    }),
    adjustmentDocumentBusinessFk: foreignKey({
      columns: [table.sourceAdjustmentDocumentId, table.businessId],
      foreignColumns: [adjustmentDocuments.id, adjustmentDocuments.businessId],
      name: "e_invoice_records_adjustment_document_business_fk",
    }),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "e_invoice_records_party_business_fk",
    }).onDelete("restrict"),
  })
)

export const eInvoicePayloads = pgTable(
  "e_invoice_payloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eInvoiceRecordId: uuid("e_invoice_record_id")
      .notNull()
      .references(() => eInvoiceRecords.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    payloadType: text("payload_type").notNull(),
    schemaVersion: text("schema_version").notNull(),
    contentHash: text("content_hash").notNull(),
    payload: jsonb("payload").notNull(),
    generatedBy: uuid("generated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    recordTypeUnique: uniqueIndex("e_invoice_payloads_record_type_unique").on(
      table.eInvoiceRecordId,
      table.payloadType
    ),
    businessRecordIndex: index("e_invoice_payloads_business_record_idx").on(
      table.businessId,
      table.eInvoiceRecordId
    ),
    recordBusinessFk: foreignKey({
      columns: [table.eInvoiceRecordId, table.businessId],
      foreignColumns: [eInvoiceRecords.id, eInvoiceRecords.businessId],
      name: "e_invoice_payloads_record_business_fk",
    }),
  })
)

export const eInvoiceStatusEvents = pgTable(
  "e_invoice_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eInvoiceRecordId: uuid("e_invoice_record_id")
      .notNull()
      .references(() => eInvoiceRecords.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status"),
    status: text("status").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message"),
    providerReference: text("provider_reference"),
    rawResponse: jsonb("raw_response"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recordIndex: index("e_invoice_status_events_record_idx").on(
      table.eInvoiceRecordId,
      table.createdAt
    ),
    recordBusinessFk: foreignKey({
      columns: [table.eInvoiceRecordId, table.businessId],
      foreignColumns: [eInvoiceRecords.id, eInvoiceRecords.businessId],
      name: "e_invoice_status_events_record_business_fk",
    }),
  })
)

export const eInvoiceIdempotencyKeys = pgTable(
  "e_invoice_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    operationScope: text("operation_scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: jsonb("response_body"),
    status: text("status").notNull().default("completed"),
    ...timestamps,
  },
  (table) => ({
    businessScopeKeyUnique: uniqueIndex(
      "e_invoice_idempotency_keys_business_scope_key_unique"
    ).on(table.businessId, table.operationScope, table.idempotencyKey),
  })
)

export const posSales = pgTable(
  "pos_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    branchId: uuid("branch_id").references(() => businessBranches.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    partyId: uuid("party_id").references(() => parties.id, { onDelete: "set null" }),
    partySnapshot: jsonb("party_snapshot"),
    customerName: text("customer_name").notNull().default("Walk-in customer"),
    receiptNumber: text("receipt_number").notNull(),
    receiptDate: text("receipt_date").notNull(),
    placeOfSupplyStateCode: text("place_of_supply_state_code"),
    status: text("status").notNull().default("posted"),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    amountDue: numeric("amount_due", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("pos_sales_business_id_idx").on(table.businessId),
    voucherIndex: index("pos_sales_voucher_id_idx").on(table.voucherId),
    branchIndex: index("pos_sales_branch_id_idx").on(table.branchId),
    businessReceiptUnique: uniqueIndex("pos_sales_business_receipt_unique").on(
      table.businessId,
      table.receiptNumber
    ),
  })
)

export const posSaleLines = pgTable(
  "pos_sale_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    posSaleId: uuid("pos_sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    hsnSacCode: text("hsn_sac_code"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit").notNull().default("PCS"),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
    taxableValue: numeric("taxable_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    taxability: text("taxability").notNull().default("TAXABLE"),
    classification: text("classification"),
    supplyLocationTreatment: text("supply_location_treatment"),
    grossValue: numeric("gross_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxableCharges: numeric("taxable_charges", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    nonTaxableCharges: numeric("non_taxable_charges", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cgstRate: numeric("cgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sgstRate: numeric("sgst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    igstRate: numeric("igst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    cessRuleId: text("cess_rule_id"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxRuleId: text("tax_rule_id"),
    taxRuleVersion: text("tax_rule_version").notNull().default("GSTFY_TAX_V1"),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    roundOff: numeric("round_off", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    saleIndex: index("pos_sale_lines_sale_id_idx").on(table.posSaleId),
    itemIndex: index("pos_sale_lines_item_id_idx").on(table.itemId),
  })
)

export const posSalePayments = pgTable(
  "pos_sale_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    posSaleId: uuid("pos_sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "cascade" }),
    paymentMode: text("payment_mode").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    referenceNumber: text("reference_number"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    saleIndex: index("pos_sale_payments_sale_id_idx").on(table.posSaleId),
  })
)

export const businessAutomationSettings = pgTable("business_automation_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  autoStockAccountingEnabled: boolean("auto_stock_accounting_enabled")
    .notNull()
    .default(true),
  autoEInvoiceEnabled: boolean("auto_e_invoice_enabled").notNull().default(true),
  bankAutoMatchHighConfidenceEnabled: boolean(
    "bank_auto_match_high_confidence_enabled"
  )
    .notNull()
    .default(true),
  notifyAutomationFailures: boolean("notify_automation_failures")
    .notNull()
    .default(true),
  ...timestamps,
})

export const automationJobs = pgTable(
  "automation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    payload: jsonb("payload").notNull().default({}),
    result: jsonb("result"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => ({
    businessSourceUnique: uniqueIndex("automation_jobs_business_source_unique").on(
      table.businessId,
      table.jobType,
      table.sourceType,
      table.sourceId
    ),
    businessIdentityUnique: uniqueIndex(
      "automation_jobs_id_business_id_unique"
    ).on(table.id, table.businessId),
    businessStatusIndex: index("automation_jobs_business_status_idx").on(
      table.businessId,
      table.status,
      table.runAfter
    ),
    dueIndex: index("automation_jobs_due_idx").on(
      table.status,
      table.runAfter,
      table.priority,
      table.createdAt
    ),
  })
)

export const automationJobEvents = pgTable(
  "automation_job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => automationJobs.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    message: text("message"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIndex: index("automation_job_events_job_idx").on(
      table.jobId,
      table.createdAt
    ),
    businessIndex: index("automation_job_events_business_idx").on(
      table.businessId,
      table.createdAt
    ),
    jobBusinessFk: foreignKey({
      columns: [table.jobId, table.businessId],
      foreignColumns: [automationJobs.id, automationJobs.businessId],
      name: "automation_job_events_job_business_fk",
    }).onDelete("cascade"),
  })
)

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("audit_logs_business_id_idx").on(table.businessId),
    entityIndex: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    userIndex: index("audit_logs_user_id_idx").on(table.userId),
  })
)

export const userFeedback = pgTable(
  "user_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    accountType: text("account_type").notNull(),
    category: text("category").notNull(),
    rating: integer("rating").notNull(),
    effortScore: integer("effort_score").notNull(),
    message: text("message").notNull(),
    pageUrl: text("page_url"),
    contactConsent: boolean("contact_consent").notNull().default(false),
    status: text("status").notNull().default("new"),
    metadata: jsonb("metadata").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("user_feedback_business_id_idx").on(
      table.businessId,
      table.createdAt
    ),
    userIndex: index("user_feedback_user_id_idx").on(table.userId, table.createdAt),
    statusIndex: index("user_feedback_status_idx").on(table.status, table.createdAt),
  })
)

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    accountType: text("account_type").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    contactMethod: text("contact_method").notNull().default("none"),
    contactValue: text("contact_value"),
    workspaceName: text("workspace_name"),
    tenantUrl: text("tenant_url"),
    pageUrl: text("page_url"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    source: text("source").notNull().default("workspace_support"),
    metadata: jsonb("metadata").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("support_tickets_business_id_idx").on(
      table.businessId,
      table.createdAt
    ),
    userIndex: index("support_tickets_user_id_idx").on(table.userId, table.createdAt),
    statusIndex: index("support_tickets_status_idx").on(
      table.status,
      table.createdAt
    ),
  })
)

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    gstRegistrationId: uuid("gst_registration_id").references(
      () => gstRegistrations.id,
      { onDelete: "set null" }
    ),
    financialYearId: uuid("financial_year_id")
      .notNull()
      .references(() => financialYears.id),
    periodType: text("period_type").notNull().default("month"),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    status: text("status").notNull().default("open"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("accounting_periods_business_id_idx").on(table.businessId),
    gstRegistrationIndex: index("accounting_periods_gst_registration_id_idx").on(
      table.gstRegistrationId
    ),
    businessPeriodUnique: uniqueIndex("accounting_periods_business_period_unique").on(
      table.businessId,
      table.gstRegistrationId,
      table.periodStart,
      table.periodEnd,
      table.periodType
    ),
  })
)

export const parties = pgTable(
  "parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyType: text("party_type").notNull().default("business"),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    shortName: text("short_name"),
    pan: text("pan"),
    profileImageSeed: text("profile_image_seed"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("parties_business_id_idx").on(table.businessId),
    displayNameIndex: index("parties_display_name_idx").on(table.displayName),
    panIndex: index("parties_pan_idx").on(table.pan),
    businessIdentityUnique: uniqueIndex("parties_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
  })
)

export const partyGstRegistrations = pgTable(
  "party_gst_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    gstin: text("gstin").notNull(),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    registrationType: text("registration_type").notNull().default("gst"),
    taxpayerType: text("taxpayer_type"),
    stateCode: text("state_code").notNull(),
    state: text("state"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    registeredAddressId: uuid("registered_address_id"),
    status: text("status").notNull().default("active"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_gst_registrations_business_id_idx").on(
      table.businessId
    ),
    partyIndex: index("party_gst_registrations_party_id_idx").on(table.partyId),
    gstinIndex: index("party_gst_registrations_gstin_idx").on(table.gstin),
    registeredAddressIndex: index(
      "party_gst_registrations_registered_address_id_idx"
    ).on(table.registeredAddressId),
    businessIdentityUnique: uniqueIndex(
      "party_gst_registrations_id_business_id_unique"
    ).on(table.id, table.businessId),
    partyBusinessIdentityUnique: uniqueIndex(
      "party_gst_registrations_id_party_business_unique"
    ).on(table.id, table.partyId, table.businessId),
    partyGstinUnique: uniqueIndex("party_gst_registrations_party_gstin_unique").on(
      table.partyId,
      table.gstin
    ),
    businessGstinUnique: uniqueIndex(
      "party_gst_registrations_business_gstin_unique"
    ).on(table.businessId, table.gstin),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_gst_registrations_party_business_fk",
    }).onDelete("restrict"),
  })
)

export const partyTaxIdentifiers = pgTable(
  "party_tax_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    identifierType: text("identifier_type").notNull(),
    identifierValue: text("identifier_value").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_tax_identifiers_business_id_idx").on(
      table.businessId
    ),
    partyIndex: index("party_tax_identifiers_party_id_idx").on(table.partyId),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_tax_identifiers_party_business_fk",
    }).onDelete("restrict"),
    partyIdentifierUnique: uniqueIndex("party_tax_identifiers_unique").on(
      table.partyId,
      table.identifierType,
      table.identifierValue
    ),
  })
)

export const partyAddresses = pgTable(
  "party_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    addressType: text("address_type").notNull().default("billing"),
    label: text("label"),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    locality: text("locality"),
    city: text("city"),
    district: text("district"),
    state: text("state"),
    stateCode: text("state_code"),
    pincode: text("pincode"),
    country: text("country").notNull().default("India"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_addresses_business_id_idx").on(table.businessId),
    partyIndex: index("party_addresses_party_id_idx").on(table.partyId),
    businessIdentityUnique: uniqueIndex("party_addresses_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    partyBusinessIdentityUnique: uniqueIndex(
      "party_addresses_id_party_business_unique"
    ).on(table.id, table.partyId, table.businessId),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_addresses_party_business_fk",
    }).onDelete("restrict"),
  })
)

export const partyContacts = pgTable(
  "party_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    designation: text("designation"),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    contactRole: text("contact_role"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_contacts_business_id_idx").on(table.businessId),
    partyIndex: index("party_contacts_party_id_idx").on(table.partyId),
    emailIndex: index("party_contacts_email_idx").on(table.email),
    mobileIndex: index("party_contacts_mobile_idx").on(table.mobile),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_contacts_party_business_fk",
    }).onDelete("restrict"),
  })
)

export const partyBankAccounts = pgTable(
  "party_bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name"),
    accountNumberHash: text("account_number_hash"),
    accountNumberLast4: text("account_number_last4"),
    ifsc: text("ifsc"),
    branch: text("branch"),
    accountType: text("account_type"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_bank_accounts_business_id_idx").on(table.businessId),
    partyIndex: index("party_bank_accounts_party_id_idx").on(table.partyId),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_bank_accounts_party_business_fk",
    }).onDelete("restrict"),
  })
)

export const partyDocuments = pgTable(
  "party_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    documentType: text("document_type").notNull().default("other"),
    title: text("title").notNull(),
    fileReference: text("file_reference").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    fileSizeBytes: integer("file_size_bytes"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_documents_business_id_idx").on(table.businessId),
    partyIndex: index("party_documents_party_id_idx").on(table.partyId),
    statusIndex: index("party_documents_status_idx").on(table.status),
    businessIdentityUnique: uniqueIndex("party_documents_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    partyBusinessIdentityUnique: uniqueIndex(
      "party_documents_id_party_business_unique"
    ).on(table.id, table.partyId, table.businessId),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_documents_party_business_fk",
    }).onDelete("restrict"),
  })
)

export const partyCustomerProfiles = pgTable(
  "party_customer_profiles",
  {
    partyId: uuid("party_id")
      .primaryKey()
      .references(() => parties.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerCode: text("customer_code").notNull(),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    creditDays: integer("credit_days").notNull().default(0),
    defaultPaymentTermId: uuid("default_payment_term_id").references(
      () => paymentTerms.id,
      { onDelete: "set null" }
    ),
    defaultBillingAddressId: uuid("default_billing_address_id").references(
      () => partyAddresses.id,
      { onDelete: "set null" }
    ),
    defaultShippingAddressId: uuid("default_shipping_address_id").references(
      () => partyAddresses.id,
      { onDelete: "set null" }
    ),
    defaultGstRegistrationId: uuid("default_gst_registration_id").references(
      () => partyGstRegistrations.id,
      { onDelete: "set null" }
    ),
    priceGroupId: text("price_group_id"),
    salesRepId: uuid("sales_rep_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_customer_profiles_business_id_idx").on(
      table.businessId
    ),
    customerCodeUnique: uniqueIndex("party_customer_profiles_code_unique").on(
      table.businessId,
      table.customerCode
    ),
    businessPartyUnique: uniqueIndex("party_customer_profiles_business_party_unique").on(
      table.businessId,
      table.partyId
    ),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_customer_profiles_party_business_fk",
    }).onDelete("restrict"),
    paymentTermBusinessFk: foreignKey({
      columns: [table.defaultPaymentTermId, table.businessId],
      foreignColumns: [paymentTerms.id, paymentTerms.businessId],
      name: "party_customer_profiles_payment_term_business_fk",
    }),
    billingAddressPartyBusinessFk: foreignKey({
      columns: [table.defaultBillingAddressId, table.partyId, table.businessId],
      foreignColumns: [partyAddresses.id, partyAddresses.partyId, partyAddresses.businessId],
      name: "party_customer_profiles_billing_address_party_business_fk",
    }),
    shippingAddressPartyBusinessFk: foreignKey({
      columns: [table.defaultShippingAddressId, table.partyId, table.businessId],
      foreignColumns: [partyAddresses.id, partyAddresses.partyId, partyAddresses.businessId],
      name: "party_customer_profiles_shipping_address_party_business_fk",
    }),
    gstRegistrationPartyBusinessFk: foreignKey({
      columns: [table.defaultGstRegistrationId, table.partyId, table.businessId],
      foreignColumns: [
        partyGstRegistrations.id,
        partyGstRegistrations.partyId,
        partyGstRegistrations.businessId,
      ],
      name: "party_customer_profiles_gst_registration_party_business_fk",
    }),
  })
)

export const partySupplierProfiles = pgTable(
  "party_supplier_profiles",
  {
    partyId: uuid("party_id")
      .primaryKey()
      .references(() => parties.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    supplierCode: text("supplier_code").notNull(),
    creditDays: integer("credit_days").notNull().default(0),
    defaultPaymentTermId: uuid("default_payment_term_id").references(
      () => paymentTerms.id,
      { onDelete: "set null" }
    ),
    defaultPurchaseAddressId: uuid("default_purchase_address_id").references(
      () => partyAddresses.id,
      { onDelete: "set null" }
    ),
    defaultGstRegistrationId: uuid("default_gst_registration_id").references(
      () => partyGstRegistrations.id,
      { onDelete: "set null" }
    ),
    preferredWarehouseId: uuid("preferred_warehouse_id").references(
      () => warehouses.id,
      { onDelete: "set null" }
    ),
    leadTimeDays: integer("lead_time_days").notNull().default(0),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_supplier_profiles_business_id_idx").on(
      table.businessId
    ),
    supplierCodeUnique: uniqueIndex("party_supplier_profiles_code_unique").on(
      table.businessId,
      table.supplierCode
    ),
    businessPartyUnique: uniqueIndex("party_supplier_profiles_business_party_unique").on(
      table.businessId,
      table.partyId
    ),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_supplier_profiles_party_business_fk",
    }).onDelete("restrict"),
    paymentTermBusinessFk: foreignKey({
      columns: [table.defaultPaymentTermId, table.businessId],
      foreignColumns: [paymentTerms.id, paymentTerms.businessId],
      name: "party_supplier_profiles_payment_term_business_fk",
    }),
    purchaseAddressPartyBusinessFk: foreignKey({
      columns: [table.defaultPurchaseAddressId, table.partyId, table.businessId],
      foreignColumns: [partyAddresses.id, partyAddresses.partyId, partyAddresses.businessId],
      name: "party_supplier_profiles_purchase_address_party_business_fk",
    }),
    gstRegistrationPartyBusinessFk: foreignKey({
      columns: [table.defaultGstRegistrationId, table.partyId, table.businessId],
      foreignColumns: [
        partyGstRegistrations.id,
        partyGstRegistrations.partyId,
        partyGstRegistrations.businessId,
      ],
      name: "party_supplier_profiles_gst_registration_party_business_fk",
    }),
    preferredWarehouseBusinessFk: foreignKey({
      columns: [table.preferredWarehouseId, table.businessId],
      foreignColumns: [warehouses.id, warehouses.businessId],
      name: "party_supplier_profiles_preferred_warehouse_business_fk",
    }),
  })
)

export const partyAccountingProfiles = pgTable(
  "party_accounting_profiles",
  {
    partyId: uuid("party_id")
      .primaryKey()
      .references(() => parties.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    receivableAccountId: uuid("receivable_account_id"),
    payableAccountId: uuid("payable_account_id"),
    advanceReceiptAccountId: uuid("advance_receipt_account_id"),
    advancePaymentAccountId: uuid("advance_payment_account_id"),
    ...timestamps,
  },
  (table) => ({
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_accounting_profiles_party_business_fk",
    }).onDelete("restrict"),
    receivableAccountBusinessFk: foreignKey({
      columns: [table.receivableAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "party_accounting_profiles_receivable_account_business_fk",
    }),
    payableAccountBusinessFk: foreignKey({
      columns: [table.payableAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "party_accounting_profiles_payable_account_business_fk",
    }),
    advanceReceiptAccountBusinessFk: foreignKey({
      columns: [table.advanceReceiptAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "party_accounting_profiles_advance_receipt_account_business_fk",
    }),
    advancePaymentAccountBusinessFk: foreignKey({
      columns: [table.advancePaymentAccountId, table.businessId],
      foreignColumns: [ledgerAccounts.id, ledgerAccounts.businessId],
      name: "party_accounting_profiles_advance_payment_account_business_fk",
    }),
  })
)

export const partyBranchProfiles = pgTable(
  "party_branch_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => businessBranches.id, { onDelete: "cascade" }),
    salesRepId: uuid("sales_rep_id").references(() => users.id, {
      onDelete: "set null",
    }),
    priceGroupId: text("price_group_id"),
    paymentTermId: uuid("payment_term_id").references(() => paymentTerms.id, {
      onDelete: "set null",
    }),
    defaultAddressId: uuid("default_address_id").references(() => partyAddresses.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("party_branch_profiles_business_id_idx").on(
      table.businessId
    ),
    partyBranchUnique: uniqueIndex("party_branch_profiles_party_branch_unique").on(
      table.partyId,
      table.branchId
    ),
    partyBusinessFk: foreignKey({
      columns: [table.partyId, table.businessId],
      foreignColumns: [parties.id, parties.businessId],
      name: "party_branch_profiles_party_business_fk",
    }).onDelete("restrict"),
    branchBusinessFk: foreignKey({
      columns: [table.branchId, table.businessId],
      foreignColumns: [businessBranches.id, businessBranches.businessId],
      name: "party_branch_profiles_branch_business_fk",
    }).onDelete("cascade"),
    paymentTermBusinessFk: foreignKey({
      columns: [table.paymentTermId, table.businessId],
      foreignColumns: [paymentTerms.id, paymentTerms.businessId],
      name: "party_branch_profiles_payment_term_business_fk",
    }),
    defaultAddressPartyBusinessFk: foreignKey({
      columns: [table.defaultAddressId, table.partyId, table.businessId],
      foreignColumns: [partyAddresses.id, partyAddresses.partyId, partyAddresses.businessId],
      name: "party_branch_profiles_default_address_party_business_fk",
    }),
  })
)

export const hsnSacCodes = pgTable(
  "hsn_sac_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    codeType: text("code_type").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("hsn_sac_codes_code_unique").on(table.code),
    codeTypeIndex: index("hsn_sac_codes_code_type_idx").on(table.codeType),
  })
)

export const uqcCodes = pgTable(
  "uqc_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("uqc_codes_code_unique").on(table.code),
  })
)

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("product_categories_business_id_idx").on(table.businessId),
    businessNameUnique: uniqueIndex("product_categories_business_lower_name_unique").on(
      table.businessId,
      sql`lower(${table.name})`
    ),
  })
)

export const productBrands = pgTable(
  "product_brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("product_brands_business_id_idx").on(table.businessId),
    businessNameUnique: uniqueIndex("product_brands_business_lower_name_unique").on(
      table.businessId,
      sql`lower(${table.name})`
    ),
  })
)

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    itemType: text("item_type").notNull(),
    sku: text("sku").notNull(),
    description: text("description"),
    categoryId: text("category_id"),
    brandId: text("brand_id"),
    manufacturer: text("manufacturer"),
    modelNumber: text("model_number"),
    status: text("status").notNull().default("ACTIVE"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("items_business_id_idx").on(table.businessId),
    nameIndex: index("items_name_idx").on(table.name),
    businessIdentityUnique: uniqueIndex("items_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    businessSkuUnique: uniqueIndex("items_business_sku_unique").on(
      table.businessId,
      table.sku
    ),
  })
)

export const itemTaxProfiles = pgTable(
  "item_tax_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    taxability: text("taxability").notNull(),
    hsnSac: text("hsn_sac"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cessRuleId: text("cess_rule_id"),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_tax_profiles_business_id_idx").on(table.businessId),
    itemIndex: index("item_tax_profiles_item_id_idx").on(table.itemId),
  })
)

export const cessRules = pgTable(
  "cess_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    ruleCode: text("rule_code").notNull(),
    description: text("description").notNull(),
    calculationMethod: text("calculation_method").notNull(),
    ratePercent: numeric("rate_percent", { precision: 7, scale: 4 }),
    amountPerUnit: numeric("amount_per_unit", { precision: 14, scale: 2 }),
    conditions: jsonb("conditions").notNull().default({}),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("active"),
    version: text("version").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("cess_rules_business_id_idx").on(table.businessId),
    codeVersionUnique: uniqueIndex("cess_rules_code_version_unique").on(
      table.businessId,
      table.ruleCode,
      table.version
    ),
  })
)

export const taxRules = pgTable(
  "tax_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    ruleCode: text("rule_code").notNull(),
    description: text("description").notNull(),
    transactionType: text("transaction_type").notNull(),
    taxability: text("taxability").notNull(),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cessRuleId: uuid("cess_rule_id").references(() => cessRules.id, {
      onDelete: "set null",
    }),
    conditions: jsonb("conditions").notNull().default({}),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("active"),
    version: text("version").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("tax_rules_business_id_idx").on(table.businessId),
    transactionIndex: index("tax_rules_transaction_type_idx").on(table.transactionType),
    codeVersionUnique: uniqueIndex("tax_rules_code_version_unique").on(
      table.businessId,
      table.ruleCode,
      table.version
    ),
  })
)

export const itemUnits = pgTable(
  "item_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    baseUnit: text("base_unit").notNull(),
    secondaryUnit: text("secondary_unit"),
    conversionFactor: numeric("conversion_factor", {
      precision: 14,
      scale: 6,
    })
      .notNull()
      .default("1"),
    gstUqc: text("gst_uqc"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_units_business_id_idx").on(table.businessId),
    itemIndex: index("item_units_item_id_idx").on(table.itemId),
  })
)

export const itemPrices = pgTable(
  "item_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    priceType: text("price_type").notNull(),
    price: numeric("price", { precision: 14, scale: 2 }).notNull().default("0"),
    marginPercent: numeric("margin_percent", { precision: 8, scale: 2 }).notNull().default("0"),
    taxMode: text("tax_mode").notNull().default("EXCLUSIVE"),
    currency: text("currency").notNull().default("INR"),
    minimumQuantity: numeric("minimum_quantity", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("1"),
    customerGroupId: text("customer_group_id"),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_prices_business_id_idx").on(table.businessId),
    itemIndex: index("item_prices_item_id_idx").on(table.itemId),
  })
)

export const itemSuppliers = pgTable(
  "item_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    supplierItemCode: text("supplier_item_code"),
    purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }),
    minimumOrderQuantity: numeric("minimum_order_quantity", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("1"),
    leadTimeDays: integer("lead_time_days").notNull().default(0),
    isPreferred: boolean("is_preferred").notNull().default(false),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_suppliers_business_id_idx").on(table.businessId),
    itemIndex: index("item_suppliers_item_id_idx").on(table.itemId),
    supplierIndex: index("item_suppliers_supplier_id_idx").on(table.supplierId),
  })
)

export const itemBarcodes = pgTable(
  "item_barcodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    barcode: text("barcode").notNull(),
    barcodeType: text("barcode_type"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => ({
    itemIndex: index("item_barcodes_item_id_idx").on(table.itemId),
    businessBarcodeUnique: uniqueIndex("item_barcodes_business_barcode_unique").on(
      table.businessId,
      table.barcode
    ),
  })
)

export const itemImages = pgTable(
  "item_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id"),
    objectKey: text("object_key").notNull(),
    publicUrl: text("public_url").notNull(),
    fileName: text("file_name"),
    contentType: text("content_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("ACTIVE"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_images_business_id_idx").on(table.businessId),
    itemIndex: index("item_images_item_id_idx").on(table.itemId),
    statusIndex: index("item_images_status_idx").on(table.status),
    objectKeyUnique: uniqueIndex("item_images_object_key_unique").on(table.objectKey),
    identityUnique: uniqueIndex("item_images_id_business_id_unique").on(
      table.id,
      table.businessId
    ),
    itemBusinessFk: foreignKey({
      columns: [table.itemId, table.businessId],
      foreignColumns: [items.id, items.businessId],
      name: "item_images_item_business_fk",
    }).onDelete("cascade"),
  })
)

export const itemInventoryProfiles = pgTable(
  "item_inventory_profiles",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    trackInventory: boolean("track_inventory").notNull().default(true),
    defaultWarehouseId: uuid("default_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    minimumStock: numeric("minimum_stock", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    maximumStock: numeric("maximum_stock", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    batchTracking: boolean("batch_tracking").notNull().default(false),
    serialTracking: boolean("serial_tracking").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_inventory_profiles_business_id_idx").on(
      table.businessId
    ),
  })
)

export const itemAccountingProfiles = pgTable(
  "item_accounting_profiles",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    salesAccountId: uuid("sales_account_id").references(() => ledgerAccounts.id, {
      onDelete: "set null",
    }),
    purchaseAccountId: uuid("purchase_account_id").references(() => ledgerAccounts.id, {
      onDelete: "set null",
    }),
    inventoryAccountId: uuid("inventory_account_id").references(() => ledgerAccounts.id, {
      onDelete: "set null",
    }),
    salesReturnAccountId: uuid("sales_return_account_id").references(
      () => ledgerAccounts.id,
      { onDelete: "set null" }
    ),
    purchaseReturnAccountId: uuid("purchase_return_account_id").references(
      () => ledgerAccounts.id,
      { onDelete: "set null" }
    ),
    ...timestamps,
  },
  (table) => ({
    businessIndex: index("item_accounting_profiles_business_id_idx").on(
      table.businessId
    ),
  })
)

export const businessPreferences = pgTable("business_preferences", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  invoiceTemplate: text("invoice_template").notNull().default("standard"),
  purchaseInvoiceTemplate: text("purchase_invoice_template").notNull().default("reference-01"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  invoiceWatermarkText: text("invoice_watermark_text").notNull().default("GSTFY"),
  invoiceLogoObjectKey: text("invoice_logo_object_key"),
  invoiceLogoPublicUrl: text("invoice_logo_public_url"),
  invoiceLogoFileName: text("invoice_logo_file_name"),
  invoiceLogoContentType: text("invoice_logo_content_type"),
  invoiceLogoFileSizeBytes: integer("invoice_logo_file_size_bytes"),
  invoiceLogoUploadedAt: timestamp("invoice_logo_uploaded_at", { withTimezone: true }),
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
export type VoucherRecord = typeof vouchers.$inferSelect
export type JournalEntryRecord = typeof journalEntries.$inferSelect
export type LedgerAccountRecord = typeof ledgerAccounts.$inferSelect
export type JournalEntryLineRecord = typeof journalEntryLines.$inferSelect
export type InventoryTransactionRecord = typeof inventoryTransactions.$inferSelect
export type InventoryBalanceRecord = typeof inventoryBalances.$inferSelect
export type BusinessInventorySettingsRecord =
  typeof businessInventorySettings.$inferSelect
export type InventoryCostLayerRecord = typeof inventoryCostLayers.$inferSelect
export type StockTransferRecord = typeof stockTransfers.$inferSelect
export type StockTransferLineRecord = typeof stockTransferLines.$inferSelect
export type InventoryBatchRecord = typeof inventoryBatches.$inferSelect
export type InventorySerialNumberRecord = typeof inventorySerialNumbers.$inferSelect
export type GstEntryRecord = typeof gstEntries.$inferSelect
export type ReceivablePayableEntryRecord = typeof receivablePayableEntries.$inferSelect
export type PaymentTermRecord = typeof paymentTerms.$inferSelect
export type PaymentAllocationRecord = typeof paymentAllocations.$inferSelect
export type ReceivablePayableAdjustmentEffectRecord =
  typeof receivablePayableAdjustmentEffects.$inferSelect
export type ReceiptRecord = typeof receipts.$inferSelect
export type PaymentRecord = typeof payments.$inferSelect
export type BankStatementImportRecord = typeof bankStatementImports.$inferSelect
export type BankStatementLineRecord = typeof bankStatementLines.$inferSelect
export type BankReconciliationMatchRecord =
  typeof bankReconciliationMatches.$inferSelect
export type SalesInvoiceRecord = typeof salesInvoices.$inferSelect
export type SalesInvoiceLineRecord = typeof salesInvoiceLines.$inferSelect
export type SalesInvoicePaymentRecord = typeof salesInvoicePayments.$inferSelect
export type PurchaseBillRecord = typeof purchaseBills.$inferSelect
export type PurchaseBillLineRecord = typeof purchaseBillLines.$inferSelect
export type PurchaseBillPaymentRecord = typeof purchaseBillPayments.$inferSelect
export type AdjustmentDocumentRecord = typeof adjustmentDocuments.$inferSelect
export type AdjustmentDocumentLineRecord = typeof adjustmentDocumentLines.$inferSelect
export type PurchaseTaxRecord = typeof purchaseTaxRecords.$inferSelect
export type ExternalGstImportRecord = typeof externalGstImports.$inferSelect
export type ExternalGstRecord = typeof externalGstRecords.$inferSelect
export type GstReconciliationMatchRecord =
  typeof gstReconciliationMatches.$inferSelect
export type GstReconciliationExceptionRecord =
  typeof gstReconciliationExceptions.$inferSelect
export type ItcClaimRecord = typeof itcClaims.$inferSelect
export type ItcStatusEventRecord = typeof itcStatusEvents.$inferSelect
export type GstReportingRunRecord = typeof gstReportingRuns.$inferSelect
export type GstReportingFactRecord = typeof gstReportingFacts.$inferSelect
export type GstReportingExceptionRecord =
  typeof gstReportingExceptions.$inferSelect
export type GstReportingExportRecord = typeof gstReportingExports.$inferSelect
export type GstFilingRunRecord = typeof gstFilingRuns.$inferSelect
export type GstFilingPayloadRecord = typeof gstFilingPayloads.$inferSelect
export type GstFilingStatusEventRecord = typeof gstFilingStatusEvents.$inferSelect
export type EInvoiceRecord = typeof eInvoiceRecords.$inferSelect
export type EInvoicePayloadRecord = typeof eInvoicePayloads.$inferSelect
export type EInvoiceStatusEventRecord = typeof eInvoiceStatusEvents.$inferSelect
export type PosSaleRecord = typeof posSales.$inferSelect
export type PosSaleLineRecord = typeof posSaleLines.$inferSelect
export type PosSalePaymentRecord = typeof posSalePayments.$inferSelect
export type BusinessAutomationSettingsRecord =
  typeof businessAutomationSettings.$inferSelect
export type AutomationJobRecord = typeof automationJobs.$inferSelect
export type AutomationJobEventRecord = typeof automationJobEvents.$inferSelect
export type AuditLogRecord = typeof auditLogs.$inferSelect
export type UserFeedbackRecord = typeof userFeedback.$inferSelect
export type SupportTicketRecord = typeof supportTickets.$inferSelect
export type PartyRecord = typeof parties.$inferSelect
export type PartyGstRegistrationRecord = typeof partyGstRegistrations.$inferSelect
export type PartyAddressRecord = typeof partyAddresses.$inferSelect
export type PartyContactRecord = typeof partyContacts.$inferSelect
export type PartyDocumentRecord = typeof partyDocuments.$inferSelect
export type PartyCustomerProfileRecord = typeof partyCustomerProfiles.$inferSelect
export type PartySupplierProfileRecord = typeof partySupplierProfiles.$inferSelect
export type HsnSacCodeRecord = typeof hsnSacCodes.$inferSelect
export type UqcCodeRecord = typeof uqcCodes.$inferSelect
export type ProductCategoryRecord = typeof productCategories.$inferSelect
export type ProductBrandRecord = typeof productBrands.$inferSelect
export type ItemRecord = typeof items.$inferSelect
export type ItemTaxProfileRecord = typeof itemTaxProfiles.$inferSelect
export type CessRuleRecord = typeof cessRules.$inferSelect
export type TaxRuleRecord = typeof taxRules.$inferSelect
export type ItemUnitRecord = typeof itemUnits.$inferSelect
export type ItemPriceRecord = typeof itemPrices.$inferSelect
export type ItemSupplierRecord = typeof itemSuppliers.$inferSelect
export type ItemBarcodeRecord = typeof itemBarcodes.$inferSelect
export type ItemImageRecord = typeof itemImages.$inferSelect
export type ItemInventoryProfileRecord = typeof itemInventoryProfiles.$inferSelect
export type ItemAccountingProfileRecord = typeof itemAccountingProfiles.$inferSelect
