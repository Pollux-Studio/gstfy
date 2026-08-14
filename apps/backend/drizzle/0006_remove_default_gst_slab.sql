alter table public.business_preferences
  drop column if exists default_gst_slab,
  drop column if exists cgst_rate_bps,
  drop column if exists sgst_rate_bps;
