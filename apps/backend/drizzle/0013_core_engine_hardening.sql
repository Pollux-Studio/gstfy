create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type text not null,
  normal_balance text not null,
  parent_account_id uuid references public.ledger_accounts(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ledger_accounts_business_code_unique
  on public.ledger_accounts(business_id, account_code);

create index if not exists ledger_accounts_business_id_idx
  on public.ledger_accounts(business_id);

create index if not exists ledger_accounts_parent_account_id_idx
  on public.ledger_accounts(parent_account_id);

alter table public.journal_entry_lines
  add column if not exists account_id uuid references public.ledger_accounts(id) on delete restrict;

create index if not exists journal_entry_lines_account_id_idx
  on public.journal_entry_lines(account_id);

alter table public.vouchers
  add column if not exists seller_snapshot jsonb;

alter table public.vouchers
  add column if not exists branch_snapshot jsonb;

alter table public.vouchers
  add column if not exists party_snapshot jsonb;

alter table public.vouchers
  add column if not exists tax_snapshot jsonb;

alter table public.inventory_transactions
  add column if not exists item_snapshot jsonb;

alter table public.receivable_payable_entries
  add column if not exists party_snapshot jsonb;
