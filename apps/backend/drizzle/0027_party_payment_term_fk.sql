alter table "public"."party_customer_profiles"
  add column if not exists "default_payment_term_id" uuid references "public"."payment_terms"("id") on delete set null;

alter table "public"."party_supplier_profiles"
  add column if not exists "default_payment_term_id" uuid references "public"."payment_terms"("id") on delete set null;

update "public"."party_customer_profiles" as "profiles"
set "default_payment_term_id" = "terms"."id"
from "public"."payment_terms" as "terms"
where "profiles"."default_payment_term_id" is null
  and "profiles"."default_payment_term" is not null
  and "terms"."business_id" = "profiles"."business_id"
  and "terms"."code" = "profiles"."default_payment_term";

update "public"."party_supplier_profiles" as "profiles"
set "default_payment_term_id" = "terms"."id"
from "public"."payment_terms" as "terms"
where "profiles"."default_payment_term_id" is null
  and "profiles"."default_payment_term" is not null
  and "terms"."business_id" = "profiles"."business_id"
  and "terms"."code" = "profiles"."default_payment_term";

create index if not exists "party_customer_profiles_default_payment_term_id_idx"
  on "public"."party_customer_profiles" ("default_payment_term_id");

create index if not exists "party_supplier_profiles_default_payment_term_id_idx"
  on "public"."party_supplier_profiles" ("default_payment_term_id");
