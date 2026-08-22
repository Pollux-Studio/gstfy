update public.adjustment_documents
set source_party_role = case
  when source_document_type = 'sales_invoice' then 'customer'
  when source_document_type = 'purchase_bill' then 'supplier'
  else source_party_role
end
where source_party_role is null;

update public.adjustment_documents
set issuer_type = 'SUPPLIER',
    document_direction = 'incoming'
where adjustment_type = 'DEBIT_NOTE'
  and source_document_type = 'purchase_bill';

alter table public.adjustment_documents
  alter column source_party_role set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_issuer_type_check') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_issuer_type_check
      check (issuer_type in ('GSTFY_BUSINESS', 'CUSTOMER', 'SUPPLIER'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_direction_check') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_direction_check
      check (document_direction in ('incoming', 'outgoing'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_source_party_role_check') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_source_party_role_check
      check (source_party_role in ('customer', 'supplier'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_source_role_matches_source_check') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_source_role_matches_source_check
      check (
        (source_document_type = 'sales_invoice' and source_party_role = 'customer')
        or (source_document_type = 'purchase_bill' and source_party_role = 'supplier')
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'adjustment_documents_debit_note_direction_check') then
    alter table public.adjustment_documents
      add constraint adjustment_documents_debit_note_direction_check
      check (
        adjustment_type <> 'DEBIT_NOTE'
        or (
          source_document_type = 'sales_invoice'
          and issuer_type = 'GSTFY_BUSINESS'
          and document_direction = 'outgoing'
          and source_party_role = 'customer'
        )
        or (
          source_document_type = 'purchase_bill'
          and issuer_type = 'SUPPLIER'
          and document_direction = 'incoming'
          and source_party_role = 'supplier'
        )
      );
  end if;
end $$;
