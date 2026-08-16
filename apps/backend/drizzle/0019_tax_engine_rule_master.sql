alter table "public"."sales_invoice_lines"
  add column if not exists "supply_location_treatment" text,
  add column if not exists "gross_value" numeric(14, 2) not null default 0,
  add column if not exists "discount_amount" numeric(14, 2) not null default 0,
  add column if not exists "taxable_charges" numeric(14, 2) not null default 0,
  add column if not exists "non_taxable_charges" numeric(14, 2) not null default 0;

alter table "public"."purchase_bill_lines"
  add column if not exists "supply_location_treatment" text,
  add column if not exists "gross_value" numeric(14, 2) not null default 0,
  add column if not exists "discount_amount" numeric(14, 2) not null default 0,
  add column if not exists "taxable_charges" numeric(14, 2) not null default 0,
  add column if not exists "non_taxable_charges" numeric(14, 2) not null default 0;

alter table "public"."pos_sale_lines"
  add column if not exists "supply_location_treatment" text,
  add column if not exists "gross_value" numeric(14, 2) not null default 0,
  add column if not exists "discount_amount" numeric(14, 2) not null default 0,
  add column if not exists "taxable_charges" numeric(14, 2) not null default 0,
  add column if not exists "non_taxable_charges" numeric(14, 2) not null default 0;

update "public"."sales_invoice_lines"
set
  "supply_location_treatment" = case when "igst_amount" > 0 then 'INTER_STATE' else 'INTRA_STATE' end,
  "classification" = case
    when "taxability" = 'EXEMPT' then 'EXEMPT'
    when "taxability" = 'NIL_RATED' then 'NIL_RATED'
    when "taxability" = 'NON_GST' then 'NON_GST'
    when "taxability" = 'ZERO_RATED' then 'ZERO_RATED'
    else 'B2C'
  end,
  "gross_value" = "taxable_value"
where "supply_location_treatment" is null;

update "public"."purchase_bill_lines"
set
  "supply_location_treatment" = case when "igst_amount" > 0 then 'INTER_STATE' else 'INTRA_STATE' end,
  "classification" = case
    when "taxability" = 'EXEMPT' then 'EXEMPT'
    when "taxability" = 'NIL_RATED' then 'NIL_RATED'
    when "taxability" = 'NON_GST' then 'NON_GST'
    when "taxability" = 'ZERO_RATED' then 'ZERO_RATED'
    else 'B2B'
  end,
  "gross_value" = "taxable_value"
where "supply_location_treatment" is null;

update "public"."pos_sale_lines"
set
  "supply_location_treatment" = case when "igst_amount" > 0 then 'INTER_STATE' else 'INTRA_STATE' end,
  "classification" = case
    when "taxability" = 'EXEMPT' then 'EXEMPT'
    when "taxability" = 'NIL_RATED' then 'NIL_RATED'
    when "taxability" = 'NON_GST' then 'NON_GST'
    when "taxability" = 'ZERO_RATED' then 'ZERO_RATED'
    else 'B2C'
  end,
  "gross_value" = "taxable_value"
where "supply_location_treatment" is null;

create table if not exists "public"."cess_rules" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid references "public"."businesses"("id") on delete cascade,
  "rule_code" text not null,
  "description" text not null,
  "calculation_method" text not null,
  "rate_percent" numeric(7, 4),
  "amount_per_unit" numeric(14, 2),
  "conditions" jsonb not null default '{}'::jsonb,
  "effective_from" text not null,
  "effective_to" text,
  "status" text not null default 'active',
  "version" text not null,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "updated_by" uuid references "public"."users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "cess_rules_business_id_idx"
  on "public"."cess_rules" ("business_id");

create unique index if not exists "cess_rules_code_version_unique"
  on "public"."cess_rules" ("business_id", "rule_code", "version");

create table if not exists "public"."tax_rules" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid references "public"."businesses"("id") on delete cascade,
  "rule_code" text not null,
  "description" text not null,
  "transaction_type" text not null,
  "taxability" text not null,
  "gst_rate" numeric(5, 2) not null default 0,
  "cess_rule_id" uuid references "public"."cess_rules"("id") on delete set null,
  "conditions" jsonb not null default '{}'::jsonb,
  "effective_from" text not null,
  "effective_to" text,
  "status" text not null default 'active',
  "version" text not null,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "updated_by" uuid references "public"."users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "tax_rules_business_id_idx"
  on "public"."tax_rules" ("business_id");

create index if not exists "tax_rules_transaction_type_idx"
  on "public"."tax_rules" ("transaction_type");

create unique index if not exists "tax_rules_code_version_unique"
  on "public"."tax_rules" ("business_id", "rule_code", "version");
