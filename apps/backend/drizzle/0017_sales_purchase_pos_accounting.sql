alter table "public"."journal_entry_lines"
  add column if not exists "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  add column if not exists "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  add column if not exists "warehouse_id" uuid references "public"."warehouses"("id") on delete set null;

create index if not exists "journal_entry_lines_branch_id_idx"
  on "public"."journal_entry_lines" ("branch_id");
create index if not exists "journal_entry_lines_gst_registration_id_idx"
  on "public"."journal_entry_lines" ("gst_registration_id");
create index if not exists "journal_entry_lines_warehouse_id_idx"
  on "public"."journal_entry_lines" ("warehouse_id");

insert into "public"."invoice_series" (
  "business_id",
  "gst_registration_id",
  "branch_id",
  "financial_year_id",
  "document_type",
  "series_code",
  "prefix",
  "suffix",
  "next_number",
  "status"
)
select
  b."id",
  gr."id",
  bb."id",
  fy."id",
  series."document_type",
  'DEFAULT',
  series."prefix",
  null,
  1,
  'active'
from "public"."businesses" b
inner join "public"."gst_registrations" gr on gr."business_id" = b."id"
inner join "public"."financial_years" fy
  on fy."business_id" = b."id" and fy."is_current" = true
left join "public"."business_branches" bb
  on bb."business_id" = b."id" and bb."branch_code" = 'MAIN'
cross join (
  values
    ('purchase', 'PUR'),
    ('payment', 'PAY'),
    ('receipt', 'RCP'),
    ('pos', 'POS')
) as series("document_type", "prefix")
on conflict ("business_id", "series_code", "financial_year_id", "document_type") do nothing;

create table if not exists "public"."sales_invoices" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "warehouse_id" uuid references "public"."warehouses"("id") on delete set null,
  "party_id" uuid references "public"."parties"("id") on delete set null,
  "party_snapshot" jsonb,
  "customer_name" text not null,
  "invoice_number" text not null,
  "invoice_date" text not null,
  "due_date" text,
  "place_of_supply_state_code" text,
  "supply_type" text not null default 'b2c',
  "invoice_type" text not null default 'tax_invoice',
  "status" text not null default 'draft',
  "taxable_value" numeric(14, 2) not null default 0,
  "cgst_amount" numeric(14, 2) not null default 0,
  "sgst_amount" numeric(14, 2) not null default 0,
  "igst_amount" numeric(14, 2) not null default 0,
  "cess_amount" numeric(14, 2) not null default 0,
  "total_amount" numeric(14, 2) not null default 0,
  "amount_paid" numeric(14, 2) not null default 0,
  "amount_due" numeric(14, 2) not null default 0,
  "notes" text,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "sales_invoices_business_number_unique"
  on "public"."sales_invoices" ("business_id", "invoice_number");
create index if not exists "sales_invoices_business_id_idx"
  on "public"."sales_invoices" ("business_id");
create index if not exists "sales_invoices_voucher_id_idx"
  on "public"."sales_invoices" ("voucher_id");
create index if not exists "sales_invoices_party_id_idx"
  on "public"."sales_invoices" ("party_id");
create index if not exists "sales_invoices_branch_id_idx"
  on "public"."sales_invoices" ("branch_id");

create table if not exists "public"."sales_invoice_lines" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "sales_invoice_id" uuid not null references "public"."sales_invoices"("id") on delete cascade,
  "item_id" uuid references "public"."items"("id") on delete set null,
  "item_name_snapshot" text not null,
  "hsn_sac_code" text,
  "quantity" numeric(14, 3) not null,
  "unit" text not null default 'PCS',
  "rate" numeric(14, 2) not null,
  "taxable_value" numeric(14, 2) not null default 0,
  "gst_rate" numeric(5, 2) not null default 0,
  "cgst_amount" numeric(14, 2) not null default 0,
  "sgst_amount" numeric(14, 2) not null default 0,
  "igst_amount" numeric(14, 2) not null default 0,
  "cess_amount" numeric(14, 2) not null default 0,
  "line_total" numeric(14, 2) not null default 0,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now()
);

create index if not exists "sales_invoice_lines_invoice_id_idx"
  on "public"."sales_invoice_lines" ("sales_invoice_id");
create index if not exists "sales_invoice_lines_item_id_idx"
  on "public"."sales_invoice_lines" ("item_id");

create table if not exists "public"."sales_invoice_payments" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "sales_invoice_id" uuid not null references "public"."sales_invoices"("id") on delete cascade,
  "payment_mode" text not null,
  "amount" numeric(14, 2) not null,
  "reference_number" text,
  "received_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now()
);

create index if not exists "sales_invoice_payments_invoice_id_idx"
  on "public"."sales_invoice_payments" ("sales_invoice_id");

create table if not exists "public"."purchase_bills" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "warehouse_id" uuid references "public"."warehouses"("id") on delete set null,
  "supplier_id" uuid references "public"."parties"("id") on delete set null,
  "supplier_snapshot" jsonb,
  "supplier_name" text not null,
  "bill_number" text not null,
  "supplier_invoice_number" text,
  "invoice_date" text not null,
  "bill_date" text not null,
  "place_of_supply_state_code" text,
  "purchase_type" text not null default 'goods',
  "status" text not null default 'draft',
  "taxable_value" numeric(14, 2) not null default 0,
  "cgst_amount" numeric(14, 2) not null default 0,
  "sgst_amount" numeric(14, 2) not null default 0,
  "igst_amount" numeric(14, 2) not null default 0,
  "cess_amount" numeric(14, 2) not null default 0,
  "total_amount" numeric(14, 2) not null default 0,
  "amount_paid" numeric(14, 2) not null default 0,
  "amount_due" numeric(14, 2) not null default 0,
  "itc_eligible_amount" numeric(14, 2) not null default 0,
  "notes" text,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "purchase_bills_business_number_unique"
  on "public"."purchase_bills" ("business_id", "bill_number");
