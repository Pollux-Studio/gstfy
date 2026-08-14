create table if not exists public.ca_client_invites (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ca_practices(id) on delete cascade,
  client_name text not null,
  client_email text,
  client_gstin text,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_business_id uuid references public.businesses(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ca_client_invites_practice_id_idx
  on public.ca_client_invites (practice_id);

create unique index if not exists ca_client_invites_referral_code_unique
  on public.ca_client_invites (referral_code);

drop trigger if exists set_ca_client_invites_updated_at on public.ca_client_invites;
create trigger set_ca_client_invites_updated_at
before update on public.ca_client_invites
for each row execute function public.set_updated_at();

create table if not exists public.ca_business_links (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ca_practices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  access_scope text not null default 'gst_read_write' check (access_scope in ('gst_read_write')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ca_business_links_practice_business_unique
  on public.ca_business_links (practice_id, business_id);

create index if not exists ca_business_links_practice_id_idx
  on public.ca_business_links (practice_id);

create index if not exists ca_business_links_business_id_idx
  on public.ca_business_links (business_id);

drop trigger if exists set_ca_business_links_updated_at on public.ca_business_links;
create trigger set_ca_business_links_updated_at
before update on public.ca_business_links
for each row execute function public.set_updated_at();
