alter table public.users
  add column if not exists profile_image_seed text,
  add column if not exists profile_image_url text;
