create table if not exists "public"."vouchers" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "warehouse_id" uuid references "public"."warehouses"("id") on delete set null,
  "voucher_type" text not null,
  "voucher_number" text not null,
  "voucher_date" text not null,
  "financial_year_id" uuid not null references "public"."financial_years"("id"),
  "status" text not null default 'posted',
  "reference_voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz,
  "cancelled_at" timestamptz,
  "notes" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "vouchers_business_number_unique"
  on "public"."vouchers" ("business_id", "financial_year_id", "voucher_type", "voucher_number");
create index if not exists "vouchers_business_id_idx"
  on "public"."vouchers" ("business_id");
create index if not exists "vouchers_branch_id_idx"
  on "public"."vouchers" ("branch_id");
create index if not exists "vouchers_warehouse_id_idx"
  on "public"."vouchers" ("warehouse_id");
create index if not exists "vouchers_gst_registration_id_idx"
  on "public"."vouchers" ("gst_registration_id");
create index if not exists "vouchers_reference_voucher_id_idx"
  on "public"."vouchers" ("reference_voucher_id");

create table if not exists "public"."posting_idempotency_keys" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "idempotency_key" text not null,
  "request_hash" text not null,
  "status" text not null default 'in_progress',
  "voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "response_body" jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "posting_idempotency_business_key_unique"
  on "public"."posting_idempotency_keys" ("business_id", "idempotency_key");
create index if not exists "posting_idempotency_business_id_idx"
  on "public"."posting_idempotency_keys" ("business_id");

create table if not exists "public"."journal_entries" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid not null references "public"."vouchers"("id") on delete cascade,
  "entry_date" text not null,
  "description" text,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "journal_entries_business_id_idx"
  on "public"."journal_entries" ("business_id");
create index if not exists "journal_entries_voucher_id_idx"
  on "public"."journal_entries" ("voucher_id");

create table if not exists "public"."journal_entry_lines" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "journal_entry_id" uuid not null references "public"."journal_entries"("id") on delete cascade,
  "account_code" text not null,
  "account_name" text not null,
  "debit" numeric(14, 2) not null default 0,
  "credit" numeric(14, 2) not null default 0,
  "narration" text,
  "created_at" timestamptz not null default now()
);

create index if not exists "journal_entry_lines_business_id_idx"
  on "public"."journal_entry_lines" ("business_id");
create index if not exists "journal_entry_lines_entry_id_idx"
  on "public"."journal_entry_lines" ("journal_entry_id");

create table if not exists "public"."inventory_transactions" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid not null references "public"."vouchers"("id") on delete cascade,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "warehouse_id" uuid references "public"."warehouses"("id") on delete set null,
  "item_id" text,
  "item_name_snapshot" text not null,
  "movement_type" text not null,
  "quantity" numeric(14, 3) not null,
  "unit" text not null default 'pcs',
  "unit_cost" numeric(14, 2),
  "total_cost" numeric(14, 2),
  "created_at" timestamptz not null default now()
);

create index if not exists "inventory_transactions_business_id_idx"
  on "public"."inventory_transactions" ("business_id");
create index if not exists "inventory_transactions_voucher_id_idx"
  on "public"."inventory_transactions" ("voucher_id");
create index if not exists "inventory_transactions_warehouse_id_idx"
  on "public"."inventory_transactions" ("warehouse_id");
create index if not exists "inventory_transactions_branch_id_idx"
  on "public"."inventory_transactions" ("branch_id");

create table if not exists "public"."gst_entries" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid not null references "public"."vouchers"("id") on delete cascade,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "entry_type" text not null,
  "tax_component" text not null,
  "tax_rate" numeric(5, 2) not null default 0,
  "taxable_value" numeric(14, 2) not null default 0,
  "tax_amount" numeric(14, 2) not null default 0,
  "place_of_supply_state_code" text,
  "itc_eligibility" text,
  "created_at" timestamptz not null default now()
);

create index if not exists "gst_entries_business_id_idx"
  on "public"."gst_entries" ("business_id");
create index if not exists "gst_entries_voucher_id_idx"
  on "public"."gst_entries" ("voucher_id");
create index if not exists "gst_entries_gst_registration_id_idx"
  on "public"."gst_entries" ("gst_registration_id");

create table if not exists "public"."receivable_payable_entries" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid not null references "public"."vouchers"("id") on delete cascade,
  "party_id" text,
  "party_name_snapshot" text not null,
  "entry_type" text not null,
  "original_amount" numeric(14, 2) not null,
  "settled_amount" numeric(14, 2) not null default 0,
  "outstanding_amount" numeric(14, 2) not null default 0,
  "due_date" text,
  "status" text not null default 'open',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "receivable_payable_entries_business_id_idx"
  on "public"."receivable_payable_entries" ("business_id");
create index if not exists "receivable_payable_entries_voucher_id_idx"
  on "public"."receivable_payable_entries" ("voucher_id");
create index if not exists "receivable_payable_entries_party_id_idx"
  on "public"."receivable_payable_entries" ("party_id");

create table if not exists "public"."payment_allocations" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "payment_voucher_id" uuid not null references "public"."vouchers"("id") on delete cascade,
  "document_voucher_id" uuid not null references "public"."vouchers"("id") on delete cascade,
  "receivable_payable_entry_id" uuid references "public"."receivable_payable_entries"("id") on delete set null,
  "allocated_amount" numeric(14, 2) not null,
  "allocated_at" timestamptz not null default now()
);

create index if not exists "payment_allocations_business_id_idx"
  on "public"."payment_allocations" ("business_id");
create index if not exists "payment_allocations_payment_voucher_id_idx"
  on "public"."payment_allocations" ("payment_voucher_id");
create index if not exists "payment_allocations_document_voucher_id_idx"
  on "public"."payment_allocations" ("document_voucher_id");

create table if not exists "public"."audit_logs" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "action" text not null,
  "user_id" uuid references "public"."users"("id") on delete set null,
  "before" jsonb,
  "after" jsonb,
  "reason" text,
  "created_at" timestamptz not null default now()
);

create index if not exists "audit_logs_business_id_idx"
  on "public"."audit_logs" ("business_id");
create index if not exists "audit_logs_entity_idx"
  on "public"."audit_logs" ("entity_type", "entity_id");
create index if not exists "audit_logs_user_id_idx"
  on "public"."audit_logs" ("user_id");

create table if not exists "public"."accounting_periods" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "financial_year_id" uuid not null references "public"."financial_years"("id"),
  "period_type" text not null default 'month',
  "period_start" text not null,
  "period_end" text not null,
  "status" text not null default 'open',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "accounting_periods_business_period_unique"
  on "public"."accounting_periods" ("business_id", "gst_registration_id", "period_start", "period_end", "period_type");
create index if not exists "accounting_periods_business_id_idx"
  on "public"."accounting_periods" ("business_id");
create index if not exists "accounting_periods_gst_registration_id_idx"
  on "public"."accounting_periods" ("gst_registration_id");
