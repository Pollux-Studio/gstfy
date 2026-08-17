alter table "public"."payment_allocations"
  add column if not exists "status" text not null default 'active',
  add column if not exists "created_by" uuid references "public"."users"("id") on delete set null,
  add column if not exists "reversed_by" uuid references "public"."users"("id") on delete set null,
  add column if not exists "reversed_at" timestamptz,
  add column if not exists "reversal_reason" text,
  add column if not exists "updated_at" timestamptz not null default now();

create index if not exists "payment_allocations_receivable_payable_entry_id_idx"
  on "public"."payment_allocations" ("receivable_payable_entry_id");
create index if not exists "payment_allocations_status_idx"
  on "public"."payment_allocations" ("status");

create table if not exists "public"."receipts" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "party_id" uuid not null references "public"."parties"("id") on delete restrict,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "cash_bank_account_id" uuid not null references "public"."ledger_accounts"("id") on delete restrict,
  "receipt_number" text not null,
  "receipt_date" text not null,
  "payment_method" text not null,
  "amount" numeric(14, 2) not null,
  "allocated_amount" numeric(14, 2) not null default 0,
  "unallocated_amount" numeric(14, 2) not null default 0,
  "reference_number" text,
  "notes" text,
  "status" text not null default 'draft',
  "party_name_snapshot" text not null,
  "party_snapshot" jsonb,
  "cash_bank_account_snapshot" jsonb,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_by" uuid references "public"."users"("id") on delete set null,
  "reversed_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz,
  "reversed_at" timestamptz,
  "reversal_reason" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "receipts_business_number_unique"
  on "public"."receipts" ("business_id", "receipt_number");
create index if not exists "receipts_business_id_idx"
  on "public"."receipts" ("business_id");
create index if not exists "receipts_party_id_idx"
  on "public"."receipts" ("party_id");
create index if not exists "receipts_voucher_id_idx"
  on "public"."receipts" ("voucher_id");
create index if not exists "receipts_status_idx"
  on "public"."receipts" ("status");

create table if not exists "public"."payments" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "party_id" uuid not null references "public"."parties"("id") on delete restrict,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "cash_bank_account_id" uuid not null references "public"."ledger_accounts"("id") on delete restrict,
  "payment_number" text not null,
  "payment_date" text not null,
  "payment_method" text not null,
  "amount" numeric(14, 2) not null,
  "allocated_amount" numeric(14, 2) not null default 0,
  "unallocated_amount" numeric(14, 2) not null default 0,
  "reference_number" text,
  "notes" text,
  "status" text not null default 'draft',
  "party_name_snapshot" text not null,
  "party_snapshot" jsonb,
  "cash_bank_account_snapshot" jsonb,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_by" uuid references "public"."users"("id") on delete set null,
  "reversed_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz,
  "reversed_at" timestamptz,
  "reversal_reason" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "payments_business_number_unique"
  on "public"."payments" ("business_id", "payment_number");
create index if not exists "payments_business_id_idx"
  on "public"."payments" ("business_id");
create index if not exists "payments_party_id_idx"
  on "public"."payments" ("party_id");
create index if not exists "payments_voucher_id_idx"
  on "public"."payments" ("voucher_id");
create index if not exists "payments_status_idx"
  on "public"."payments" ("status");
