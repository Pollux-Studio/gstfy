create table if not exists public.gst_filing_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gst_registration_id uuid not null references public.gst_registrations(id) on delete restrict,
  reporting_run_id uuid not null references public.gst_reporting_runs(id) on delete restrict,
  return_type text not null,
  period text not null,
  status text not null default 'DRAFT',
  attempt_number integer not null default 1,
  adapter_name text not null default 'mock',
  adapter_mode text,
  schema_version text,
  payload_hash text,
  validation_result jsonb not null default '{}'::jsonb,
  external_reference text,
  acknowledgement_number text,
  acknowledgement_date timestamptz,
  submitted_at timestamptz,
  submitted_by uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  filed_at timestamptz,
  rejected_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  last_polled_at timestamptz,
  error_code text,
  error_message text,
  raw_external_response jsonb,
  created_by uuid references public.users(id) on delete set null,
  cancelled_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_filing_runs_period_format_chk check (period ~ '^\d{4}-\d{2}$'),
  constraint gst_filing_runs_return_type_chk check (return_type in ('GSTR1', 'GSTR3B')),
  constraint gst_filing_runs_status_chk check (
    status in (
      'DRAFT',
      'VALIDATED',
      'READY_FOR_SUBMISSION',
      'SUBMITTING',
      'SUBMITTED',
      'PROCESSING',
      'ACCEPTED',
      'FILED',
      'REJECTED',
      'FAILED',
      'CANCELLED'
    )
  ),
  constraint gst_filing_runs_attempt_positive_chk check (attempt_number > 0),
  constraint gst_filing_runs_reporting_run_business_fk
    foreign key (reporting_run_id, business_id, gst_registration_id, period)
    references public.gst_reporting_runs(id, business_id, gst_registration_id, period),
  constraint gst_filing_runs_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id)
);

create unique index if not exists gst_filing_runs_reporting_return_attempt_unique
  on public.gst_filing_runs(business_id, reporting_run_id, return_type, attempt_number);

create index if not exists gst_filing_runs_business_period_idx
  on public.gst_filing_runs(business_id, gst_registration_id, period, return_type);

create index if not exists gst_filing_runs_business_status_idx
  on public.gst_filing_runs(business_id, status);

create unique index if not exists gst_filing_runs_id_business_return_unique
  on public.gst_filing_runs(id, business_id, return_type);

create unique index if not exists gst_filing_runs_id_business_unique
  on public.gst_filing_runs(id, business_id);

create table if not exists public.gst_filing_payloads (
  id uuid primary key default gen_random_uuid(),
  filing_run_id uuid not null references public.gst_filing_runs(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reporting_run_id uuid not null references public.gst_reporting_runs(id) on delete restrict,
  return_type text not null,
  payload_type text not null,
  schema_version text not null,
  content_hash text not null,
  payload jsonb not null,
  generated_by uuid references public.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_filing_payloads_return_type_chk check (return_type in ('GSTR1', 'GSTR3B')),
  constraint gst_filing_payloads_payload_type_chk check (payload_type in ('canonical', 'external')),
  constraint gst_filing_payloads_run_business_fk
    foreign key (filing_run_id, business_id, return_type)
    references public.gst_filing_runs(id, business_id, return_type)
);

create unique index if not exists gst_filing_payloads_run_type_unique
  on public.gst_filing_payloads(filing_run_id, payload_type);

create index if not exists gst_filing_payloads_business_run_idx
  on public.gst_filing_payloads(business_id, filing_run_id);

create table if not exists public.gst_filing_status_events (
  id uuid primary key default gen_random_uuid(),
  filing_run_id uuid not null references public.gst_filing_runs(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  previous_status text,
  status text not null,
  event_type text not null,
  message text,
  external_reference text,
  raw_response jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gst_filing_status_events_run_business_fk
    foreign key (filing_run_id, business_id)
    references public.gst_filing_runs(id, business_id)
);

create index if not exists gst_filing_status_events_run_idx
  on public.gst_filing_status_events(filing_run_id, created_at desc);

create table if not exists public.gst_filing_idempotency_keys (
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

create unique index if not exists gst_filing_idempotency_keys_business_scope_key_unique
  on public.gst_filing_idempotency_keys(business_id, operation_scope, idempotency_key);
