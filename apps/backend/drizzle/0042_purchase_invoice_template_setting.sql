alter table public.business_preferences
  add column if not exists purchase_invoice_template text not null default 'reference-01';

update public.business_preferences
set
  invoice_template = case
    when invoice_template = 'standard' then 'reference-01'
    when invoice_template = 'classic' then 'reference-01'
    when invoice_template = 'modern' then 'reference-02'
    when invoice_template in ('compact', 'thermal') then 'reference-03'
    when invoice_template ~ '^reference-0[1-8]$' then invoice_template
    else 'reference-01'
  end,
  purchase_invoice_template = case
    when purchase_invoice_template = 'standard' then 'reference-01'
    when purchase_invoice_template = 'classic' then 'reference-01'
    when purchase_invoice_template = 'modern' then 'reference-02'
    when purchase_invoice_template in ('compact', 'thermal') then 'reference-03'
    when purchase_invoice_template ~ '^reference-0[1-8]$' then purchase_invoice_template
    else 'reference-01'
  end;
