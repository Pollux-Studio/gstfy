-- Harden Party Master tenant integrity at the database layer.

alter table "public"."party_gst_registrations"
  alter column "effective_from" type date
    using case
      when "effective_from" ~ '^\d{4}-\d{2}-\d{2}$' then "effective_from"::date
      else null
    end,
  alter column "effective_to" type date
    using case
      when "effective_to" ~ '^\d{4}-\d{2}-\d{2}$' then "effective_to"::date
      else null
    end;

alter table "public"."party_accounting_profiles"
  alter column "receivable_account_id" type uuid
    using case
      when "receivable_account_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then "receivable_account_id"::uuid
      else null
    end,
  alter column "payable_account_id" type uuid
    using case
      when "payable_account_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then "payable_account_id"::uuid
      else null
    end,
  alter column "advance_receipt_account_id" type uuid
    using case
      when "advance_receipt_account_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then "advance_receipt_account_id"::uuid
      else null
    end,
  alter column "advance_payment_account_id" type uuid
    using case
      when "advance_payment_account_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then "advance_payment_account_id"::uuid
      else null
    end;

alter table "public"."party_branch_profiles"
  add column if not exists "payment_term_id" uuid references "public"."payment_terms"("id") on delete set null;

update "public"."party_branch_profiles" as "profiles"
set "payment_term_id" = "terms"."id"
from "public"."payment_terms" as "terms"
where "profiles"."payment_term_id" is null
  and "profiles"."payment_term" is not null
  and "terms"."business_id" = "profiles"."business_id"
  and "terms"."code" = "profiles"."payment_term";

create index if not exists "party_branch_profiles_payment_term_id_idx"
  on "public"."party_branch_profiles" ("payment_term_id");

update "public"."party_gst_registrations" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_tax_identifiers" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_addresses" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_contacts" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_bank_accounts" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_customer_profiles" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_supplier_profiles" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_accounting_profiles" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

delete from "public"."party_branch_profiles" as "profile"
using "public"."parties" as "party"
where "profile"."party_id" = "party"."id"
  and not exists (
    select 1
    from "public"."business_branches" as "branch"
    where "branch"."id" = "profile"."branch_id"
      and "branch"."business_id" = "party"."business_id"
  );

update "public"."party_branch_profiles" as "child"
set "business_id" = "party"."business_id",
    "updated_at" = now()
from "public"."parties" as "party"
where "child"."party_id" = "party"."id"
  and "child"."business_id" <> "party"."business_id";

update "public"."party_customer_profiles" as "profile"
set "default_payment_term_id" = null,
    "updated_at" = now()
where "default_payment_term_id" is not null
  and not exists (
    select 1
    from "public"."payment_terms" as "term"
    where "term"."id" = "profile"."default_payment_term_id"
      and "term"."business_id" = "profile"."business_id"
  );

update "public"."party_customer_profiles" as "profile"
set "default_billing_address_id" = null,
    "updated_at" = now()
where "default_billing_address_id" is not null
  and not exists (
    select 1
    from "public"."party_addresses" as "address"
    where "address"."id" = "profile"."default_billing_address_id"
      and "address"."party_id" = "profile"."party_id"
      and "address"."business_id" = "profile"."business_id"
  );

update "public"."party_customer_profiles" as "profile"
set "default_shipping_address_id" = null,
    "updated_at" = now()
where "default_shipping_address_id" is not null
  and not exists (
    select 1
    from "public"."party_addresses" as "address"
    where "address"."id" = "profile"."default_shipping_address_id"
      and "address"."party_id" = "profile"."party_id"
      and "address"."business_id" = "profile"."business_id"
  );

update "public"."party_customer_profiles" as "profile"
set "default_gst_registration_id" = null,
    "updated_at" = now()
where "default_gst_registration_id" is not null
  and not exists (
    select 1
    from "public"."party_gst_registrations" as "gst"
    where "gst"."id" = "profile"."default_gst_registration_id"
      and "gst"."party_id" = "profile"."party_id"
      and "gst"."business_id" = "profile"."business_id"
  );

update "public"."party_supplier_profiles" as "profile"
set "default_payment_term_id" = null,
    "updated_at" = now()
where "default_payment_term_id" is not null
  and not exists (
    select 1
    from "public"."payment_terms" as "term"
    where "term"."id" = "profile"."default_payment_term_id"
      and "term"."business_id" = "profile"."business_id"
  );

update "public"."party_supplier_profiles" as "profile"
set "default_purchase_address_id" = null,
    "updated_at" = now()
where "default_purchase_address_id" is not null
  and not exists (
    select 1
    from "public"."party_addresses" as "address"
    where "address"."id" = "profile"."default_purchase_address_id"
      and "address"."party_id" = "profile"."party_id"
      and "address"."business_id" = "profile"."business_id"
  );

