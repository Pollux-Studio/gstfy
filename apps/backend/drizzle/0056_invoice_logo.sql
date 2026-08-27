alter table public.business_preferences
  add column if not exists invoice_logo_object_key text,
  add column if not exists invoice_logo_public_url text,
  add column if not exists invoice_logo_file_name text,
  add column if not exists invoice_logo_content_type text,
  add column if not exists invoice_logo_file_size_bytes integer,
  add column if not exists invoice_logo_uploaded_at timestamptz;

create unique index if not exists business_preferences_invoice_logo_object_key_unique
  on public.business_preferences (invoice_logo_object_key)
  where invoice_logo_object_key is not null;
