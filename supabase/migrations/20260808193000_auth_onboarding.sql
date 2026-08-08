create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_identifier_type text check (auth_identifier_type in ('email', 'phone')),
  email text,
  phone_e164 text,
  display_name text,
  locale text not null default 'en',
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'completed')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone_e164)
  where phone_e164 is not null;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text not null,
  pan char(10) not null,
  constitution text not null,
  business_email text,
  business_phone text,
  primary_contact_name text not null,
  primary_contact_mobile text not null,
  primary_contact_email text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_gst_registrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gstin char(15) not null unique,
  taxpayer_type text not null,
  registration_date date not null,
  principal_address_line_1 text not null,
  principal_address_line_2 text,
  locality text not null,
  district text not null,
  pincode char(6) not null,
  state_code char(2) not null,
  possession_type text not null,
  location_source text not null default 'manual' check (location_source in ('manual', 'browser_geolocation')),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_primary_gst_unique_idx
  on public.business_gst_registrations (business_id)
  where is_primary = true;

create table if not exists public.user_business_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff', 'accountant', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    auth_identifier_type,
    email,
    phone_e164
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'auth_identifier_type',
    new.email,
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_business_gst_registrations_updated_at on public.business_gst_registrations;
create trigger set_business_gst_registrations_updated_at
  before update on public.business_gst_registrations
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_gst_registrations enable row level security;
alter table public.user_business_roles enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "businesses_select_member"
  on public.businesses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = businesses.id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
    )
  );

create policy "businesses_update_owner_admin"
  on public.businesses
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = businesses.id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
        and ubr.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = businesses.id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
        and ubr.role in ('owner', 'admin')
    )
  );

create policy "gst_registrations_select_member"
  on public.business_gst_registrations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = business_gst_registrations.business_id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
    )
  );

create policy "gst_registrations_update_owner_admin"
  on public.business_gst_registrations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = business_gst_registrations.business_id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
        and ubr.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = business_gst_registrations.business_id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
        and ubr.role in ('owner', 'admin')
    )
  );

create policy "user_business_roles_select_visible_memberships"
  on public.user_business_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.user_business_roles owner_role
      where owner_role.business_id = user_business_roles.business_id
        and owner_role.user_id = (select auth.uid())
        and owner_role.status = 'active'
        and owner_role.role in ('owner', 'admin')
    )
  );

create policy "audit_logs_select_owner_admin"
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_business_roles ubr
      where ubr.business_id = audit_logs.business_id
        and ubr.user_id = (select auth.uid())
        and ubr.status = 'active'
        and ubr.role in ('owner', 'admin')
    )
  );
