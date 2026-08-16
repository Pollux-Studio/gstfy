update public.ledger_accounts
set
  account_type = upper(account_type),
  normal_balance = upper(normal_balance),
  account_group = upper(account_group);

create or replace function public.prevent_journal_fact_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Posted journal facts are immutable. Use reversal or adjustment documents.';
end;
$$;

drop trigger if exists prevent_journal_entries_mutation on public.journal_entries;
create trigger prevent_journal_entries_mutation
  before update or delete on public.journal_entries
  for each row
  execute function public.prevent_journal_fact_mutation();

drop trigger if exists prevent_journal_entry_lines_mutation on public.journal_entry_lines;
create trigger prevent_journal_entry_lines_mutation
  before update or delete on public.journal_entry_lines
  for each row
  execute function public.prevent_journal_fact_mutation();

create or replace function public.prevent_posted_voucher_fact_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Posted vouchers are immutable. Use cancellation, return, debit note, credit note or journal adjustment.';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'posted'
    and (
      new.business_id is distinct from old.business_id
      or new.gst_registration_id is distinct from old.gst_registration_id
      or new.branch_id is distinct from old.branch_id
      or new.warehouse_id is distinct from old.warehouse_id
      or new.voucher_type is distinct from old.voucher_type
      or new.voucher_number is distinct from old.voucher_number
      or new.voucher_date is distinct from old.voucher_date
      or new.financial_year_id is distinct from old.financial_year_id
      or new.reference_voucher_id is distinct from old.reference_voucher_id
      or new.seller_snapshot is distinct from old.seller_snapshot
      or new.branch_snapshot is distinct from old.branch_snapshot
      or new.party_snapshot is distinct from old.party_snapshot
      or new.tax_snapshot is distinct from old.tax_snapshot
    )
  then
    raise exception 'Posted voucher accounting identity and snapshots are immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_posted_voucher_fact_mutation on public.vouchers;
create trigger prevent_posted_voucher_fact_mutation
  before update or delete on public.vouchers
  for each row
  execute function public.prevent_posted_voucher_fact_mutation();
