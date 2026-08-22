create table if not exists public.gst_reporting_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gst_registration_id uuid not null references public.gst_registrations(id) on delete restrict,
  period text not null,
  status text not null default 'DRAFT',
  generated_at timestamptz,
  source_version text not null default 'GSTFY_REPORTING_V1',
  created_by uuid references public.users(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references public.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.users(id) on delete set null,
  reopen_reason text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_reporting_runs_period_format_chk check (period ~ '^\d{4}-\d{2}$'),
  constraint gst_reporting_runs_status_chk check (status in ('DRAFT', 'REVIEW', 'READY', 'LOCKED', 'EXPORTED')),
  constraint gst_reporting_runs_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id)
);

create unique index if not exists gst_reporting_runs_business_gstin_period_unique
  on public.gst_reporting_runs(business_id, gst_registration_id, period);

create unique index if not exists gst_reporting_runs_id_business_gstin_period_unique
  on public.gst_reporting_runs(id, business_id, gst_registration_id, period);

create index if not exists gst_reporting_runs_business_status_idx
  on public.gst_reporting_runs(business_id, status);

create table if not exists public.gst_reporting_facts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.gst_reporting_runs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  gst_registration_id uuid not null references public.gst_registrations(id) on delete restrict,
  period text not null,
  source_voucher_id uuid,
  source_document_id uuid,
  source_document_type text not null,
  source_document_number text not null,
  source_document_date date not null,
  source_line_id uuid,
  party_id uuid,
  party_name text,
  party_gstin text,
  place_of_supply_state_code text,
  place_of_supply_state text,
  classification text not null,
  hsn_sac text,
  description text,
  uqc text,
  quantity numeric(14,3) not null default 0,
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  total_tax numeric(14,2) not null default 0,
  reverse_charge boolean not null default false,
  itc_category text,
  reporting_status text not null default 'included',
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint gst_reporting_facts_period_format_chk check (period ~ '^\d{4}-\d{2}$'),
  constraint gst_reporting_facts_reporting_status_chk check (reporting_status in ('included', 'excluded', 'exception')),
  constraint gst_reporting_facts_amounts_non_negative_chk check (
    taxable_value >= 0 and cgst >= 0 and sgst >= 0 and igst >= 0 and cess >= 0 and total_tax >= 0
  ),
  constraint gst_reporting_facts_run_business_fk
    foreign key (run_id, business_id, gst_registration_id, period)
    references public.gst_reporting_runs(id, business_id, gst_registration_id, period),
  constraint gst_reporting_facts_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id),
  constraint gst_reporting_facts_party_business_fk
    foreign key (party_id, business_id)
    references public.parties(id, business_id),
  constraint gst_reporting_facts_voucher_business_fk
    foreign key (source_voucher_id, business_id)
    references public.vouchers(id, business_id)
);

create index if not exists gst_reporting_facts_run_idx
  on public.gst_reporting_facts(run_id);

create unique index if not exists gst_reporting_facts_id_business_unique
  on public.gst_reporting_facts(id, business_id);

create index if not exists gst_reporting_facts_business_period_idx
  on public.gst_reporting_facts(business_id, gst_registration_id, period);

create index if not exists gst_reporting_facts_classification_idx
  on public.gst_reporting_facts(business_id, gst_registration_id, period, classification);

create index if not exists gst_reporting_facts_source_idx
  on public.gst_reporting_facts(business_id, source_document_type, source_document_id);

create unique index if not exists gst_reporting_facts_source_line_unique
  on public.gst_reporting_facts(run_id, source_document_type, source_line_id)
  where source_line_id is not null;

create table if not exists public.gst_reporting_exceptions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.gst_reporting_runs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  gst_registration_id uuid not null references public.gst_registrations(id) on delete restrict,
  period text not null,
  fact_id uuid,
  source_document_type text,
  source_document_id uuid,
  exception_type text not null,
  severity text not null default 'MEDIUM',
  status text not null default 'OPEN',
  message text not null,
  recommendation text,
  is_blocking boolean not null default false,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_reporting_exceptions_period_format_chk check (period ~ '^\d{4}-\d{2}$'),
  constraint gst_reporting_exceptions_severity_chk check (severity in ('HIGH', 'MEDIUM', 'LOW')),
  constraint gst_reporting_exceptions_status_chk check (status in ('OPEN', 'IN_REVIEW', 'RESOLVED', 'IGNORED')),
  constraint gst_reporting_exceptions_run_business_fk
    foreign key (run_id, business_id, gst_registration_id, period)
    references public.gst_reporting_runs(id, business_id, gst_registration_id, period),
  constraint gst_reporting_exceptions_fact_business_fk
    foreign key (fact_id, business_id)
    references public.gst_reporting_facts(id, business_id),
  constraint gst_reporting_exceptions_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id)
);

create index if not exists gst_reporting_exceptions_run_idx
  on public.gst_reporting_exceptions(run_id);

create index if not exists gst_reporting_exceptions_status_idx
  on public.gst_reporting_exceptions(business_id, status, severity);

create table if not exists public.gst_reporting_exports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.gst_reporting_runs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  gst_registration_id uuid not null references public.gst_registrations(id) on delete restrict,
  period text not null,
  report_type text not null,
  export_format text not null,
  file_name text not null,
  content_type text not null,
  content_hash text not null,
  exported_by uuid references public.users(id) on delete set null,
  exported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_reporting_exports_report_type_chk check (report_type in ('gstr1', 'gstr3b', 'hsn', 'documents', 'review')),
  constraint gst_reporting_exports_format_chk check (export_format in ('csv', 'json', 'xlsx')),
  constraint gst_reporting_exports_run_business_fk
    foreign key (run_id, business_id, gst_registration_id, period)
    references public.gst_reporting_runs(id, business_id, gst_registration_id, period),
  constraint gst_reporting_exports_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id)
);

create index if not exists gst_reporting_exports_run_idx
  on public.gst_reporting_exports(run_id);

create table if not exists public.gst_reporting_idempotency_keys (
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

create unique index if not exists gst_reporting_idempotency_keys_business_scope_key_unique
  on public.gst_reporting_idempotency_keys(business_id, operation_scope, idempotency_key);
