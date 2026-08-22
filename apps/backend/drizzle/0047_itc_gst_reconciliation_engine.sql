create unique index if not exists purchase_bills_id_business_id_unique
  on public.purchase_bills(id, business_id);

create table if not exists public.purchase_tax_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_type text not null,
  purchase_bill_id uuid references public.purchase_bills(id) on delete restrict,
  adjustment_document_id uuid references public.adjustment_documents(id) on delete restrict,
  voucher_id uuid not null references public.vouchers(id) on delete restrict,
  supplier_id uuid references public.parties(id) on delete set null,
  gst_registration_id uuid references public.gst_registrations(id) on delete set null,
  branch_id uuid references public.business_branches(id) on delete set null,
  supplier_name text not null default '',
  supplier_gstin text,
  invoice_number text not null,
  invoice_date date not null,
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  total_tax numeric(14,2) not null default 0,
  tax_period text not null,
  reconciliation_status text not null default 'NOT_MATCHED',
  itc_status text not null default 'NOT_REVIEWED',
  eligible_cgst numeric(14,2) not null default 0,
  eligible_sgst numeric(14,2) not null default 0,
  eligible_igst numeric(14,2) not null default 0,
  eligible_cess numeric(14,2) not null default 0,
  ineligible_cgst numeric(14,2) not null default 0,
  ineligible_sgst numeric(14,2) not null default 0,
  ineligible_igst numeric(14,2) not null default 0,
  ineligible_cess numeric(14,2) not null default 0,
  deferred_cgst numeric(14,2) not null default 0,
  deferred_sgst numeric(14,2) not null default 0,
  deferred_igst numeric(14,2) not null default 0,
  deferred_cess numeric(14,2) not null default 0,
  input_type text not null default 'regular',
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_tax_records_id_business_unique unique (id, business_id),
  constraint purchase_tax_records_source_check check (source_type in ('purchase_bill', 'adjustment_document', 'rcm_purchase')),
  constraint purchase_tax_records_source_one_check check (
    (source_type in ('purchase_bill', 'rcm_purchase') and purchase_bill_id is not null and adjustment_document_id is null)
    or (source_type = 'adjustment_document' and adjustment_document_id is not null and purchase_bill_id is null)
  ),
  constraint purchase_tax_records_reconciliation_status_check check (
    reconciliation_status in (
      'NOT_MATCHED',
      'MATCHED',
      'PARTIAL_MATCH',
      'VALUE_MISMATCH',
      'TAX_MISMATCH',
      'DATE_MISMATCH',
      'DUPLICATE',
      'BOOKS_ONLY',
      'EXTERNAL_ONLY',
      'MANUAL_REVIEW'
    )
  ),
  constraint purchase_tax_records_itc_status_check check (
    itc_status in (
      'NOT_REVIEWED',
      'ELIGIBLE',
      'PARTIALLY_ELIGIBLE',
      'DEFERRED',
      'INELIGIBLE',
      'CLAIMED',
      'REVERSED',
      'REJECTED'
    )
  ),
  constraint purchase_tax_records_input_type_check check (input_type in ('regular', 'rcm', 'adjustment')),
  constraint purchase_tax_records_purchase_business_fk
    foreign key (purchase_bill_id, business_id)
    references public.purchase_bills(id, business_id),
  constraint purchase_tax_records_adjustment_business_fk
    foreign key (adjustment_document_id, business_id)
    references public.adjustment_documents(id, business_id),
  constraint purchase_tax_records_voucher_business_fk
    foreign key (voucher_id, business_id)
    references public.vouchers(id, business_id),
  constraint purchase_tax_records_supplier_business_fk
    foreign key (supplier_id, business_id)
    references public.parties(id, business_id),
  constraint purchase_tax_records_gst_registration_business_fk
    foreign key (gst_registration_id, business_id)
    references public.gst_registrations(id, business_id),
  constraint purchase_tax_records_branch_business_fk
    foreign key (branch_id, business_id)
    references public.business_branches(id, business_id)
);

