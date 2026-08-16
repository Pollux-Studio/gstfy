alter table public.ledger_accounts
  add column if not exists account_group text not null default 'UNCATEGORIZED';

alter table public.ledger_accounts
  add column if not exists is_system boolean not null default false;

alter table public.ledger_accounts
  add column if not exists allow_posting boolean not null default true;

alter table public.ledger_accounts
  add column if not exists description text;

update public.journal_entry_lines line
set account_id = account.id
from public.ledger_accounts account
where line.account_id is null
  and account.business_id = line.business_id
  and account.account_code = line.account_code;

do $$
begin
  if exists (
    select 1
    from public.journal_entry_lines
    where account_id is null
    limit 1
  ) then
    raise exception
      'journal_entry_lines.account_id backfill failed. Resolve historical account_code mappings before applying accounting engine migration.';
  end if;
end $$;

alter table public.journal_entry_lines
  alter column account_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ledger_accounts_account_type_check'
  ) then
    alter table public.ledger_accounts
      add constraint ledger_accounts_account_type_check
      check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ledger_accounts_normal_balance_check'
  ) then
    alter table public.ledger_accounts
      add constraint ledger_accounts_normal_balance_check
      check (normal_balance in ('DEBIT', 'CREDIT'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ledger_accounts_status_check'
  ) then
    alter table public.ledger_accounts
      add constraint ledger_accounts_status_check
      check (status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entry_lines_single_side_check'
  ) then
    alter table public.journal_entry_lines
      add constraint journal_entry_lines_single_side_check
      check (
        debit >= 0
        and credit >= 0
        and (
          (debit > 0 and credit = 0)
          or (credit > 0 and debit = 0)
        )
      );
  end if;
end $$;