update "public"."party_supplier_profiles" as "profile"
set "default_gst_registration_id" = null,
    "updated_at" = now()
where "default_gst_registration_id" is not null
  and not exists (
    select 1
    from "public"."party_gst_registrations" as "gst"
    where "gst"."id" = "profile"."default_gst_registration_id"
      and "gst"."party_id" = "profile"."party_id"
      and "gst"."business_id" = "profile"."business_id"
  );

update "public"."party_supplier_profiles" as "profile"
set "preferred_warehouse_id" = null,
    "updated_at" = now()
where "preferred_warehouse_id" is not null
  and not exists (
    select 1
    from "public"."warehouses" as "warehouse"
    where "warehouse"."id" = "profile"."preferred_warehouse_id"
      and "warehouse"."business_id" = "profile"."business_id"
  );

update "public"."party_accounting_profiles" as "profile"
set "receivable_account_id" = null,
    "updated_at" = now()
where "receivable_account_id" is not null
  and not exists (
    select 1
    from "public"."ledger_accounts" as "account"
    where "account"."id" = "profile"."receivable_account_id"
      and "account"."business_id" = "profile"."business_id"
  );

update "public"."party_accounting_profiles" as "profile"
set "payable_account_id" = null,
    "updated_at" = now()
where "payable_account_id" is not null
  and not exists (
    select 1
    from "public"."ledger_accounts" as "account"
    where "account"."id" = "profile"."payable_account_id"
      and "account"."business_id" = "profile"."business_id"
  );

update "public"."party_accounting_profiles" as "profile"
set "advance_receipt_account_id" = null,
    "updated_at" = now()
where "advance_receipt_account_id" is not null
  and not exists (
    select 1
    from "public"."ledger_accounts" as "account"
    where "account"."id" = "profile"."advance_receipt_account_id"
      and "account"."business_id" = "profile"."business_id"
  );

update "public"."party_accounting_profiles" as "profile"
set "advance_payment_account_id" = null,
    "updated_at" = now()
where "advance_payment_account_id" is not null
  and not exists (
    select 1
    from "public"."ledger_accounts" as "account"
    where "account"."id" = "profile"."advance_payment_account_id"
      and "account"."business_id" = "profile"."business_id"
  );

update "public"."party_branch_profiles" as "profile"
set "payment_term_id" = null,
    "updated_at" = now()
where "payment_term_id" is not null
  and not exists (
    select 1
    from "public"."payment_terms" as "term"
    where "term"."id" = "profile"."payment_term_id"
      and "term"."business_id" = "profile"."business_id"
  );

update "public"."party_branch_profiles" as "profile"
set "default_address_id" = null,
    "updated_at" = now()
where "default_address_id" is not null
  and not exists (
    select 1
    from "public"."party_addresses" as "address"
    where "address"."id" = "profile"."default_address_id"
      and "address"."party_id" = "profile"."party_id"
      and "address"."business_id" = "profile"."business_id"
  );

create unique index if not exists "parties_id_business_id_unique"
  on "public"."parties" ("id", "business_id");

create unique index if not exists "business_branches_id_business_id_unique"
  on "public"."business_branches" ("id", "business_id");

create unique index if not exists "warehouses_id_business_id_unique"
  on "public"."warehouses" ("id", "business_id");

create unique index if not exists "ledger_accounts_id_business_id_unique"
  on "public"."ledger_accounts" ("id", "business_id");

create unique index if not exists "payment_terms_id_business_id_unique"
  on "public"."payment_terms" ("id", "business_id");

create unique index if not exists "party_gst_registrations_id_business_id_unique"
  on "public"."party_gst_registrations" ("id", "business_id");

create unique index if not exists "party_gst_registrations_id_party_business_unique"
  on "public"."party_gst_registrations" ("id", "party_id", "business_id");

create unique index if not exists "party_addresses_id_business_id_unique"
  on "public"."party_addresses" ("id", "business_id");

