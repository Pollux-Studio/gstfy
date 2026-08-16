alter table public.inventory_transactions
  add column if not exists sku_snapshot text,
  add column if not exists unit_snapshot text,
  add column if not exists quantity_in numeric(14, 3) not null default 0,
  add column if not exists quantity_out numeric(14, 3) not null default 0,
  add column if not exists source_unit text,
  add column if not exists base_quantity numeric(14, 3) not null default 0,
  add column if not exists inventory_value numeric(14, 2) not null default 0,
  add column if not exists batch_id text,
  add column if not exists serial_id text,
  add column if not exists batch_number_snapshot text,
  add column if not exists serial_number_snapshot text,
  add column if not exists transaction_date text not null default '1970-01-01',
  add column if not exists reason text,
  add column if not exists created_by uuid references public.users(id) on delete set null;

update public.inventory_transactions
set
  quantity_in = case
    when quantity >= 0
      and movement_type in ('OPENING_STOCK', 'PURCHASE', 'SALES_RETURN', 'TRANSFER_IN', 'ADJUSTMENT_IN')
      then quantity
    when quantity > 0 and movement_type = 'ADJUSTMENT'
      then quantity
    when quantity > 0 and quantity_in = 0 and quantity_out = 0
      then quantity
    else quantity_in
  end,
  quantity_out = case
    when quantity >= 0
      and movement_type in ('SALE', 'PURCHASE_RETURN', 'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY')
      then quantity
    when quantity < 0
      then abs(quantity)
    else quantity_out
  end,
  base_quantity = case
    when base_quantity = 0 then abs(quantity)
    else base_quantity
  end,
  source_unit = coalesce(source_unit, unit),
  unit_snapshot = coalesce(unit_snapshot, unit),
  inventory_value = case
    when inventory_value = 0 then coalesce(total_cost, 0)
    else inventory_value
  end,
  transaction_date = case
    when transaction_date = '1970-01-01' then coalesce(v.voucher_date, transaction_date)
    else transaction_date
  end,
  created_by = coalesce(public.inventory_transactions.created_by, v.posted_by, v.created_by)
from public.vouchers v
where public.inventory_transactions.voucher_id = v.id;

create index if not exists inventory_transactions_item_warehouse_idx
  on public.inventory_transactions (
    business_id,
    item_id,
    warehouse_id,
    transaction_date
  );

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id text not null,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  quantity_on_hand numeric(14, 3) not null default 0,
  inventory_value numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists inventory_balances_business_id_idx
  on public.inventory_balances(business_id);

create index if not exists inventory_balances_warehouse_id_idx
  on public.inventory_balances(warehouse_id);

create unique index if not exists inventory_balances_item_warehouse_unique
  on public.inventory_balances(business_id, item_id, warehouse_id);

insert into public.inventory_balances (
  business_id,
  item_id,
  warehouse_id,
  quantity_on_hand,
  inventory_value,
  updated_at
)
select
  business_id,
  item_id,
  warehouse_id,
  sum(quantity_in - quantity_out) as quantity_on_hand,
  sum(
    case
      when quantity_in > 0 then inventory_value
      when quantity_out > 0 then -inventory_value
      else 0
    end
  ) as inventory_value,
  now()
from public.inventory_transactions
where item_id is not null
  and warehouse_id is not null
group by business_id, item_id, warehouse_id
on conflict (business_id, item_id, warehouse_id)
do update set
  quantity_on_hand = excluded.quantity_on_hand,
  inventory_value = excluded.inventory_value,
  updated_at = now();

create table if not exists public.business_inventory_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  negative_stock_policy text not null default 'WARN',
  valuation_method text not null default 'WEIGHTED_AVERAGE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_inventory_settings_negative_stock_policy_check
    check (negative_stock_policy in ('ALLOW', 'WARN', 'BLOCK')),
  constraint business_inventory_settings_valuation_method_check
    check (valuation_method in ('WEIGHTED_AVERAGE', 'FIFO'))
);

insert into public.business_inventory_settings (business_id)
select id
from public.businesses
on conflict (business_id) do nothing;

create table if not exists public.inventory_cost_layers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id text not null,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  source_transaction_id uuid references public.inventory_transactions(id) on delete set null,
  quantity_remaining numeric(14, 3) not null default 0,
  unit_cost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists inventory_cost_layers_business_id_idx
  on public.inventory_cost_layers(business_id);

create index if not exists inventory_cost_layers_item_warehouse_idx
  on public.inventory_cost_layers(business_id, item_id, warehouse_id);