create unique index if not exists purchase_tax_records_bill_unique
  on public.purchase_tax_records(business_id, purchase_bill_id)
  where purchase_bill_id is not null;

create unique index if not exists purchase_tax_records_adjustment_unique
  on public.purchase_tax_records(business_id, adjustment_document_id)
  where adjustment_document_id is not null;

create index if not exists purchase_tax_records_business_period_idx
  on public.purchase_tax_records(business_id, tax_period);

create index if not exists purchase_tax_records_reconciliation_status_idx
  on public.purchase_tax_records(reconciliation_status);

create index if not exists purchase_tax_records_itc_status_idx
  on public.purchase_tax_records(itc_status);

create table if not exists public.external_gst_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source text not null,
  period text not null,
  file_name text not null,
  record_count integer not null default 0,
  imported_by uuid references public.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  status text not null default 'imported',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_gst_imports_id_business_unique unique (id, business_id),
  constraint external_gst_imports_source_check check (source in ('gstr_2b', 'gstr_2a', 'manual', 'other')),
  constraint external_gst_imports_status_check check (status in ('imported', 'superseded', 'failed'))
);

create index if not exists external_gst_imports_business_period_idx
  on public.external_gst_imports(business_id, period);

create table if not exists public.external_gst_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_id uuid not null,
  supplier_gstin text not null,
  supplier_name text,
  document_number text not null,
  document_date date not null,
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  cess numeric(14,2) not null default 0,
  total_tax numeric(14,2) not null default 0,
  period text not null,
  source text not null default 'gstr_2b',
  status text not null default 'available',
  raw_reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_gst_records_id_business_unique unique (id, business_id),
  constraint external_gst_records_import_business_fk
    foreign key (import_id, business_id)
    references public.external_gst_imports(id, business_id),
  constraint external_gst_records_status_check check (status in ('available', 'matched', 'ignored')),
  constraint external_gst_records_source_check check (source in ('gstr_2b', 'gstr_2a', 'manual', 'other'))
);

create index if not exists external_gst_records_business_period_idx
  on public.external_gst_records(business_id, period);

create index if not exists external_gst_records_match_key_idx
  on public.external_gst_records(business_id, supplier_gstin, document_number, document_date);

create unique index if not exists external_gst_records_import_dedupe_unique
  on public.external_gst_records(
    business_id,
    import_id,
    supplier_gstin,
    document_number,
    document_date,
    taxable_value,
    total_tax
  );

create table if not exists public.gst_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_tax_record_id uuid not null,
  external_gst_record_id uuid not null,
  match_status text not null,
  match_confidence text not null,
  taxable_difference numeric(14,2) not null default 0,
  cgst_difference numeric(14,2) not null default 0,
  sgst_difference numeric(14,2) not null default 0,
  igst_difference numeric(14,2) not null default 0,
  cess_difference numeric(14,2) not null default 0,
  matched_by uuid references public.users(id) on delete set null,
  matched_at timestamptz not null default now(),
  manual_override boolean not null default false,
  reason text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_reconciliation_matches_id_business_unique unique (id, business_id),
  constraint gst_reconciliation_matches_tax_record_business_fk
    foreign key (purchase_tax_record_id, business_id)
    references public.purchase_tax_records(id, business_id),
  constraint gst_reconciliation_matches_external_record_business_fk
    foreign key (external_gst_record_id, business_id)
    references public.external_gst_records(id, business_id),
  constraint gst_reconciliation_matches_status_check check (status in ('active', 'reversed')),
  constraint gst_reconciliation_matches_match_status_check check (
    match_status in (
      'MATCHED',
      'PARTIAL_MATCH',
      'VALUE_MISMATCH',
      'TAX_MISMATCH',
      'DATE_MISMATCH',
      'DUPLICATE',
      'MANUAL_REVIEW'
    )
  ),
  constraint gst_reconciliation_matches_confidence_check check (
    match_confidence in ('EXACT', 'STRONG', 'PARTIAL', 'WEAK', 'NO_MATCH')
  )
);

create unique index if not exists gst_reconciliation_matches_active_book_unique
  on public.gst_reconciliation_matches(business_id, purchase_tax_record_id)
  where status = 'active';

