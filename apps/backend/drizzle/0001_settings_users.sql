create table if not exists public.business_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  gstin text,
  business_email text,
  business_mobile text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_mobile text,
  address_line_1 text,
  address_line_2 text,
  locality text,
  district text,
  pincode text,
  state_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_preferences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  invoice_template text not null default 'standard',
  invoice_prefix text not null default 'INV',
  invoice_next_number integer not null default 1,
  cgst_rate_bps integer not null default 900,
  sgst_rate_bps integer not null default 900,
  printer_paper_size text not null default 'a4',
  printer_copies integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_member_permissions (
  id uuid primary key default gen_random_uuid(),
  business_member_id uuid not null references public.business_members(id) on delete cascade,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_member_id, module)
);

drop trigger if exists set_business_profiles_updated_at on public.business_profiles;
create trigger set_business_profiles_updated_at
  before update on public.business_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_business_preferences_updated_at on public.business_preferences;
create trigger set_business_preferences_updated_at
  before update on public.business_preferences
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_business_member_permissions_updated_at on public.business_member_permissions;
create trigger set_business_member_permissions_updated_at
  before update on public.business_member_permissions
  for each row execute procedure public.set_updated_at();
