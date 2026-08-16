create table if not exists public.hsn_sac_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  code_type text not null,
  description text not null,
  status text not null default 'active',
  effective_from text,
  effective_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hsn_sac_codes_code_type_idx
  on public.hsn_sac_codes(code_type);

create table if not exists public.uqc_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  item_type text not null,
  sku text not null,
  description text,
  category_id text,
  brand_id text,
  manufacturer text,
  model_number text,
  status text not null default 'ACTIVE',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists items_business_sku_unique
  on public.items(business_id, sku);

create index if not exists items_business_id_idx
  on public.items(business_id);

create index if not exists items_name_idx
  on public.items(name);

create table if not exists public.item_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  taxability text not null,
  hsn_sac text,
  gst_rate numeric(5,2) not null default 0,
  cess_rule_id text,
  effective_from text not null,
  effective_to text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_tax_profiles_business_id_idx
  on public.item_tax_profiles(business_id);

create index if not exists item_tax_profiles_item_id_idx
  on public.item_tax_profiles(item_id);

create table if not exists public.item_units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  base_unit text not null,
  secondary_unit text,
  conversion_factor numeric(14,6) not null default 1,
  gst_uqc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_units_business_id_idx
  on public.item_units(business_id);

create index if not exists item_units_item_id_idx
  on public.item_units(item_id);

create table if not exists public.item_prices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  price_type text not null,
  price numeric(14,2) not null default 0,
  tax_mode text not null default 'EXCLUSIVE',
  currency text not null default 'INR',
  minimum_quantity numeric(14,3) not null default 1,
  customer_group_id text,
  effective_from text not null,
  effective_to text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_prices_business_id_idx
  on public.item_prices(business_id);

create index if not exists item_prices_item_id_idx
  on public.item_prices(item_id);

create table if not exists public.item_suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  supplier_id uuid not null references public.parties(id) on delete restrict,
  supplier_item_code text,
  purchase_price numeric(14,2),
  minimum_order_quantity numeric(14,3) not null default 1,
  lead_time_days integer not null default 0,
  is_preferred boolean not null default false,
  effective_from text,
  effective_to text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_suppliers_business_id_idx
  on public.item_suppliers(business_id);

create index if not exists item_suppliers_item_id_idx
  on public.item_suppliers(item_id);

create index if not exists item_suppliers_supplier_id_idx
  on public.item_suppliers(supplier_id);

create table if not exists public.item_barcodes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  barcode text not null,
  barcode_type text,
  is_primary boolean not null default false,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists item_barcodes_business_barcode_unique
  on public.item_barcodes(business_id, barcode);

create index if not exists item_barcodes_item_id_idx
  on public.item_barcodes(item_id);

create table if not exists public.item_inventory_profiles (
  item_id uuid primary key references public.items(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  track_inventory boolean not null default true,
  default_warehouse_id uuid references public.warehouses(id) on delete set null,
  reorder_level numeric(14,3) not null default 0,
  minimum_stock numeric(14,3) not null default 0,
  maximum_stock numeric(14,3) not null default 0,
  batch_tracking boolean not null default false,
  serial_tracking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_inventory_profiles_business_id_idx
  on public.item_inventory_profiles(business_id);

create table if not exists public.item_accounting_profiles (
  item_id uuid primary key references public.items(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sales_account_id uuid references public.ledger_accounts(id) on delete set null,
  purchase_account_id uuid references public.ledger_accounts(id) on delete set null,
  inventory_account_id uuid references public.ledger_accounts(id) on delete set null,
  sales_return_account_id uuid references public.ledger_accounts(id) on delete set null,
  purchase_return_account_id uuid references public.ledger_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_accounting_profiles_business_id_idx
  on public.item_accounting_profiles(business_id);

insert into public.uqc_codes (code, description)
values
  ('BAG', 'Bags'),
  ('BOX', 'Box'),
  ('BTL', 'Bottles'),
  ('DOZ', 'Dozens'),
  ('GMS', 'Grams'),
  ('KGS', 'Kilograms'),
  ('LTR', 'Litres'),
  ('MTR', 'Meters'),
  ('NOS', 'Numbers'),
  ('PCS', 'Pieces'),
  ('SET', 'Sets')
on conflict (code) do nothing;

insert into public.hsn_sac_codes (code, code_type, description)
values
  ('090240', 'HSN', 'Tea, whether or not flavoured'),
  ('190531', 'HSN', 'Sweet biscuits'),
  ('210690', 'HSN', 'Food preparations not elsewhere specified'),
  ('330499', 'HSN', 'Beauty or make-up preparations'),
  ('340111', 'HSN', 'Soap and organic surface-active products'),
  ('392410', 'HSN', 'Tableware and kitchenware of plastics'),
  ('481920', 'HSN', 'Folding cartons, boxes and cases'),
  ('821599', 'HSN', 'Spoons, forks, ladles and similar kitchen articles'),
  ('950300', 'HSN', 'Tricycles, scooters, toys and models'),
  ('998313', 'SAC', 'Information technology consulting and support services')
on conflict (code) do nothing;
