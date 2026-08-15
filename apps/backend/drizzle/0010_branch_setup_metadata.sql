alter table "public"."business_branches"
  add column if not exists "manager_name" text,
  add column if not exists "phone" text,
  add column if not exists "email" text,
  add column if not exists "opening_date" text;

alter table "public"."warehouses"
  add column if not exists "warehouse_type" text,
  add column if not exists "capacity" text,
  add column if not exists "manager_name" text;
