create extension if not exists "pgcrypto";

alter table "public"."business_members"
  add column if not exists "designation" text,
  add column if not exists "permission_preset" text not null default 'custom';

update "public"."business_members"
set "permission_preset" = case
  when "role" = 'owner' then 'owner'
  when "role" = 'admin' then 'manager'
  when "role" = 'accountant' then 'accountant'
  when "role" = 'cashier' then 'cashier'
  else 'custom'
end
where "permission_preset" is null or "permission_preset" = 'custom';

create table if not exists "public"."business_locations" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "name" text not null,
  "location_code" text not null,
  "address_line_1" text,
  "address_line_2" text,
  "locality" text,
  "district" text,
  "city" text,
  "pincode" text,
  "state_code" text,
  "state" text,
  "country" text not null default 'India',
  "status" text not null default 'active',
  "is_principal_place" boolean not null default false,
  "is_additional_place" boolean not null default false,
  "is_sales_location" boolean not null default true,
  "is_purchase_location" boolean not null default true,
  "is_dispatch_location" boolean not null default true,
  "is_warehouse_location" boolean not null default false,
  "is_office" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "business_locations_business_code_unique"
  on "public"."business_locations" ("business_id", "location_code");
create index if not exists "business_locations_business_id_idx"
  on "public"."business_locations" ("business_id");

create table if not exists "public"."gst_registrations" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "gstin" text not null,
  "legal_name" text not null,
  "trade_name" text not null,
  "taxpayer_type" text,
  "registration_type" text not null default 'gst',
  "state_code" text not null,
  "state" text,
  "registration_date" text,
  "effective_from" text,
  "effective_to" text,
  "status" text not null default 'active',
  "principal_location_id" uuid references "public"."business_locations"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "gst_registrations_business_gstin_unique"
  on "public"."gst_registrations" ("business_id", "gstin");
create index if not exists "gst_registrations_business_id_idx"
  on "public"."gst_registrations" ("business_id");
create index if not exists "gst_registrations_gstin_idx"
  on "public"."gst_registrations" ("gstin");

create table if not exists "public"."business_branches" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "location_id" uuid not null references "public"."business_locations"("id"),
  "gst_registration_id" uuid references "public"."gst_registrations"("id") on delete set null,
  "branch_code" text not null,
  "name" text not null,
  "branch_type" text not null default 'retail_store',
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "business_branches_business_code_unique"
  on "public"."business_branches" ("business_id", "branch_code");
create index if not exists "business_branches_business_id_idx"
  on "public"."business_branches" ("business_id");
create index if not exists "business_branches_location_id_idx"
  on "public"."business_branches" ("location_id");

create table if not exists "public"."warehouses" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "location_id" uuid not null references "public"."business_locations"("id"),
  "warehouse_code" text not null,
  "name" text not null,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "warehouses_business_code_unique"
  on "public"."warehouses" ("business_id", "warehouse_code");
create index if not exists "warehouses_business_id_idx"
  on "public"."warehouses" ("business_id");
create index if not exists "warehouses_location_id_idx"
  on "public"."warehouses" ("location_id");

