insert into "public"."warehouses" (
  "business_id",
  "location_id",
  "warehouse_code",
  "name",
  "warehouse_type",
  "status"
)
select
  b."id",
  bl."id",
  'MAIN',
  coalesce(nullif(b."trade_name", ''), b."legal_name") || ' Default Warehouse',
  'branch',
  'active'
from "public"."businesses" b
inner join "public"."business_locations" bl
  on bl."business_id" = b."id" and bl."location_code" = 'PRINCIPAL'
where not exists (
  select 1
  from "public"."warehouses" existing
  where existing."business_id" = b."id"
    and existing."warehouse_code" = 'MAIN'
)
on conflict ("business_id", "warehouse_code") do nothing;

update "public"."business_locations" bl
set
  "is_warehouse_location" = true,
  "updated_at" = now()
where bl."location_code" = 'PRINCIPAL'
  and exists (
    select 1
    from "public"."warehouses" w
    where w."business_id" = bl."business_id"
      and w."location_id" = bl."id"
      and w."warehouse_code" = 'MAIN'
  );

insert into "public"."branch_warehouses" (
  "branch_id",
  "warehouse_id",
  "is_default"
)
select
  bb."id",
  w."id",
  not exists (
    select 1
    from "public"."branch_warehouses" existing
    where existing."branch_id" = bb."id"
      and existing."is_default" = true
  )
from "public"."business_branches" bb
inner join "public"."warehouses" w
  on w."business_id" = bb."business_id" and w."warehouse_code" = 'MAIN'
where bb."branch_code" = 'MAIN'
on conflict ("branch_id", "warehouse_id") do update
set "is_default" = "branch_warehouses"."is_default"
  or excluded."is_default";
