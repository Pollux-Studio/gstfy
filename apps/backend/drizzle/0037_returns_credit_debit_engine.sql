create table if not exists public.adjustment_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  voucher_id uuid references public.vouchers(id) on delete set null,
  adjustment_number text not null,
  adjustment_type text not null,
  original_voucher_id uuid not null references public.vouchers(id) on delete restrict,
  source_document_id uuid,
  source_document_type text not null,
  party_id uuid references public.parties(id) on delete set null,
  branch_id uuid references public.business_branches(id) on delete set null,
  gst_registration_id uuid references public.gst_registrations(id) on delete set null,
  adjustment_date date not null,
  reason_code text,
  reason text,
  status text not null default 'draft',
  issuer_type text not null default 'GSTFY_BUSINESS',
  document_direction text not null default 'outgoing',
  source_party_role text,
  adjustment_context text not null default 'goods_related',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_total numeric(14,2) not null default 0,
  cgst_total numeric(14,2) not null default 0,
  sgst_total numeric(14,2) not null default 0,
  igst_total numeric(14,2) not null default 0,
  cess_total numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  party_snapshot jsonb,
  source_snapshot jsonb,
  tax_snapshot jsonb,
  created_by uuid references public.users(id) on delete set null,
  posted_by uuid references public.users(id) on delete set null,
  reversed_by uuid references public.users(id) on delete set null,
  posted_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adjustment_documents_type_check
    check (adjustment_type in ('SALES_RETURN', 'PURCHASE_RETURN', 'CREDIT_NOTE', 'DEBIT_NOTE')),
  constraint adjustment_documents_status_check
    check (status in ('draft', 'posted', 'reversed')),
  constraint adjustment_documents_source_type_check
    check (source_document_type in ('sales_invoice', 'purchase_bill')),
  constraint adjustment_documents_amount_non_negative_check
    check (
      subtotal >= 0 and discount_total >= 0 and taxable_total >= 0 and
      cgst_total >= 0 and sgst_total >= 0 and igst_total >= 0 and
      cess_total >= 0 and grand_total >= 0
    )
);

create unique index if not exists adjustment_documents_business_number_unique
  on public.adjustment_documents(business_id, adjustment_number);

create unique index if not exists adjustment_documents_id_business_id_unique
  on public.adjustment_documents(id, business_id);

create index if not exists adjustment_documents_business_id_idx
  on public.adjustment_documents(business_id);

create index if not exists adjustment_documents_type_status_idx
  on public.adjustment_documents(business_id, adjustment_type, status);

create index if not exists adjustment_documents_original_voucher_idx
  on public.adjustment_documents(business_id, original_voucher_id);

create table if not exists public.adjustment_document_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  adjustment_document_id uuid not null references public.adjustment_documents(id) on delete cascade,
  original_line_id uuid,
  original_line_type text,
  item_id uuid references public.items(id) on delete set null,
  description_snapshot text not null,
  sku_snapshot text,
  hsn_sac_snapshot text,
  uqc_snapshot text,
  quantity numeric(14,3) not null default 0,
  unit text not null default 'PCS',
  rate numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  taxable_value numeric(14,2) not null default 0,
  tax_profile_snapshot jsonb,
  gst_rate_snapshot numeric(5,2) not null default 0,
  cgst_rate numeric(5,2) not null default 0,
  sgst_rate numeric(5,2) not null default 0,
  igst_rate numeric(5,2) not null default 0,
  cess_rule_snapshot jsonb,
  cgst_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  cess_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  inventory_effect text not null default 'NONE',
  inventory_warehouse_id uuid references public.warehouses(id) on delete set null,
  batch_id text,
  serial_id text,
  reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint adjustment_document_lines_original_type_check
    check (original_line_type is null or original_line_type in ('sales_invoice_line', 'purchase_bill_line')),
  constraint adjustment_document_lines_inventory_effect_check
    check (inventory_effect in ('STOCK_IN', 'STOCK_OUT', 'NONE')),
  constraint adjustment_document_lines_amount_non_negative_check
    check (
      quantity >= 0 and rate >= 0 and discount >= 0 and taxable_value >= 0 and
      cgst_amount >= 0 and sgst_amount >= 0 and igst_amount >= 0 and
      cess_amount >= 0 and line_total >= 0
    )
);

create index if not exists adjustment_document_lines_document_id_idx
  on public.adjustment_document_lines(adjustment_document_id);

create index if not exists adjustment_document_lines_original_line_idx
  on public.adjustment_document_lines(business_id, original_line_id, original_line_type);

create unique index if not exists items_id_business_id_unique
  on public.items(id, business_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_voucher_business_fk') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_voucher_business_fk
      foreign key (voucher_id, business_id)
      references public.vouchers(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_original_voucher_business_fk') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_original_voucher_business_fk
      foreign key (original_voucher_id, business_id)
      references public.vouchers(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_party_business_fk') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_party_business_fk
      foreign key (party_id, business_id)
      references public.parties(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_branch_business_fk') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_branch_business_fk
      foreign key (branch_id, business_id)
      references public.business_branches(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_gst_registration_business_fk') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_gst_registration_business_fk
      foreign key (gst_registration_id, business_id)
      references public.gst_registrations(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_document_lines_document_business_fk') then
    alter table public.adjustment_document_lines
      add constraint adjustment_document_lines_document_business_fk
      foreign key (adjustment_document_id, business_id)
      references public.adjustment_documents(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_document_lines_item_business_fk') then
    alter table public.adjustment_document_lines
      add constraint adjustment_document_lines_item_business_fk
      foreign key (item_id, business_id)
      references public.items(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_document_lines_warehouse_business_fk') then
    alter table public.adjustment_document_lines
      add constraint adjustment_document_lines_warehouse_business_fk
      foreign key (inventory_warehouse_id, business_id)
      references public.warehouses(id, business_id);
  end if;
end $$;