create unique index if not exists "party_addresses_id_party_business_unique"
  on "public"."party_addresses" ("id", "party_id", "business_id");

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'party_gst_registrations_party_business_fk') then
    alter table "public"."party_gst_registrations"
      add constraint "party_gst_registrations_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_tax_identifiers_party_business_fk') then
    alter table "public"."party_tax_identifiers"
      add constraint "party_tax_identifiers_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_addresses_party_business_fk') then
    alter table "public"."party_addresses"
      add constraint "party_addresses_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_contacts_party_business_fk') then
    alter table "public"."party_contacts"
      add constraint "party_contacts_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_bank_accounts_party_business_fk') then
    alter table "public"."party_bank_accounts"
      add constraint "party_bank_accounts_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_customer_profiles_party_business_fk') then
    alter table "public"."party_customer_profiles"
      add constraint "party_customer_profiles_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_customer_profiles_payment_term_business_fk') then
    alter table "public"."party_customer_profiles"
      add constraint "party_customer_profiles_payment_term_business_fk"
      foreign key ("default_payment_term_id", "business_id")
      references "public"."payment_terms"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_customer_profiles_billing_address_party_business_fk') then
    alter table "public"."party_customer_profiles"
      add constraint "party_customer_profiles_billing_address_party_business_fk"
      foreign key ("default_billing_address_id", "party_id", "business_id")
      references "public"."party_addresses"("id", "party_id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_customer_profiles_shipping_address_party_business_fk') then
    alter table "public"."party_customer_profiles"
      add constraint "party_customer_profiles_shipping_address_party_business_fk"
      foreign key ("default_shipping_address_id", "party_id", "business_id")
      references "public"."party_addresses"("id", "party_id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_customer_profiles_gst_registration_party_business_fk') then
    alter table "public"."party_customer_profiles"
      add constraint "party_customer_profiles_gst_registration_party_business_fk"
      foreign key ("default_gst_registration_id", "party_id", "business_id")
      references "public"."party_gst_registrations"("id", "party_id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_supplier_profiles_party_business_fk') then
    alter table "public"."party_supplier_profiles"
      add constraint "party_supplier_profiles_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_supplier_profiles_payment_term_business_fk') then
    alter table "public"."party_supplier_profiles"
      add constraint "party_supplier_profiles_payment_term_business_fk"
      foreign key ("default_payment_term_id", "business_id")
      references "public"."payment_terms"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_supplier_profiles_purchase_address_party_business_fk') then
    alter table "public"."party_supplier_profiles"
      add constraint "party_supplier_profiles_purchase_address_party_business_fk"
      foreign key ("default_purchase_address_id", "party_id", "business_id")
      references "public"."party_addresses"("id", "party_id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_supplier_profiles_gst_registration_party_business_fk') then
    alter table "public"."party_supplier_profiles"
      add constraint "party_supplier_profiles_gst_registration_party_business_fk"
      foreign key ("default_gst_registration_id", "party_id", "business_id")
      references "public"."party_gst_registrations"("id", "party_id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_supplier_profiles_preferred_warehouse_business_fk') then
    alter table "public"."party_supplier_profiles"
      add constraint "party_supplier_profiles_preferred_warehouse_business_fk"
      foreign key ("preferred_warehouse_id", "business_id")
      references "public"."warehouses"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_accounting_profiles_party_business_fk') then
    alter table "public"."party_accounting_profiles"
      add constraint "party_accounting_profiles_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_accounting_profiles_receivable_account_business_fk') then
    alter table "public"."party_accounting_profiles"
      add constraint "party_accounting_profiles_receivable_account_business_fk"
      foreign key ("receivable_account_id", "business_id")
      references "public"."ledger_accounts"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_accounting_profiles_payable_account_business_fk') then
    alter table "public"."party_accounting_profiles"
      add constraint "party_accounting_profiles_payable_account_business_fk"
      foreign key ("payable_account_id", "business_id")
      references "public"."ledger_accounts"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_accounting_profiles_advance_receipt_account_business_fk') then
    alter table "public"."party_accounting_profiles"
      add constraint "party_accounting_profiles_advance_receipt_account_business_fk"
      foreign key ("advance_receipt_account_id", "business_id")
      references "public"."ledger_accounts"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_accounting_profiles_advance_payment_account_business_fk') then
    alter table "public"."party_accounting_profiles"
      add constraint "party_accounting_profiles_advance_payment_account_business_fk"
      foreign key ("advance_payment_account_id", "business_id")
      references "public"."ledger_accounts"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_branch_profiles_party_business_fk') then
    alter table "public"."party_branch_profiles"
      add constraint "party_branch_profiles_party_business_fk"
      foreign key ("party_id", "business_id")
      references "public"."parties"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_branch_profiles_branch_business_fk') then
    alter table "public"."party_branch_profiles"
      add constraint "party_branch_profiles_branch_business_fk"
      foreign key ("branch_id", "business_id")
      references "public"."business_branches"("id", "business_id")
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_branch_profiles_payment_term_business_fk') then
    alter table "public"."party_branch_profiles"
      add constraint "party_branch_profiles_payment_term_business_fk"
      foreign key ("payment_term_id", "business_id")
      references "public"."payment_terms"("id", "business_id");
  end if;

  if not exists (select 1 from pg_constraint where conname = 'party_branch_profiles_default_address_party_business_fk') then
    alter table "public"."party_branch_profiles"
      add constraint "party_branch_profiles_default_address_party_business_fk"
      foreign key ("default_address_id", "party_id", "business_id")
      references "public"."party_addresses"("id", "party_id", "business_id");
  end if;
end $$;
