-- Prevent accidental hard deletion of historical party master data.
-- Application behavior remains soft archive; database hard deletes are restricted.

do $$
declare
  table_name text;
  fk_record record;
  child_tables text[] := array[
    'party_gst_registrations',
    'party_tax_identifiers',
    'party_addresses',
    'party_contacts',
    'party_bank_accounts',
    'party_customer_profiles',
    'party_supplier_profiles',
    'party_accounting_profiles',
    'party_branch_profiles'
  ];
begin
  foreach table_name in array child_tables loop
    for fk_record in
      select conname
      from pg_constraint
      where contype = 'f'
        and conrelid = format('public.%I', table_name)::regclass
        and confrelid = 'public.parties'::regclass
    loop
      execute format(
        'alter table public.%I drop constraint %I',
        table_name,
        fk_record.conname
      );
    end loop;
  end loop;
end $$;

alter table "public"."party_gst_registrations"
  add constraint "party_gst_registrations_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_gst_registrations"
  add constraint "party_gst_registrations_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_tax_identifiers"
  add constraint "party_tax_identifiers_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_tax_identifiers"
  add constraint "party_tax_identifiers_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_addresses"
  add constraint "party_addresses_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_addresses"
  add constraint "party_addresses_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_contacts"
  add constraint "party_contacts_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_contacts"
  add constraint "party_contacts_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_bank_accounts"
  add constraint "party_bank_accounts_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_bank_accounts"
  add constraint "party_bank_accounts_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_customer_profiles"
  add constraint "party_customer_profiles_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_customer_profiles"
  add constraint "party_customer_profiles_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_supplier_profiles"
  add constraint "party_supplier_profiles_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_supplier_profiles"
  add constraint "party_supplier_profiles_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_accounting_profiles"
  add constraint "party_accounting_profiles_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_accounting_profiles"
  add constraint "party_accounting_profiles_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;

alter table "public"."party_branch_profiles"
  add constraint "party_branch_profiles_party_id_fkey"
  foreign key ("party_id")
  references "public"."parties"("id")
  on delete restrict;

alter table "public"."party_branch_profiles"
  add constraint "party_branch_profiles_party_business_fk"
  foreign key ("party_id", "business_id")
  references "public"."parties"("id", "business_id")
  on delete restrict;
