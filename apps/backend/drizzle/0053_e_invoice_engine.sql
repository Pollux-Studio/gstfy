create table if not exists public.e_invoice_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gst_registration_id uuid not null references public.gst_registrations(id) on delete restrict,
  source_document_type text not null,
  source_document_id uuid not null,
  source_sales_invoice_id uuid references public.sales_invoices(id) on delete restrict,
  source_adjustment_document_id uuid references public.adjustment_documents(id) on delete restrict,
  source_voucher_id uuid references public.vouchers(id) on delete restrict,
  source_document_number text not null,
  document_date date not null,
  party_id uuid references public.parties(id) on delete set null,
  party_gstin text,
  eligibility_status text not null default 'ELIGIBLE',
  submission_status text not null default 'ELIGIBLE',
  attempt_number integer not null default 1,
  provider_name text not null default 'mock',
  provider_mode text,
  provider_reference text,
  payload_schema_version text,
  payload_hash text,
  irn text,
  ack_number text,
  ack_date timestamptz,
  signed_invoice_reference text,
  signed_qr_code text,
  raw_response_reference text,
  validation_result jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  raw_external_response jsonb,
  external_response_received_at timestamptz,
  submitted_at timestamptz,
  submitted_by uuid references public.users(id) on delete set null,
  generated_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users(id) on delete set null,
  cancel_reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e_invoice_records_source_type_check
    check (source_document_type in ('sales_invoice', 'credit_note', 'debit_note')),
  constraint e_invoice_records_status_check
    check (submission_status in (
      'NOT_REQUIRED',
      'ELIGIBLE',
      'READY',
      'VALIDATION_FAILED',
      'SUBMITTING',
      'PROCESSING',
      'IRN_GENERATED',
      'FAILED',
      'CANCELLATION_REQUESTED',
      'CANCELLED',
      'CANCELLATION_FAILED'
    )),
  constraint e_invoice_records_eligibility_check
    check (eligibility_status in ('ELIGIBLE', 'NOT_ELIGIBLE', 'BLOCKED', 'ALREADY_GENERATED')),
  constraint e_invoice_records_source_column_check
    check (
      (source_document_type = 'sales_invoice' and source_sales_invoice_id = source_document_id and source_adjustment_document_id is null)
      or
      (source_document_type in ('credit_note', 'debit_note') and source_adjustment_document_id = source_document_id and source_sales_invoice_id is null)
    )
);

create unique index if not exists e_invoice_records_business_source_unique
  on public.e_invoice_records (business_id, source_document_type, source_document_id);

create unique index if not exists e_invoice_records_business_irn_unique
  on public.e_invoice_records (business_id, irn)
  where irn is not null;

create unique index if not exists e_invoice_records_id_business_id_unique
  on public.e_invoice_records (id, business_id);

create index if not exists e_invoice_records_business_status_idx
  on public.e_invoice_records (business_id, submission_status);

create index if not exists e_invoice_records_business_date_idx
  on public.e_invoice_records (business_id, document_date desc);

create unique index if not exists sales_invoices_id_business_id_unique
  on public.sales_invoices (id, business_id);

do $$
begin
  alter table public.e_invoice_records
    add constraint e_invoice_records_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.e_invoice_records
    add constraint e_invoice_records_sales_invoice_business_fk
    foreign key (source_sales_invoice_id, business_id)
    references public.sales_invoices(id, business_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.e_invoice_records
    add constraint e_invoice_records_adjustment_document_business_fk
    foreign key (source_adjustment_document_id, business_id)
    references public.adjustment_documents(id, business_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.e_invoice_records
    add constraint e_invoice_records_party_business_fk
    foreign key (party_id, business_id)
    references public.parties(id, business_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.e_invoice_payloads (
  id uuid primary key default gen_random_uuid(),
  e_invoice_record_id uuid not null references public.e_invoice_records(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  payload_type text not null,
  schema_version text not null,
  content_hash text not null,
  payload jsonb not null,
  generated_by uuid references public.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e_invoice_payloads_type_check
    check (payload_type in ('canonical', 'provider', 'response', 'cancellation'))
);

create unique index if not exists e_invoice_payloads_record_type_unique
  on public.e_invoice_payloads (e_invoice_record_id, payload_type);

create index if not exists e_invoice_payloads_business_record_idx
  on public.e_invoice_payloads (business_id, e_invoice_record_id);

do $$
begin
  alter table public.e_invoice_payloads
    add constraint e_invoice_payloads_record_business_fk
    foreign key (e_invoice_record_id, business_id)
    references public.e_invoice_records(id, business_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.e_invoice_status_events (
  id uuid primary key default gen_random_uuid(),
  e_invoice_record_id uuid not null references public.e_invoice_records(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  previous_status text,
  status text not null,
  event_type text not null,
  message text,
  provider_reference text,
  raw_response jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists e_invoice_status_events_record_idx
  on public.e_invoice_status_events (e_invoice_record_id, created_at desc);

do $$
begin
  alter table public.e_invoice_status_events
    add constraint e_invoice_status_events_record_business_fk
    foreign key (e_invoice_record_id, business_id)
    references public.e_invoice_records(id, business_id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.e_invoice_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  operation_scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_body jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists e_invoice_idempotency_keys_business_scope_key_unique
  on public.e_invoice_idempotency_keys (business_id, operation_scope, idempotency_key);
