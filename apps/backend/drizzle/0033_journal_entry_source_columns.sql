alter table public.journal_entries
  add column if not exists source_type text not null default 'VOUCHER',
  add column if not exists source_id text;

update public.journal_entries
set source_type = 'VOUCHER',
    source_id = coalesce(source_id, voucher_id::text)
where source_id is null;
