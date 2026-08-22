alter table public.receivable_payable_entries
  add column if not exists adjustment_amount numeric(14,2) not null default 0,
  add column if not exists effective_amount numeric(14,2) not null default 0,
  add column if not exists excess_settled_amount numeric(14,2) not null default 0;

update public.receivable_payable_entries
set effective_amount = original_amount
where effective_amount = 0
  and original_amount > 0;

alter table public.adjustment_documents
  add column if not exists settlement_effect_amount numeric(14,2) not null default 0,
  add column if not exists excess_credit_amount numeric(14,2) not null default 0;

create table if not exists public.receivable_payable_adjustment_effects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  adjustment_document_id uuid not null references public.adjustment_documents(id) on delete restrict,
  adjustment_voucher_id uuid references public.vouchers(id) on delete restrict,
  source_voucher_id uuid not null references public.vouchers(id) on delete restrict,
  receivable_payable_entry_id uuid not null references public.receivable_payable_entries(id) on delete restrict,
  effect_kind text not null,
  amount numeric(14,2) not null,
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  reversed_by uuid references public.users(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivable_payable_adjustment_effect_kind_check
    check (effect_kind in ('receivable_reduction', 'payable_reduction')),
  constraint receivable_payable_adjustment_effect_status_check
    check (status in ('active', 'reversed')),
  constraint receivable_payable_adjustment_effect_amount_check
    check (amount > 0)
);

create index if not exists rp_adjustment_effects_business_id_idx
  on public.receivable_payable_adjustment_effects(business_id);

create index if not exists rp_adjustment_effects_adjustment_document_id_idx
  on public.receivable_payable_adjustment_effects(adjustment_document_id);

create index if not exists rp_adjustment_effects_target_entry_id_idx
  on public.receivable_payable_adjustment_effects(receivable_payable_entry_id);

create unique index if not exists rp_adjustment_effects_active_document_entry_unique
  on public.receivable_payable_adjustment_effects(
    business_id,
    adjustment_document_id,
    receivable_payable_entry_id
  )
  where status = 'active';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rp_adjustment_effects_document_business_fk') then
    alter table public.receivable_payable_adjustment_effects
      add constraint rp_adjustment_effects_document_business_fk
      foreign key (adjustment_document_id, business_id)
      references public.adjustment_documents(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'rp_adjustment_effects_adjustment_voucher_business_fk') then
    alter table public.receivable_payable_adjustment_effects
      add constraint rp_adjustment_effects_adjustment_voucher_business_fk
      foreign key (adjustment_voucher_id, business_id)
      references public.vouchers(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'rp_adjustment_effects_source_voucher_business_fk') then
    alter table public.receivable_payable_adjustment_effects
      add constraint rp_adjustment_effects_source_voucher_business_fk
      foreign key (source_voucher_id, business_id)
      references public.vouchers(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'rp_adjustment_effects_target_entry_business_fk') then
    alter table public.receivable_payable_adjustment_effects
      add constraint rp_adjustment_effects_target_entry_business_fk
      foreign key (receivable_payable_entry_id, business_id)
      references public.receivable_payable_entries(id, business_id);
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
  target_effective_amount numeric(14,2);
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

  target_effective_amount := coalesce(nullif(target_entry.effective_amount, 0), target_entry.original_amount);

  select coalesce(sum(allocated_amount), 0)
    into current_entry_allocated
  from public.payment_allocations
  where business_id = new.business_id
    and receivable_payable_entry_id = new.receivable_payable_entry_id
    and status = 'active'
    and id is distinct from new.id;

  if current_entry_allocated + new.allocated_amount > target_effective_amount then
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
