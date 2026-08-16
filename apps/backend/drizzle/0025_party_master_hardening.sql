-- Keep historical customer/supplier profiles and enforce party-master invariants.

create unique index if not exists "party_customer_profiles_business_party_unique"
  on "public"."party_customer_profiles" ("business_id", "party_id");

create unique index if not exists "party_supplier_profiles_business_party_unique"
  on "public"."party_supplier_profiles" ("business_id", "party_id");

with ranked as (
  select
    "id",
    row_number() over (
      partition by "business_id", "party_id"
      order by "updated_at" desc, "created_at" desc, "id" desc
    ) as row_number
  from "public"."party_gst_registrations"
  where "is_primary" = true
    and "status" <> 'archived'
)
update "public"."party_gst_registrations" target
set "is_primary" = false,
    "updated_at" = now()
from ranked
where target."id" = ranked."id"
  and ranked.row_number > 1;

create unique index if not exists "party_gst_registrations_one_active_primary"
  on "public"."party_gst_registrations" ("business_id", "party_id")
  where "is_primary" = true
    and "status" <> 'archived';

with ranked as (
  select
    "id",
    row_number() over (
      partition by "business_id", "party_id"
      order by "updated_at" desc, "created_at" desc, "id" desc
    ) as row_number
  from "public"."party_addresses"
  where "is_primary" = true
    and "is_active" = true
)
update "public"."party_addresses" target
set "is_primary" = false,
    "updated_at" = now()
from ranked
where target."id" = ranked."id"
  and ranked.row_number > 1;

create unique index if not exists "party_addresses_one_active_primary"
  on "public"."party_addresses" ("business_id", "party_id")
  where "is_primary" = true
    and "is_active" = true;

with ranked as (
  select
    "id",
    row_number() over (
      partition by "business_id", "party_id"
      order by "updated_at" desc, "created_at" desc, "id" desc
    ) as row_number
  from "public"."party_contacts"
  where "is_primary" = true
    and "status" = 'active'
)
update "public"."party_contacts" target
set "is_primary" = false,
    "updated_at" = now()
from ranked
where target."id" = ranked."id"
  and ranked.row_number > 1;

create unique index if not exists "party_contacts_one_active_primary"
  on "public"."party_contacts" ("business_id", "party_id")
  where "is_primary" = true
    and "status" = 'active';

with ranked as (
  select
    "id",
    row_number() over (
      partition by "business_id", "party_id"
      order by "updated_at" desc, "created_at" desc, "id" desc
    ) as row_number
  from "public"."party_bank_accounts"
  where "is_primary" = true
    and "status" <> 'archived'
)
update "public"."party_bank_accounts" target
set "is_primary" = false,
    "updated_at" = now()
from ranked
where target."id" = ranked."id"
  and ranked.row_number > 1;

create unique index if not exists "party_bank_accounts_one_active_primary"
  on "public"."party_bank_accounts" ("business_id", "party_id")
  where "is_primary" = true
    and "status" <> 'archived';