create index if not exists "purchase_bills_business_id_idx"
  on "public"."purchase_bills" ("business_id");
create index if not exists "purchase_bills_voucher_id_idx"
  on "public"."purchase_bills" ("voucher_id");
create index if not exists "purchase_bills_supplier_id_idx"
  on "public"."purchase_bills" ("supplier_id");
create index if not exists "purchase_bills_branch_id_idx"
  on "public"."purchase_bills" ("branch_id");

create table if not exists "public"."purchase_bill_lines" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "purchase_bill_id" uuid not null references "public"."purchase_bills"("id") on delete cascade,
  "item_id" uuid references "public"."items"("id") on delete set null,
  "item_name_snapshot" text not null,
  "hsn_sac_code" text,
  "quantity" numeric(14, 3) not null,
  "unit" text not null default 'PCS',
  "rate" numeric(14, 2) not null,
  "taxable_value" numeric(14, 2) not null default 0,
  "gst_rate" numeric(5, 2) not null default 0,
  "cgst_amount" numeric(14, 2) not null default 0,
  "sgst_amount" numeric(14, 2) not null default 0,
  "igst_amount" numeric(14, 2) not null default 0,
  "cess_amount" numeric(14, 2) not null default 0,
  "line_total" numeric(14, 2) not null default 0,
  "itc_eligible" boolean not null default true,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now()
);

create index if not exists "purchase_bill_lines_bill_id_idx"
  on "public"."purchase_bill_lines" ("purchase_bill_id");
create index if not exists "purchase_bill_lines_item_id_idx"
  on "public"."purchase_bill_lines" ("item_id");

create table if not exists "public"."purchase_bill_payments" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "purchase_bill_id" uuid not null references "public"."purchase_bills"("id") on delete cascade,
  "payment_mode" text not null,
  "amount" numeric(14, 2) not null,
  "reference_number" text,
  "paid_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now()
);

create index if not exists "purchase_bill_payments_bill_id_idx"
  on "public"."purchase_bill_payments" ("purchase_bill_id");

create table if not exists "public"."pos_sales" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "voucher_id" uuid references "public"."vouchers"("id") on delete set null,
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "warehouse_id" uuid references "public"."warehouses"("id") on delete set null,
  "party_id" uuid references "public"."parties"("id") on delete set null,
  "customer_name" text not null default 'Walk-in customer',
  "receipt_number" text not null,
  "receipt_date" text not null,
  "place_of_supply_state_code" text,
  "status" text not null default 'posted',
  "taxable_value" numeric(14, 2) not null default 0,
  "cgst_amount" numeric(14, 2) not null default 0,
  "sgst_amount" numeric(14, 2) not null default 0,
  "igst_amount" numeric(14, 2) not null default 0,
  "cess_amount" numeric(14, 2) not null default 0,
  "total_amount" numeric(14, 2) not null default 0,
  "amount_paid" numeric(14, 2) not null default 0,
  "amount_due" numeric(14, 2) not null default 0,
  "notes" text,
  "created_by" uuid references "public"."users"("id") on delete set null,
  "posted_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "pos_sales_business_receipt_unique"
  on "public"."pos_sales" ("business_id", "receipt_number");
create index if not exists "pos_sales_business_id_idx"
  on "public"."pos_sales" ("business_id");
create index if not exists "pos_sales_voucher_id_idx"
  on "public"."pos_sales" ("voucher_id");
create index if not exists "pos_sales_branch_id_idx"
  on "public"."pos_sales" ("branch_id");

create table if not exists "public"."pos_sale_lines" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "pos_sale_id" uuid not null references "public"."pos_sales"("id") on delete cascade,
  "item_id" uuid references "public"."items"("id") on delete set null,
  "item_name_snapshot" text not null,
  "hsn_sac_code" text,
  "quantity" numeric(14, 3) not null,
  "unit" text not null default 'PCS',
  "rate" numeric(14, 2) not null,
  "taxable_value" numeric(14, 2) not null default 0,
  "gst_rate" numeric(5, 2) not null default 0,
  "cgst_amount" numeric(14, 2) not null default 0,
  "sgst_amount" numeric(14, 2) not null default 0,
  "igst_amount" numeric(14, 2) not null default 0,
  "cess_amount" numeric(14, 2) not null default 0,
  "line_total" numeric(14, 2) not null default 0,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now()
);

create index if not exists "pos_sale_lines_sale_id_idx"
  on "public"."pos_sale_lines" ("pos_sale_id");
create index if not exists "pos_sale_lines_item_id_idx"
  on "public"."pos_sale_lines" ("item_id");

create table if not exists "public"."pos_sale_payments" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "pos_sale_id" uuid not null references "public"."pos_sales"("id") on delete cascade,
  "payment_mode" text not null,
  "amount" numeric(14, 2) not null,
  "reference_number" text,
  "received_at" timestamptz not null default now(),
  "created_at" timestamptz not null default now()
);

create index if not exists "pos_sale_payments_sale_id_idx"
  on "public"."pos_sale_payments" ("pos_sale_id");
