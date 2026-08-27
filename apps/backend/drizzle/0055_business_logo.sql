alter table public.business_profiles
  add column if not exists logo_object_key text,
  add column if not exists logo_public_url text,
  add column if not exists logo_file_name text,
  add column if not exists logo_content_type text,
  add column if not exists logo_file_size_bytes integer,
  add column if not exists logo_uploaded_at timestamptz;

create unique index if not exists business_profiles_logo_object_key_unique
  on public.business_profiles (logo_object_key)
  where logo_object_key is not null;
