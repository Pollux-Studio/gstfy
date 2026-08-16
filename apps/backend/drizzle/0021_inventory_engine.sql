alter table public.inventory_transactions
  alter column voucher_id drop not null,
  add column if not exists source_type text not null default 'VOUCHER',
  add column if not exists source_id text;

update public.inventory_transactions
set source_type = 'VOUCHER',
    source_id = coalesce(source_id, voucher_id::text)
where voucher_id is not null;

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  destination_warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  branch_id uuid references public.business_branches(id) on delete set null,
  status text not null default 'DRAFT',
  transfer_date text not null,
  reference_number text,
  notes text,
  dispatched_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_transfers_status_check
    check (status in ('DRAFT', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
  constraint stock_transfers_different_warehouses_check
    check (source_warehouse_id <> destination_warehouse_id)
);

create index if not exists stock_transfers_business_id_idx
  on public.stock_transfers(business_id);
create index if not exists stock_transfers_source_warehouse_id_idx
  on public.stock_transfers(source_warehouse_id);
create index if not exists stock_transfers_destination_warehouse_id_idx
  on public.stock_transfers(destination_warehouse_id);

create table if not exists public.stock_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  item_id text not null,
  item_name_snapshot text not null,
  sku_snapshot text,
  quantity numeric(14, 3) not null,
  unit text not null default 'PCS',
  unit_cost numeric(14, 2) not null default 0,
  batch_id text,
  serial_id text,
  created_at timestamptz not null default now(),
  constraint stock_transfer_lines_quantity_positive_check
    check (quantity > 0)
);

create index if not exists stock_transfer_lines_transfer_id_idx
  on public.stock_transfer_lines(transfer_id);
create index if not exists stock_transfer_lines_item_id_idx
  on public.stock_transfer_lines(business_id, item_id);

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id text not null,
  batch_number text not null,
  manufacturing_date text,
  expiry_date text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_batches_status_check
    check (status in ('ACTIVE', 'EXPIRED', 'BLOCKED', 'CONSUMED'))
);

create index if not exists inventory_batches_business_id_idx
  on public.inventory_batches(business_id);
create unique index if not exists inventory_batches_business_item_number_unique
  on public.inventory_batches(business_id, item_id, batch_number);

create table if not exists public.inventory_serial_numbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id text not null,
  serial_number text not null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  source_transaction_id uuid references public.inventory_transactions(id) on delete set null,
  status text not null default 'IN_STOCK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_serial_numbers_status_check
    check (status in ('IN_STOCK', 'SOLD', 'RETURNED', 'DAMAGED', 'TRANSFERRED'))
);

create index if not exists inventory_serial_numbers_business_id_idx
  on public.inventory_serial_numbers(business_id);
create unique index if not exists inventory_serial_numbers_business_serial_unique
  on public.inventory_serial_numbers(business_id, serial_number);
