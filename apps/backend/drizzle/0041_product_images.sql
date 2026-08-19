create table if not exists public.item_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid,
  object_key text not null,
  public_url text not null,
  file_name text,
  content_type text not null,
  file_size_bytes integer not null,
  width integer,
  height integer,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'ACTIVE',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_images_item_business_fk
    foreign key (item_id, business_id)
    references public.items(id, business_id)
    on delete cascade
);

create index if not exists item_images_business_id_idx
  on public.item_images(business_id);

create index if not exists item_images_item_id_idx
  on public.item_images(item_id);

create index if not exists item_images_status_idx
  on public.item_images(status);

create unique index if not exists item_images_object_key_unique
  on public.item_images(object_key);

create unique index if not exists item_images_id_business_id_unique
  on public.item_images(id, business_id);

create unique index if not exists item_images_primary_active_unique
  on public.item_images(business_id, item_id)
  where is_primary = true and status = 'ACTIVE' and item_id is not null;