create table if not exists "public"."branch_warehouses" (
  "branch_id" uuid not null references "public"."business_branches"("id") on delete cascade,
  "warehouse_id" uuid not null references "public"."warehouses"("id") on delete cascade,
  "is_default" boolean not null default false,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "branch_warehouses_unique"
  on "public"."branch_warehouses" ("branch_id", "warehouse_id");

create table if not exists "public"."business_member_branches" (
  "business_member_id" uuid not null references "public"."business_members"("id") on delete cascade,
  "branch_id" uuid not null references "public"."business_branches"("id") on delete cascade,
  "is_primary" boolean not null default false,
  "created_at" timestamptz not null default now()
);

create unique index if not exists "business_member_branches_unique"
  on "public"."business_member_branches" ("business_member_id", "branch_id");

create table if not exists "public"."financial_years" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "name" text not null,
  "start_date" text not null,
  "end_date" text not null,
  "status" text not null default 'active',
  "is_current" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "financial_years_business_name_unique"
  on "public"."financial_years" ("business_id", "name");
create index if not exists "financial_years_business_id_idx"
  on "public"."financial_years" ("business_id");

create table if not exists "public"."invoice_series" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "gst_registration_id" uuid not null references "public"."gst_registrations"("id"),
  "branch_id" uuid references "public"."business_branches"("id") on delete set null,
  "financial_year_id" uuid not null references "public"."financial_years"("id"),
  "document_type" text not null default 'invoice',
  "series_code" text not null,
  "prefix" text not null,
  "suffix" text,
  "next_number" integer not null default 1,
  "status" text not null default 'active',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create unique index if not exists "invoice_series_business_series_unique"
  on "public"."invoice_series" ("business_id", "series_code", "financial_year_id", "document_type");
create index if not exists "invoice_series_business_id_idx"
  on "public"."invoice_series" ("business_id");
create index if not exists "invoice_series_gst_registration_id_idx"
  on "public"."invoice_series" ("gst_registration_id");

insert into "public"."business_locations" (
  "business_id",
  "name",
  "location_code",
  "address_line_1",
  "address_line_2",
  "locality",
  "district",
  "city",
  "pincode",
  "state_code",
  "status",
  "is_principal_place",
  "is_sales_location",
  "is_purchase_location",
  "is_dispatch_location",
  "is_office"
)
select
  b."id",
  coalesce(nullif(b."trade_name", ''), b."legal_name") || ' Principal Place',
  'PRINCIPAL',
  bp."address_line_1",
  bp."address_line_2",
  bp."locality",
  bp."district",
  bp."district",
  bp."pincode",
  bp."state_code",
  'active',
  true,
  true,
  true,
  true,
  true
from "public"."businesses" b
left join "public"."business_profiles" bp on bp."business_id" = b."id"
on conflict ("business_id", "location_code") do nothing;

insert into "public"."gst_registrations" (
  "business_id",
  "gstin",
  "legal_name",
  "trade_name",
  "taxpayer_type",
  "state_code",
  "registration_date",
  "effective_from",
  "status",
  "principal_location_id"
)
select
  b."id",
  upper(bp."gstin"),
  b."legal_name",
  b."trade_name",
  bp."taxpayer_type",
  bp."state_code",
  bp."registration_date",
  bp."registration_date",
  'active',
  bl."id"
from "public"."business_profiles" bp
inner join "public"."businesses" b on b."id" = bp."business_id"
left join "public"."business_locations" bl
  on bl."business_id" = b."id" and bl."location_code" = 'PRINCIPAL'
where bp."gstin" is not null and bp."gstin" <> ''
on conflict ("business_id", "gstin") do nothing;

insert into "public"."business_branches" (
  "business_id",
  "location_id",
  "gst_registration_id",
  "branch_code",
  "name",
  "branch_type",
  "status"
)
select
  b."id",
  bl."id",
  gr."id",
  'MAIN',
  b."trade_name",
  'retail_store',
  'active'
from "public"."businesses" b
inner join "public"."business_locations" bl
  on bl."business_id" = b."id" and bl."location_code" = 'PRINCIPAL'
left join "public"."gst_registrations" gr on gr."business_id" = b."id"
on conflict ("business_id", "branch_code") do nothing;

with fy as (
  select
    case
      when extract(month from current_date) >= 4 then extract(year from current_date)::int
      else extract(year from current_date)::int - 1
    end as start_year
)
insert into "public"."financial_years" (
  "business_id",
  "name",
  "start_date",
  "end_date",
  "status",
  "is_current"
)
select
  b."id",
  fy.start_year::text || '-' || right((fy.start_year + 1)::text, 2),
  fy.start_year::text || '-04-01',
  (fy.start_year + 1)::text || '-03-31',
  'active',
  true
from "public"."businesses" b
cross join fy
on conflict ("business_id", "name") do nothing;

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
  'invoice',
  'DEFAULT',
  coalesce(bprefs."invoice_prefix", 'INV'),
  null,
  coalesce(bprefs."invoice_next_number", 1),
  'active'
from "public"."businesses" b
inner join "public"."gst_registrations" gr on gr."business_id" = b."id"
inner join "public"."financial_years" fy
  on fy."business_id" = b."id" and fy."is_current" = true
left join "public"."business_branches" bb
  on bb."business_id" = b."id" and bb."branch_code" = 'MAIN'
left join "public"."business_preferences" bprefs on bprefs."business_id" = b."id"
on conflict ("business_id", "series_code", "financial_year_id", "document_type") do nothing;

insert into "public"."business_member_branches" (
  "business_member_id",
  "branch_id",
  "is_primary"
)
select
  bm."id",
  bb."id",
  true
from "public"."business_members" bm
inner join "public"."business_branches" bb
  on bb."business_id" = bm."business_id" and bb."branch_code" = 'MAIN'
where bm."role" <> 'owner'
on conflict ("business_member_id", "branch_id") do nothing;
