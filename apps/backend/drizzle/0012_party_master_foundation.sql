create table if not exists "public"."parties" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_type" text not null default 'business',
  "display_name" text not null,
  "legal_name" text,
  "trade_name" text,
  "short_name" text,
  "pan" text,
  "status" text not null default 'active',
  "notes" text,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "updated_by" uuid references "public"."users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "parties_business_id_idx"
  on "public"."parties" ("business_id");
create index if not exists "parties_display_name_idx"
  on "public"."parties" ("display_name");
create index if not exists "parties_pan_idx"
  on "public"."parties" ("pan");

create table if not exists "public"."party_gst_registrations" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_id" uuid not null references "public"."parties"("id") on delete cascade,
  "gstin" text not null,
  "legal_name" text,
  "trade_name" text,
  "registration_type" text not null default 'gst',
  "taxpayer_type" text,
  "state_code" text not null,
  "state" text,
  "effective_from" text,
  "effective_to" text,
  "status" text not null default 'active',
  "is_primary" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "party_gst_registrations_party_gstin_unique"
  on "public"."party_gst_registrations" ("party_id", "gstin");
create unique index if not exists "party_gst_registrations_business_gstin_unique"
  on "public"."party_gst_registrations" ("business_id", "gstin");
create index if not exists "party_gst_registrations_business_id_idx"
  on "public"."party_gst_registrations" ("business_id");
create index if not exists "party_gst_registrations_party_id_idx"
  on "public"."party_gst_registrations" ("party_id");
create index if not exists "party_gst_registrations_gstin_idx"
  on "public"."party_gst_registrations" ("gstin");

create table if not exists "public"."party_tax_identifiers" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_id" uuid not null references "public"."parties"("id") on delete cascade,
  "identifier_type" text not null,
  "identifier_value" text not null,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "party_tax_identifiers_unique"
  on "public"."party_tax_identifiers" ("party_id", "identifier_type", "identifier_value");
create index if not exists "party_tax_identifiers_business_id_idx"
  on "public"."party_tax_identifiers" ("business_id");
create index if not exists "party_tax_identifiers_party_id_idx"
  on "public"."party_tax_identifiers" ("party_id");

create table if not exists "public"."party_addresses" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_id" uuid not null references "public"."parties"("id") on delete cascade,
  "address_type" text not null default 'billing',
  "label" text,
  "address_line_1" text,
  "address_line_2" text,
  "locality" text,
  "city" text,
  "district" text,
  "state" text,
  "state_code" text,
  "pincode" text,
  "country" text not null default 'India',
  "is_primary" boolean not null default false,
  "is_active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "party_addresses_business_id_idx"
  on "public"."party_addresses" ("business_id");
create index if not exists "party_addresses_party_id_idx"
  on "public"."party_addresses" ("party_id");

create table if not exists "public"."party_contacts" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_id" uuid not null references "public"."parties"("id") on delete cascade,
  "name" text not null,
  "designation" text,
  "email" text,
  "phone" text,
  "mobile" text,
  "contact_role" text,
  "is_primary" boolean not null default false,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "party_contacts_business_id_idx"
  on "public"."party_contacts" ("business_id");
create index if not exists "party_contacts_party_id_idx"
  on "public"."party_contacts" ("party_id");
create index if not exists "party_contacts_email_idx"
  on "public"."party_contacts" ("email");
create index if not exists "party_contacts_mobile_idx"
  on "public"."party_contacts" ("mobile");

create table if not exists "public"."party_bank_accounts" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_id" uuid not null references "public"."parties"("id") on delete cascade,
  "bank_name" text not null,
  "account_name" text,
  "account_number_hash" text,
  "account_number_last4" text,
  "ifsc" text,
  "branch" text,
  "account_type" text,
  "is_primary" boolean not null default false,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "party_bank_accounts_business_id_idx"
  on "public"."party_bank_accounts" ("business_id");
create index if not exists "party_bank_accounts_party_id_idx"
  on "public"."party_bank_accounts" ("party_id");

create table if not exists "public"."party_customer_profiles" (
  "party_id" uuid primary key references "public"."parties"("id") on delete cascade,
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "customer_code" text not null,
  "credit_limit" numeric(14, 2) not null default 0,
  "credit_days" integer not null default 0,
  "default_payment_term" text,
  "default_billing_address_id" uuid references "public"."party_addresses"("id") on delete set null,
  "default_shipping_address_id" uuid references "public"."party_addresses"("id") on delete set null,
  "default_gst_registration_id" uuid references "public"."party_gst_registrations"("id") on delete set null,
  "price_group_id" text,
  "sales_rep_id" uuid references "public"."users"("id") on delete set null,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "party_customer_profiles_code_unique"
  on "public"."party_customer_profiles" ("business_id", "customer_code");
create index if not exists "party_customer_profiles_business_id_idx"
  on "public"."party_customer_profiles" ("business_id");

create table if not exists "public"."party_supplier_profiles" (
  "party_id" uuid primary key references "public"."parties"("id") on delete cascade,
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "supplier_code" text not null,
  "credit_days" integer not null default 0,
  "default_payment_term" text,
  "default_purchase_address_id" uuid references "public"."party_addresses"("id") on delete set null,
  "default_gst_registration_id" uuid references "public"."party_gst_registrations"("id") on delete set null,
  "preferred_warehouse_id" uuid references "public"."warehouses"("id") on delete set null,
  "lead_time_days" integer not null default 0,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "party_supplier_profiles_code_unique"
  on "public"."party_supplier_profiles" ("business_id", "supplier_code");
create index if not exists "party_supplier_profiles_business_id_idx"
  on "public"."party_supplier_profiles" ("business_id");

create table if not exists "public"."party_accounting_profiles" (
  "party_id" uuid primary key references "public"."parties"("id") on delete cascade,
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "receivable_account_id" text,
  "payable_account_id" text,
  "advance_receipt_account_id" text,
  "advance_payment_account_id" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table if not exists "public"."party_branch_profiles" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "party_id" uuid not null references "public"."parties"("id") on delete cascade,
  "branch_id" uuid not null references "public"."business_branches"("id") on delete cascade,
  "sales_rep_id" uuid references "public"."users"("id") on delete set null,
  "price_group_id" text,
  "payment_term" text,
  "default_address_id" uuid references "public"."party_addresses"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "party_branch_profiles_party_branch_unique"
  on "public"."party_branch_profiles" ("party_id", "branch_id");
create index if not exists "party_branch_profiles_business_id_idx"
  on "public"."party_branch_profiles" ("business_id");
