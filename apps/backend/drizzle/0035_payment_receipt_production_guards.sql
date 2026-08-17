create table if not exists public.money_operation_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'in_progress',
  response_body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_operation_idempotency_status_check
    check (status in ('in_progress', 'completed', 'failed'))
);

create unique index if not exists money_operation_idempotency_business_operation_key_unique
  on public.money_operation_idempotency_keys(business_id, operation, idempotency_key);

create index if not exists money_operation_idempotency_business_id_idx
  on public.money_operation_idempotency_keys(business_id);

create index if not exists money_operation_idempotency_operation_idx
  on public.money_operation_idempotency_keys(operation);

create table if not exists public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  receipt_id uuid references public.receipts(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  cash_bank_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  statement_date date not null,
  bank_reference text,
  notes text,
  reconciled_by uuid references public.users(id) on delete set null,
  reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_reconciliation_one_document_check
    check (
      (receipt_id is not null and payment_id is null)
      or
      (payment_id is not null and receipt_id is null)
    )
);

create index if not exists bank_reconciliation_matches_business_id_idx
  on public.bank_reconciliation_matches(business_id);

create index if not exists bank_reconciliation_matches_receipt_id_idx
  on public.bank_reconciliation_matches(receipt_id);

create index if not exists bank_reconciliation_matches_payment_id_idx
  on public.bank_reconciliation_matches(payment_id);

create index if not exists bank_reconciliation_matches_account_id_idx
  on public.bank_reconciliation_matches(cash_bank_account_id);

create unique index if not exists bank_reconciliation_matches_receipt_unique
  on public.bank_reconciliation_matches(business_id, receipt_id)
  where receipt_id is not null;

create unique index if not exists bank_reconciliation_matches_payment_unique
  on public.bank_reconciliation_matches(business_id, payment_id)
  where payment_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_reconciliation_matches_account_business_fk') then
    alter table public.bank_reconciliation_matches
      add constraint bank_reconciliation_matches_account_business_fk
      foreign key (cash_bank_account_id, business_id)
      references public.ledger_accounts(id, business_id);
  end if;
end $$;

create or replace function public.validate_payment_allocation_direction()
returns trigger
language plpgsql
as $$
declare
  target_entry public.receivable_payable_entries%rowtype;
  receipt_document public.receipts%rowtype;
  payment_document public.payments%rowtype;
  current_entry_allocated numeric(14,2);
  current_document_allocated numeric(14,2);
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  if new.receivable_payable_entry_id is null then
    raise exception 'Allocation target is required.';
  end if;

  select *
    into target_entry
  from public.receivable_payable_entries
  where id = new.receivable_payable_entry_id
    and business_id = new.business_id
  for update;

  if not found then
    raise exception 'Allocation target not found.';
  end if;

  if target_entry.status in ('closed', 'cancelled', 'written_off') then
    raise exception 'Closed receivable/payable entries cannot be allocated.';
  end if;

  select coalesce(sum(allocated_amount), 0)
    into current_entry_allocated
  from public.payment_allocations
  where business_id = new.business_id
    and receivable_payable_entry_id = new.receivable_payable_entry_id
    and status = 'active'
    and id is distinct from new.id;

  if current_entry_allocated + new.allocated_amount > target_entry.original_amount then
    raise exception 'Allocation exceeds target outstanding amount.';
  end if;

  if new.allocation_kind = 'receipt' then
    if target_entry.entry_type is distinct from 'receivable' then
      raise exception 'Receipt allocations must target receivable entries.';
    end if;

    select *
      into receipt_document
    from public.receipts
    where id = new.receipt_id
      and business_id = new.business_id
    for update;

    if not found or receipt_document.voucher_id is distinct from new.payment_voucher_id then
      raise exception 'Receipt allocation voucher does not match receipt.';
    end if;

    select coalesce(sum(allocated_amount), 0)
      into current_document_allocated
    from public.payment_allocations
    where business_id = new.business_id
      and payment_voucher_id = new.payment_voucher_id
      and status = 'active'
      and id is distinct from new.id;

    if current_document_allocated + new.allocated_amount > receipt_document.amount then
      raise exception 'Allocation exceeds receipt amount.';
    end if;
  elsif new.allocation_kind = 'payment' then
    if target_entry.entry_type is distinct from 'payable' then
      raise exception 'Payment allocations must target payable entries.';
    end if;

    select *
      into payment_document
    from public.payments
    where id = new.payment_id
      and business_id = new.business_id
    for update;

    if not found or payment_document.voucher_id is distinct from new.payment_voucher_id then
      raise exception 'Payment allocation voucher does not match payment.';
    end if;

    select coalesce(sum(allocated_amount), 0)
      into current_document_allocated
    from public.payment_allocations
    where business_id = new.business_id
      and payment_voucher_id = new.payment_voucher_id
      and status = 'active'
      and id is distinct from new.id;

    if current_document_allocated + new.allocated_amount > payment_document.amount then
      raise exception 'Allocation exceeds payment amount.';
    end if;
  else
    raise exception 'Invalid allocation kind.';
  end if;

  return new;
end;
$$;
