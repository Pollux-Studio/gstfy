create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  cash_bank_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  file_name text not null,
  statement_from date,
  statement_to date,
  imported_by uuid references public.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_statement_imports_id_business_unique unique (id, business_id)
);

create index if not exists bank_statement_imports_business_id_idx
  on public.bank_statement_imports(business_id);

create index if not exists bank_statement_imports_account_id_idx
  on public.bank_statement_imports(cash_bank_account_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_statement_imports_account_business_fk') then
    alter table public.bank_statement_imports
      add constraint bank_statement_imports_account_business_fk
      foreign key (cash_bank_account_id, business_id)
      references public.ledger_accounts(id, business_id);
  end if;
end $$;

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_id uuid not null,
  cash_bank_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  statement_date date not null,
  description text not null default '',
  bank_reference text,
  direction text not null,
  amount numeric(14,2) not null,
  match_status text not null default 'unmatched',
  matched_receipt_id uuid references public.receipts(id) on delete set null,
  matched_payment_id uuid references public.payments(id) on delete set null,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_statement_lines_id_business_unique unique (id, business_id),
  constraint bank_statement_lines_direction_check check (direction in ('credit', 'debit')),
  constraint bank_statement_lines_status_check check (match_status in ('unmatched', 'matched', 'ignored')),
  constraint bank_statement_lines_amount_check check (amount > 0),
  constraint bank_statement_lines_one_match_check check (
    (matched_receipt_id is null and matched_payment_id is null)
    or
    (matched_receipt_id is not null and matched_payment_id is null)
    or
    (matched_receipt_id is null and matched_payment_id is not null)
  ),
  constraint bank_statement_lines_import_business_fk
    foreign key (import_id, business_id)
    references public.bank_statement_imports(id, business_id),
  constraint bank_statement_lines_account_business_fk
    foreign key (cash_bank_account_id, business_id)
    references public.ledger_accounts(id, business_id),
  constraint bank_statement_lines_receipt_business_fk
    foreign key (matched_receipt_id, business_id)
    references public.receipts(id, business_id),
  constraint bank_statement_lines_payment_business_fk
    foreign key (matched_payment_id, business_id)
    references public.payments(id, business_id)
);

create index if not exists bank_statement_lines_business_id_idx
  on public.bank_statement_lines(business_id);

create index if not exists bank_statement_lines_import_id_idx
  on public.bank_statement_lines(import_id);

create index if not exists bank_statement_lines_account_id_idx
  on public.bank_statement_lines(cash_bank_account_id);

create index if not exists bank_statement_lines_match_status_idx
  on public.bank_statement_lines(match_status);

create unique index if not exists bank_statement_lines_receipt_unique
  on public.bank_statement_lines(business_id, matched_receipt_id)
  where matched_receipt_id is not null;

create unique index if not exists bank_statement_lines_payment_unique
  on public.bank_statement_lines(business_id, matched_payment_id)
  where matched_payment_id is not null;

alter table public.bank_reconciliation_matches
  add column if not exists statement_line_id uuid;

create unique index if not exists bank_reconciliation_matches_statement_line_unique
  on public.bank_reconciliation_matches(business_id, statement_line_id)
  where statement_line_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_reconciliation_matches_statement_line_business_fk') then
    alter table public.bank_reconciliation_matches
      add constraint bank_reconciliation_matches_statement_line_business_fk
      foreign key (statement_line_id, business_id)
      references public.bank_statement_lines(id, business_id);
  end if;
end $$;
