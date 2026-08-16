import {
  boolean,
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
    outstandingAmount: numeric("outstanding_amount", { precision: 14, scale: 2 })
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
  },
  (table) => ({
    businessIndex: index("payment_allocations_business_id_idx").on(table.businessId),
    paymentVoucherIndex: index("payment_allocations_payment_voucher_id_idx").on(
      table.paymentVoucherId
    ),
    documentVoucherIndex: index("payment_allocations_document_voucher_id_idx").on(
      table.documentVoucherId
    ),
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
      .references(() => parties.id, { onDelete: "cascade" }),
    gstin: text("gstin").notNull(),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    registrationType: text("registration_type").notNull().default("gst"),
    taxpayerType: text("taxpayer_type"),
    stateCode: text("state_code").notNull(),
    state: text("state"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
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
    partyGstinUnique: uniqueIndex("party_gst_registrations_party_gstin_unique").on(
      table.partyId,
      table.gstin
    ),
    businessGstinUnique: uniqueIndex(
      "party_gst_registrations_business_gstin_unique"
    ).on(table.businessId, table.gstin),
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
      .references(() => parties.id, { onDelete: "cascade" }),
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
      .references(() => parties.id, { onDelete: "cascade" }),
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
      .references(() => parties.id, { onDelete: "cascade" }),
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
      .references(() => parties.id, { onDelete: "cascade" }),
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
  })
)

export const partyCustomerProfiles = pgTable(
  "party_customer_profiles",
  {
    partyId: uuid("party_id")
      .primaryKey()
      .references(() => parties.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerCode: text("customer_code").notNull(),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    creditDays: integer("credit_days").notNull().default(0),
    defaultPaymentTerm: text("default_payment_term"),
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
  })
)

export const partySupplierProfiles = pgTable(
  "party_supplier_profiles",
  {
    partyId: uuid("party_id")
      .primaryKey()
      .references(() => parties.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    supplierCode: text("supplier_code").notNull(),
    creditDays: integer("credit_days").notNull().default(0),
    defaultPaymentTerm: text("default_payment_term"),
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
  })
)

export const partyAccountingProfiles = pgTable("party_accounting_profiles", {
  partyId: uuid("party_id")
    .primaryKey()
    .references(() => parties.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  receivableAccountId: text("receivable_account_id"),
  payableAccountId: text("payable_account_id"),
  advanceReceiptAccountId: text("advance_receipt_account_id"),
  advancePaymentAccountId: text("advance_payment_account_id"),
  ...timestamps,
})

export const partyBranchProfiles = pgTable(
  "party_branch_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    partyId: uuid("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => businessBranches.id, { onDelete: "cascade" }),
    salesRepId: uuid("sales_rep_id").references(() => users.id, {
      onDelete: "set null",
    }),
    priceGroupId: text("price_group_id"),
    paymentTerm: text("payment_term"),
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
export type PaymentAllocationRecord = typeof paymentAllocations.$inferSelect
export type SalesInvoiceRecord = typeof salesInvoices.$inferSelect
export type SalesInvoiceLineRecord = typeof salesInvoiceLines.$inferSelect
export type SalesInvoicePaymentRecord = typeof salesInvoicePayments.$inferSelect
export type PurchaseBillRecord = typeof purchaseBills.$inferSelect
export type PurchaseBillLineRecord = typeof purchaseBillLines.$inferSelect
export type PurchaseBillPaymentRecord = typeof purchaseBillPayments.$inferSelect
export type PosSaleRecord = typeof posSales.$inferSelect
export type PosSaleLineRecord = typeof posSaleLines.$inferSelect
export type PosSalePaymentRecord = typeof posSalePayments.$inferSelect
export type AuditLogRecord = typeof auditLogs.$inferSelect
export type PartyRecord = typeof parties.$inferSelect
export type PartyGstRegistrationRecord = typeof partyGstRegistrations.$inferSelect
export type PartyAddressRecord = typeof partyAddresses.$inferSelect
export type PartyContactRecord = typeof partyContacts.$inferSelect
export type PartyCustomerProfileRecord = typeof partyCustomerProfiles.$inferSelect
export type PartySupplierProfileRecord = typeof partySupplierProfiles.$inferSelect
export type HsnSacCodeRecord = typeof hsnSacCodes.$inferSelect
export type UqcCodeRecord = typeof uqcCodes.$inferSelect
export type ItemRecord = typeof items.$inferSelect
export type ItemTaxProfileRecord = typeof itemTaxProfiles.$inferSelect
export type CessRuleRecord = typeof cessRules.$inferSelect
export type TaxRuleRecord = typeof taxRules.$inferSelect
export type ItemUnitRecord = typeof itemUnits.$inferSelect
export type ItemPriceRecord = typeof itemPrices.$inferSelect
export type ItemSupplierRecord = typeof itemSuppliers.$inferSelect
export type ItemBarcodeRecord = typeof itemBarcodes.$inferSelect
export type ItemInventoryProfileRecord = typeof itemInventoryProfiles.$inferSelect
export type ItemAccountingProfileRecord = typeof itemAccountingProfiles.$inferSelect
