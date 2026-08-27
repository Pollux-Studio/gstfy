create table if not exists public.business_automation_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  auto_stock_accounting_enabled boolean not null default true,
  auto_e_invoice_enabled boolean not null default true,
  bank_auto_match_high_confidence_enabled boolean not null default true,
  notify_automation_failures boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_business_automation_settings_updated_at on public.business_automation_settings;
create trigger set_business_automation_settings_updated_at
before update on public.business_automation_settings
for each row execute function public.set_updated_at();

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_type text not null,
  source_type text not null,
  source_id text not null,
  status text not null default 'queued',
  priority integer not null default 0,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_jobs_type_check
    check (job_type in (
      'stock.posted-document.sync',
      'stock.opening-stock.sync',
      'einvoice.generate',
      'bank-reconciliation.auto-match',
      'gst-report.refresh',
      'filing-review.prepare'
    )),
  constraint automation_jobs_status_check
    check (status in ('queued', 'running', 'completed', 'failed', 'retry_scheduled', 'skipped')),
  constraint automation_jobs_attempts_check
    check (attempt_count >= 0 and max_attempts > 0),
  constraint automation_jobs_source_not_empty_check
    check (length(trim(source_type)) > 0 and length(trim(source_id)) > 0)
);

create unique index if not exists automation_jobs_business_source_unique
  on public.automation_jobs (business_id, job_type, source_type, source_id);

create unique index if not exists automation_jobs_id_business_id_unique
  on public.automation_jobs (id, business_id);

create index if not exists automation_jobs_business_status_idx
  on public.automation_jobs (business_id, status, run_after);

create index if not exists automation_jobs_due_idx
  on public.automation_jobs (status, run_after, priority desc, created_at);

drop trigger if exists set_automation_jobs_updated_at on public.automation_jobs;
create trigger set_automation_jobs_updated_at
before update on public.automation_jobs
for each row execute function public.set_updated_at();

create table if not exists public.automation_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_job_events_job_idx
  on public.automation_job_events (job_id, created_at);

create index if not exists automation_job_events_business_idx
  on public.automation_job_events (business_id, created_at desc);

do $$
begin
  alter table public.automation_job_events
    add constraint automation_job_events_job_business_fk
    foreign key (job_id, business_id)
    references public.automation_jobs(id, business_id)
    on delete cascade;
exception
  when duplicate_object then null;
end $$;
