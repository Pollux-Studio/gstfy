alter table public.purchase_tax_records
  add column if not exists normalized_invoice_number text;

update public.purchase_tax_records
set normalized_invoice_number = regexp_replace(upper(trim(invoice_number)), '[[:space:]_\-/]+', '', 'g')
where normalized_invoice_number is null;

alter table public.purchase_tax_records
  alter column normalized_invoice_number set not null;

create index if not exists purchase_tax_records_normalized_match_idx
  on public.purchase_tax_records(
    business_id,
    gst_registration_id,
    supplier_gstin,
    normalized_invoice_number,
    invoice_date
  );

alter table public.external_gst_imports
  add column if not exists gst_registration_id uuid;

alter table public.external_gst_imports
  drop constraint if exists external_gst_imports_gst_registration_business_fk;

alter table public.external_gst_imports
  add constraint external_gst_imports_gst_registration_business_fk
  foreign key (gst_registration_id, business_id)
  references public.gst_registrations(id, business_id);

alter table public.external_gst_records
  add column if not exists gst_registration_id uuid,
  add column if not exists normalized_document_number text;

update public.external_gst_records record
set gst_registration_id = import.gst_registration_id
from public.external_gst_imports import
where record.import_id = import.id
  and record.business_id = import.business_id
  and record.gst_registration_id is null;

update public.external_gst_records
set normalized_document_number = regexp_replace(upper(trim(document_number)), '[[:space:]_\-/]+', '', 'g')
where normalized_document_number is null;

alter table public.external_gst_records
  alter column normalized_document_number set not null;

alter table public.external_gst_records
  drop constraint if exists external_gst_records_gst_registration_business_fk;

alter table public.external_gst_records
  add constraint external_gst_records_gst_registration_business_fk
  foreign key (gst_registration_id, business_id)
  references public.gst_registrations(id, business_id);

create index if not exists external_gst_records_normalized_match_idx
  on public.external_gst_records(
    business_id,
    gst_registration_id,
    supplier_gstin,
    normalized_document_number,
    document_date
  );

create index if not exists external_gst_records_duplicate_review_idx
  on public.external_gst_records(
    business_id,
    gst_registration_id,
    source,
    period,
    supplier_gstin,
    normalized_document_number,
    document_date,
    taxable_value,
    total_tax
  );

alter table public.itc_status_events
  add column if not exists previous_eligible_cgst numeric(14,2) not null default 0,
  add column if not exists previous_eligible_sgst numeric(14,2) not null default 0,
  add column if not exists previous_eligible_igst numeric(14,2) not null default 0,
  add column if not exists previous_eligible_cess numeric(14,2) not null default 0,
  add column if not exists previous_ineligible_cgst numeric(14,2) not null default 0,
  add column if not exists previous_ineligible_sgst numeric(14,2) not null default 0,
  add column if not exists previous_ineligible_igst numeric(14,2) not null default 0,
  add column if not exists previous_ineligible_cess numeric(14,2) not null default 0,
  add column if not exists previous_deferred_cgst numeric(14,2) not null default 0,
  add column if not exists previous_deferred_sgst numeric(14,2) not null default 0,
  add column if not exists previous_deferred_igst numeric(14,2) not null default 0,
  add column if not exists previous_deferred_cess numeric(14,2) not null default 0;
