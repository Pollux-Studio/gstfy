alter table "public"."party_gst_registrations"
  add column if not exists "registered_address_id" uuid;

create index if not exists "party_gst_registrations_registered_address_id_idx"
  on "public"."party_gst_registrations" ("registered_address_id");

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'party_gst_registrations_registered_address_party_business_fk'
  ) then
    alter table "public"."party_gst_registrations"
      add constraint "party_gst_registrations_registered_address_party_business_fk"
      foreign key ("registered_address_id", "party_id", "business_id")
      references "public"."party_addresses"("id", "party_id", "business_id")
      on delete restrict;
  end if;
end $$;