create unique index if not exists gst_reconciliation_matches_active_external_unique
  on public.gst_reconciliation_matches(business_id, external_gst_record_id)
  where status = 'active';

create index if not exists gst_reconciliation_matches_business_status_idx
  on public.gst_reconciliation_matches(business_id, match_status);

create table if not exists public.gst_reconciliation_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  match_id uuid,
  purchase_tax_record_id uuid,
  external_gst_record_id uuid,
  exception_type text not null,
  severity text not null default 'MEDIUM',
  status text not null default 'OPEN',
  assigned_to uuid references public.users(id) on delete set null,
  reason text,
  resolution text,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_reconciliation_exceptions_id_business_unique unique (id, business_id),
  constraint gst_reconciliation_exceptions_match_business_fk
    foreign key (match_id, business_id)
    references public.gst_reconciliation_matches(id, business_id),
  constraint gst_reconciliation_exceptions_tax_record_business_fk
    foreign key (purchase_tax_record_id, business_id)
    references public.purchase_tax_records(id, business_id),
  constraint gst_reconciliation_exceptions_external_record_business_fk
    foreign key (external_gst_record_id, business_id)
    references public.external_gst_records(id, business_id),
  constraint gst_reconciliation_exceptions_severity_check check (severity in ('HIGH', 'MEDIUM', 'LOW')),
  constraint gst_reconciliation_exceptions_status_check check (status in ('OPEN', 'IN_REVIEW', 'RESOLVED', 'IGNORED'))
);

create index if not exists gst_reconciliation_exceptions_business_status_idx
  on public.gst_reconciliation_exceptions(business_id, status);

create table if not exists public.itc_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_tax_record_id uuid not null,
  claim_period text not null,
  claimed_cgst numeric(14,2) not null default 0,
  claimed_sgst numeric(14,2) not null default 0,
  claimed_igst numeric(14,2) not null default 0,
  claimed_cess numeric(14,2) not null default 0,
  source_tax_record jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  claimed_by uuid references public.users(id) on delete set null,
  claimed_at timestamptz not null default now(),
  reversed_by uuid references public.users(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itc_claims_id_business_unique unique (id, business_id),
  constraint itc_claims_tax_record_business_fk
    foreign key (purchase_tax_record_id, business_id)
    references public.purchase_tax_records(id, business_id),
  constraint itc_claims_status_check check (status in ('active', 'reversed'))
);

create unique index if not exists itc_claims_active_record_unique
  on public.itc_claims(business_id, purchase_tax_record_id)
  where status = 'active';

create index if not exists itc_claims_business_period_idx
  on public.itc_claims(business_id, claim_period);

create table if not exists public.itc_status_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_tax_record_id uuid not null,
  from_status text,
  to_status text not null,
  eligible_cgst numeric(14,2) not null default 0,
  eligible_sgst numeric(14,2) not null default 0,
  eligible_igst numeric(14,2) not null default 0,
  eligible_cess numeric(14,2) not null default 0,
  ineligible_cgst numeric(14,2) not null default 0,
  ineligible_sgst numeric(14,2) not null default 0,
  ineligible_igst numeric(14,2) not null default 0,
  ineligible_cess numeric(14,2) not null default 0,
  deferred_cgst numeric(14,2) not null default 0,
  deferred_sgst numeric(14,2) not null default 0,
  deferred_igst numeric(14,2) not null default 0,
  deferred_cess numeric(14,2) not null default 0,
  reason text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint itc_status_events_tax_record_business_fk
    foreign key (purchase_tax_record_id, business_id)
    references public.purchase_tax_records(id, business_id)
);

create index if not exists itc_status_events_business_record_idx
  on public.itc_status_events(business_id, purchase_tax_record_id);

create table if not exists public.gst_reconciliation_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  operation_scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_body jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gst_reconciliation_idempotency_keys_business_scope_key_unique
    unique (business_id, operation_scope, idempotency_key),
  constraint gst_reconciliation_idempotency_keys_status_check
    check (status in ('in_progress', 'completed', 'failed'))
);
