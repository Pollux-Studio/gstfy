alter table public.item_prices
  add column if not exists margin_percent numeric(8,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'item_prices_margin_percent_non_negative'
      and conrelid = 'public.item_prices'::regclass
  ) then
    alter table public.item_prices
      add constraint item_prices_margin_percent_non_negative
      check (margin_percent >= 0);
  end if;
end $$;
