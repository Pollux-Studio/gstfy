alter table public.gst_reporting_runs
  add column if not exists gstin_snapshot text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists version integer not null default 1,
  add column if not exists source_data_hash text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approval_comment text,
  add column if not exists ready_for_submission_at timestamptz,
  add column if not exists ready_for_submission_by uuid references public.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.users(id) on delete set null,
  add column if not exists filed_at timestamptz,
  add column if not exists filed_by uuid references public.users(id) on delete set null;

alter table public.gst_reporting_facts
  add column if not exists gstin_snapshot text;

alter table public.gst_reporting_exceptions
  add column if not exists gstin_snapshot text;

alter table public.gst_reporting_exports
  add column if not exists gstin_snapshot text;

update public.gst_reporting_runs run
set
  gstin_snapshot = coalesce(run.gstin_snapshot, registration.gstin),
  period_start = coalesce(
    run.period_start,
    make_date(substring(run.period from 1 for 4)::int, substring(run.period from 6 for 2)::int, 1)
  ),
  period_end = coalesce(
    run.period_end,
    (
      make_date(substring(run.period from 1 for 4)::int, substring(run.period from 6 for 2)::int, 1)
      + interval '1 month'
      - interval '1 day'
    )::date
  )
from public.gst_registrations registration
where registration.id = run.gst_registration_id
  and registration.business_id = run.business_id;

update public.gst_reporting_facts fact
set gstin_snapshot = coalesce(fact.gstin_snapshot, registration.gstin)
from public.gst_registrations registration
where registration.id = fact.gst_registration_id
  and registration.business_id = fact.business_id;

update public.gst_reporting_exceptions exception
set gstin_snapshot = coalesce(exception.gstin_snapshot, registration.gstin)
from public.gst_registrations registration
where registration.id = exception.gst_registration_id
  and registration.business_id = exception.business_id;

update public.gst_reporting_exports export_row
set gstin_snapshot = coalesce(export_row.gstin_snapshot, registration.gstin)
from public.gst_registrations registration
where registration.id = export_row.gst_registration_id
  and registration.business_id = export_row.business_id;

update public.gst_reporting_runs
set status = case
  when status = 'READY' then 'READY_FOR_CA_REVIEW'
  when status in ('LOCKED', 'EXPORTED') then 'READY_FOR_SUBMISSION'
  else status
end
where status in ('READY', 'LOCKED', 'EXPORTED');

alter table public.gst_reporting_runs
  drop constraint if exists gst_reporting_runs_status_chk;

alter table public.gst_reporting_runs
  add constraint gst_reporting_runs_status_chk check (
    status in (
      'DRAFT',
      'REVIEW',
      'READY_FOR_CA_REVIEW',
      'CA_APPROVED',
      'READY_FOR_SUBMISSION',
      'SUBMITTED',
      'FILED',
      'LOCKED'
    )
  );

drop index if exists public.gst_reporting_runs_business_gstin_period_unique;

create unique index if not exists gst_reporting_runs_business_gstin_period_version_unique
  on public.gst_reporting_runs(business_id, gst_registration_id, period, version);

create index if not exists gst_reporting_runs_business_period_version_idx
  on public.gst_reporting_runs(business_id, gst_registration_id, period, version desc);

create unique index if not exists gst_reporting_facts_source_identity_unique
  on public.gst_reporting_facts(
    run_id,
    source_document_type,
    source_document_id,
    source_line_id
  )
  where source_document_id is not null
    and source_line_id is not null;
