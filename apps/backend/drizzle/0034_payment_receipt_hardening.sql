create unique index if not exists gst_registrations_id_business_id_unique
  on public.gst_registrations(id, business_id);

create unique index if not exists vouchers_id_business_id_unique
  on public.vouchers(id, business_id);

create unique index if not exists receivable_payable_entries_id_business_id_unique
  on public.receivable_payable_entries(id, business_id);

create unique index if not exists receipts_id_business_id_unique
  on public.receipts(id, business_id);

create unique index if not exists payments_id_business_id_unique
  on public.payments(id, business_id);

alter table public.receipts
  add column if not exists unallocated_treatment text not null default 'advance',
  alter column receipt_date type date using receipt_date::date;

alter table public.payments
  add column if not exists unallocated_treatment text not null default 'advance',
  alter column payment_date type date using payment_date::date;

alter table public.payment_allocations
  add column if not exists allocation_kind text,
  add column if not exists receipt_id uuid,
  add column if not exists payment_id uuid;

update public.payment_allocations allocation
set allocation_kind = case
    when voucher.voucher_type = 'RECEIPT' then 'receipt'
    when voucher.voucher_type = 'PAYMENT' then 'payment'
    else 'payment'
  end
from public.vouchers voucher
where allocation.payment_voucher_id = voucher.id
  and allocation.allocation_kind is null;

update public.payment_allocations allocation
set receipt_id = receipt.id
from public.receipts receipt
where allocation.allocation_kind = 'receipt'
  and allocation.payment_voucher_id = receipt.voucher_id
  and allocation.receipt_id is null;

update public.payment_allocations allocation
set payment_id = payment.id
from public.payments payment
where allocation.allocation_kind = 'payment'
  and allocation.payment_voucher_id = payment.voucher_id
  and allocation.payment_id is null;

alter table public.payment_allocations
  alter column allocation_kind set default 'payment',
  alter column allocation_kind set not null;

create index if not exists payment_allocations_allocation_kind_idx
  on public.payment_allocations(allocation_kind);
create index if not exists payment_allocations_receipt_id_idx
  on public.payment_allocations(receipt_id);
