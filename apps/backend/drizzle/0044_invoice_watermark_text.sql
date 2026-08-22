alter table public.business_preferences
  add column if not exists invoice_watermark_text text not null default 'GSTFY';
