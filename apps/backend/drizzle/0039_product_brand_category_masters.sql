create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_brands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_categories_business_lower_name_unique
  on public.product_categories (business_id, lower(name));

create unique index if not exists product_brands_business_lower_name_unique
  on public.product_brands (business_id, lower(name));

create index if not exists product_categories_business_id_idx
  on public.product_categories (business_id);

create index if not exists product_brands_business_id_idx
  on public.product_brands (business_id);

insert into public.product_categories (business_id, name, status)
select distinct business_id, trim(category_id), 'active'
from public.items
where category_id is not null and trim(category_id) <> ''
on conflict do nothing;

insert into public.product_brands (business_id, name, status)
select distinct business_id, trim(brand_id), 'active'
from public.items
where brand_id is not null and trim(brand_id) <> ''
on conflict do nothing;
