alter table public.business_profiles
  add column if not exists taxpayer_type text,
  add column if not exists registration_date text,
  add column if not exists possession_type text,
  add column if not exists location_source text not null default 'manual';

alter table public.business_preferences
  add column if not exists default_gst_slab integer not null default 18,
  add column if not exists enabled_gst_slabs text not null default '5,12,18,28',
  add column if not exists print_orientation text not null default 'portrait',
  add column if not exists auto_open_print_dialog boolean not null default true,
  add column if not exists compact_print_layout boolean not null default false;