create index if not exists payment_allocations_payment_id_idx
  on public.payment_allocations(payment_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'receipts_amount_positive_check') then
    alter table public.receipts
      add constraint receipts_amount_positive_check check (amount > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_allocated_non_negative_check') then
    alter table public.receipts
      add constraint receipts_allocated_non_negative_check check (allocated_amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_unallocated_non_negative_check') then
    alter table public.receipts
      add constraint receipts_unallocated_non_negative_check check (unallocated_amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_amount_split_check') then
    alter table public.receipts
      add constraint receipts_amount_split_check check (allocated_amount + unallocated_amount = amount);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_unallocated_treatment_check') then
    alter table public.receipts
      add constraint receipts_unallocated_treatment_check check (unallocated_treatment in ('advance', 'unallocated'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_amount_positive_check') then
    alter table public.payments
      add constraint payments_amount_positive_check check (amount > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_allocated_non_negative_check') then
    alter table public.payments
      add constraint payments_allocated_non_negative_check check (allocated_amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_unallocated_non_negative_check') then
    alter table public.payments
      add constraint payments_unallocated_non_negative_check check (unallocated_amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_amount_split_check') then
    alter table public.payments
      add constraint payments_amount_split_check check (allocated_amount + unallocated_amount = amount);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_unallocated_treatment_check') then
    alter table public.payments
      add constraint payments_unallocated_treatment_check check (unallocated_treatment in ('advance', 'unallocated'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_amount_positive_check') then
    alter table public.payment_allocations
      add constraint payment_allocations_amount_positive_check check (allocated_amount > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_kind_check') then
    alter table public.payment_allocations
      add constraint payment_allocations_kind_check check (allocation_kind in ('receipt', 'payment'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_typed_document_check') then
    alter table public.payment_allocations
      add constraint payment_allocations_typed_document_check check (
        (allocation_kind = 'receipt' and receipt_id is not null and payment_id is null)
        or
        (allocation_kind = 'payment' and payment_id is not null and receipt_id is null)
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'receipts_party_business_fk') then
    alter table public.receipts
      add constraint receipts_party_business_fk
      foreign key (party_id, business_id)
      references public.parties(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_branch_business_fk') then
    alter table public.receipts
      add constraint receipts_branch_business_fk
      foreign key (branch_id, business_id)
      references public.business_branches(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_gst_registration_business_fk') then
    alter table public.receipts
      add constraint receipts_gst_registration_business_fk
      foreign key (gst_registration_id, business_id)
      references public.gst_registrations(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'receipts_cash_bank_account_business_fk') then
    alter table public.receipts
      add constraint receipts_cash_bank_account_business_fk
      foreign key (cash_bank_account_id, business_id)
      references public.ledger_accounts(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_party_business_fk') then
    alter table public.payments
      add constraint payments_party_business_fk
      foreign key (party_id, business_id)
      references public.parties(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_branch_business_fk') then
    alter table public.payments
      add constraint payments_branch_business_fk
      foreign key (branch_id, business_id)
      references public.business_branches(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_gst_registration_business_fk') then
    alter table public.payments
      add constraint payments_gst_registration_business_fk
      foreign key (gst_registration_id, business_id)
      references public.gst_registrations(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_cash_bank_account_business_fk') then
    alter table public.payments
      add constraint payments_cash_bank_account_business_fk
      foreign key (cash_bank_account_id, business_id)
      references public.ledger_accounts(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_payment_voucher_business_fk') then
    alter table public.payment_allocations
      add constraint payment_allocations_payment_voucher_business_fk
      foreign key (payment_voucher_id, business_id)
      references public.vouchers(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_document_voucher_business_fk') then
    alter table public.payment_allocations
      add constraint payment_allocations_document_voucher_business_fk
      foreign key (document_voucher_id, business_id)
      references public.vouchers(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_receivable_payable_business_fk') then
    alter table public.payment_allocations
      add constraint payment_allocations_receivable_payable_business_fk
      foreign key (receivable_payable_entry_id, business_id)
      references public.receivable_payable_entries(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_receipt_business_fk') then
    alter table public.payment_allocations
      add constraint payment_allocations_receipt_business_fk
      foreign key (receipt_id, business_id)
      references public.receipts(id, business_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_allocations_payment_business_fk') then
    alter table public.payment_allocations
      add constraint payment_allocations_payment_business_fk
      foreign key (payment_id, business_id)
      references public.payments(id, business_id);
  end if;
end $$;

create or replace function public.validate_payment_allocation_direction()
returns trigger
language plpgsql
as $$
declare
  target_entry_type text;
begin
  select entry_type
    into target_entry_type
  from public.receivable_payable_entries
  where id = new.receivable_payable_entry_id
    and business_id = new.business_id;

  if new.allocation_kind = 'receipt' then
    if target_entry_type is distinct from 'receivable' then
      raise exception 'Receipt allocations must target receivable entries.';
    end if;

    if not exists (
      select 1
      from public.receipts receipt
      where receipt.id = new.receipt_id
        and receipt.business_id = new.business_id
        and receipt.voucher_id = new.payment_voucher_id
    ) then
      raise exception 'Receipt allocation voucher does not match receipt.';
    end if;
  elsif new.allocation_kind = 'payment' then
    if target_entry_type is distinct from 'payable' then
      raise exception 'Payment allocations must target payable entries.';
    end if;

    if not exists (
      select 1
      from public.payments payment
      where payment.id = new.payment_id
        and payment.business_id = new.business_id
        and payment.voucher_id = new.payment_voucher_id
    ) then
      raise exception 'Payment allocation voucher does not match payment.';
    end if;
  else
    raise exception 'Invalid allocation kind.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payment_allocation_direction_trigger
  on public.payment_allocations;

create trigger validate_payment_allocation_direction_trigger
  before insert or update on public.payment_allocations
  for each row
  execute function public.validate_payment_allocation_direction();
