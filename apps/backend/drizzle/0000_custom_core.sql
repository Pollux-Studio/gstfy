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

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone_e164 text unique,
  password_hash text,
  full_name text,
  locale text not null default 'en',
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone_e164 is not null)
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null unique,
  legal_name text not null,
  trade_name text not null,
  pan text not null,
  constitution text not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'suspended')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_pan_idx on public.businesses (pan);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null
    check (role in ('owner', 'admin', 'staff', 'accountant', 'cashier')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.ca_practices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  practice_name text not null,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  contact_email text,
  contact_phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.ca_practice_members (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ca_practices(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (practice_id, user_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_business_members_updated_at on public.business_members;
create trigger set_business_members_updated_at
  before update on public.business_members
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_ca_practices_updated_at on public.ca_practices;
create trigger set_ca_practices_updated_at
  before update on public.ca_practices
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_ca_practice_members_updated_at on public.ca_practice_members;
create trigger set_ca_practice_members_updated_at
  before update on public.ca_practice_members
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
  before update on public.sessions
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_email_verification_tokens_updated_at on public.email_verification_tokens;
create trigger set_email_verification_tokens_updated_at
  before update on public.email_verification_tokens
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_password_reset_tokens_updated_at on public.password_reset_tokens;
create trigger set_password_reset_tokens_updated_at
  before update on public.password_reset_tokens
  for each row execute procedure public.set_updated_at();
