alter table "public"."pos_sales"
  add column if not exists "party_snapshot" jsonb;

create table if not exists "public"."payment_terms" (
  "id" uuid primary key default gen_random_uuid(),
  "business_id" uuid not null references "public"."businesses"("id") on delete cascade,
  "code" text not null,
  "name" text not null,
  "days" integer not null default 0,
  "due_date_rule" text not null default 'invoice_date_plus_days',
  "status" text not null default 'active',
  "is_system" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index if not exists "payment_terms_business_id_idx"
  on "public"."payment_terms" ("business_id");

create unique index if not exists "payment_terms_business_code_unique"
  on "public"."payment_terms" ("business_id", "code");

insert into "public"."payment_terms" (
  "business_id",
  "code",
  "name",
  "days",
  "due_date_rule",
  "status",
  "is_system"
)
select
  "businesses"."id",
  "default_terms"."code",
  "default_terms"."name",
  "default_terms"."days",
  'invoice_date_plus_days',
  'active',
  true
from "public"."businesses"
cross join (
  values
    ('immediate', 'Due on receipt', 0),
    ('7_days', 'Net 7', 7),
    ('15_days', 'Net 15', 15),
    ('30_days', 'Net 30', 30),
    ('45_days', 'Net 45', 45)
) as "default_terms"("code", "name", "days")
on conflict ("business_id", "code") do nothing;
