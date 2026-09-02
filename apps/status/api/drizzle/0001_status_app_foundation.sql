create extension if not exists pgcrypto;

create or replace function public.gstfy_status_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.status_service_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  display_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists status_service_groups_touch_updated_at on public.status_service_groups;
create trigger status_service_groups_touch_updated_at
before update on public.status_service_groups
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_services (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.status_service_groups(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'operational',
  display_order integer not null default 0,
  is_public boolean not null default true,
  monitoring_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_services_status_check check (
    status in (
      'operational',
      'degraded_performance',
      'partial_outage',
      'major_outage',
      'maintenance',
      'unknown'
    )
  )
);

create index if not exists status_services_group_idx
on public.status_services(group_id, display_order, name);

create index if not exists status_services_public_idx
on public.status_services(is_public, display_order, name);

drop trigger if exists status_services_touch_updated_at on public.status_services;
create trigger status_services_touch_updated_at
before update on public.status_services
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  status text not null default 'investigating',
  severity text not null default 'minor',
  impact text not null default 'degraded',
  created_by text,
  detected_automatically boolean not null default false,
  scheduled boolean not null default false,
  public boolean not null default true,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_incidents_status_check check (
    status in ('investigating', 'identified', 'monitoring', 'resolved')
  ),
  constraint status_incidents_severity_check check (
    severity in ('minor', 'major', 'critical')
  ),
  constraint status_incidents_impact_check check (
    impact in ('none', 'degraded', 'partial', 'major')
  ),
  constraint status_incidents_resolved_at_check check (
    (status <> 'resolved' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index if not exists status_incidents_public_status_idx
on public.status_incidents(public, status, started_at desc);

drop trigger if exists status_incidents_touch_updated_at on public.status_incidents;
create trigger status_incidents_touch_updated_at
before update on public.status_incidents
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_service_status_history (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.status_services(id) on delete restrict,
  old_status text,
  new_status text not null,
  reason text,
  incident_id uuid references public.status_incidents(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint status_history_old_status_check check (
    old_status is null
    or old_status in (
      'operational',
      'degraded_performance',
      'partial_outage',
      'major_outage',
      'maintenance',
      'unknown'
    )
  ),
  constraint status_history_new_status_check check (
    new_status in (
      'operational',
      'degraded_performance',
      'partial_outage',
      'major_outage',
      'maintenance',
      'unknown'
    )
  )
);

create index if not exists status_service_status_history_service_idx
on public.status_service_status_history(service_id, created_at desc);

create table if not exists public.status_service_dependencies (
  service_id uuid not null references public.status_services(id) on delete restrict,
  depends_on_service_id uuid not null references public.status_services(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (service_id, depends_on_service_id),
  constraint status_service_dependencies_no_self_check check (
    service_id <> depends_on_service_id
  )
);

create table if not exists public.status_monitors (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.status_services(id) on delete restrict,
  name text not null,
  check_type text not null,
  target text not null,
  interval_seconds integer not null default 300,
  timeout_seconds integer not null default 10,
  expected_status integer,
  expected_body text,
  expected_headers jsonb not null default '{}'::jsonb,
  regions text[] not null default array['india']::text[],
  retry_count integer not null default 1,
  failure_threshold integer not null default 3,
  recovery_threshold integer not null default 3,
  consecutive_failures integer not null default 0,
  consecutive_successes integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_monitors_check_type_check check (
    check_type in ('http', 'tcp', 'dns', 'ssl', 'health')
  ),
  constraint status_monitors_interval_check check (
    interval_seconds in (60, 300, 600, 900, 1800, 3600)
  ),
  constraint status_monitors_positive_timeout_check check (timeout_seconds > 0),
  constraint status_monitors_positive_retry_check check (retry_count >= 0),
  constraint status_monitors_positive_failure_check check (failure_threshold > 0),
  constraint status_monitors_positive_recovery_check check (recovery_threshold > 0)
);

create index if not exists status_monitors_service_idx
on public.status_monitors(service_id, enabled);

drop trigger if exists status_monitors_touch_updated_at on public.status_monitors;
create trigger status_monitors_touch_updated_at
before update on public.status_monitors
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_monitor_results (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.status_monitors(id) on delete restrict,
  service_id uuid not null references public.status_services(id) on delete restrict,
  region text not null,
  status text not null,
  http_status integer,
  response_time_ms integer,
  error_message text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint status_monitor_results_status_check check (
    status in ('success', 'failed', 'degraded', 'timeout', 'skipped')
  ),
  constraint status_monitor_results_response_time_check check (
    response_time_ms is null or response_time_ms >= 0
  )
);

create index if not exists status_monitor_results_monitor_idx
on public.status_monitor_results(monitor_id, checked_at desc);

create index if not exists status_monitor_results_service_idx
on public.status_monitor_results(service_id, checked_at desc);

create table if not exists public.status_incident_services (
  incident_id uuid not null references public.status_incidents(id) on delete restrict,
  service_id uuid not null references public.status_services(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (incident_id, service_id)
);

create index if not exists status_incident_services_service_idx
on public.status_incident_services(service_id, incident_id);

create table if not exists public.status_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.status_incidents(id) on delete restrict,
  status text not null,
  message text not null,
  author_id text,
  public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint status_incident_updates_status_check check (
    status in ('investigating', 'identified', 'monitoring', 'resolved')
  )
);

create index if not exists status_incident_updates_incident_idx
on public.status_incident_updates(incident_id, created_at asc);

create table if not exists public.status_maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  status text not null default 'scheduled',
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  public boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_maintenance_status_check check (
    status in ('scheduled', 'in_progress', 'completed', 'cancelled')
  ),
  constraint status_maintenance_time_check check (end_at > start_at)
);

create index if not exists status_maintenance_public_status_idx
on public.status_maintenance_windows(public, status, start_at desc);

drop trigger if exists status_maintenance_touch_updated_at on public.status_maintenance_windows;
create trigger status_maintenance_touch_updated_at
before update on public.status_maintenance_windows
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_maintenance_services (
  maintenance_id uuid not null references public.status_maintenance_windows(id) on delete restrict,
  service_id uuid not null references public.status_services(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (maintenance_id, service_id)
);

create table if not exists public.status_subscriptions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  email text,
  webhook_url text,
  slack_webhook_url text,
  teams_webhook_url text,
  verification_token_hash text,
  verified boolean not null default false,
  active boolean not null default true,
  subscribed_all boolean not null default true,
  incident_updates boolean not null default true,
  maintenance_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_subscriptions_type_check check (
    type in ('email', 'webhook', 'slack', 'teams')
  ),
  constraint status_subscriptions_destination_check check (
    (type = 'email' and email is not null)
    or (type = 'webhook' and webhook_url is not null)
    or (type = 'slack' and slack_webhook_url is not null)
    or (type = 'teams' and teams_webhook_url is not null)
  )
);

create index if not exists status_subscriptions_active_idx
on public.status_subscriptions(active, verified, type);

create unique index if not exists status_subscriptions_email_unique_idx
on public.status_subscriptions(lower(email))
where email is not null;

drop trigger if exists status_subscriptions_touch_updated_at on public.status_subscriptions;
create trigger status_subscriptions_touch_updated_at
before update on public.status_subscriptions
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_subscription_services (
  subscription_id uuid not null references public.status_subscriptions(id) on delete restrict,
  service_id uuid not null references public.status_services(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (subscription_id, service_id)
);

create table if not exists public.status_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.status_subscriptions(id) on delete set null,
  event text not null,
  target text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_notification_deliveries_status_check check (
    status in ('pending', 'delivered', 'failed', 'retrying', 'disabled')
  ),
  constraint status_notification_deliveries_attempts_check check (attempts >= 0)
);

create index if not exists status_notification_deliveries_status_idx
on public.status_notification_deliveries(status, next_attempt_at);

drop trigger if exists status_notification_deliveries_touch_updated_at on public.status_notification_deliveries;
create trigger status_notification_deliveries_touch_updated_at
before update on public.status_notification_deliveries
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'admin',
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists status_audit_logs_entity_idx
on public.status_audit_logs(entity_type, entity_id, created_at desc);

create index if not exists status_audit_logs_created_idx
on public.status_audit_logs(created_at desc);

create table if not exists public.status_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.status_service_groups (name, slug, description, display_order, is_public)
values
  ('GSTfy Platform', 'gstfy-platform', 'Customer-facing GSTfy application services.', 10, true),
  ('Infrastructure', 'infrastructure', 'Core infrastructure used by GSTfy services.', 20, true),
  ('External Services', 'external-services', 'Third-party dependencies used by GSTfy.', 30, true)
on conflict (slug) do nothing;

insert into public.status_services (
  group_id,
  name,
  slug,
  description,
  status,
  display_order,
  is_public,
  monitoring_enabled
)
select
  groups.id,
  seed.name,
  seed.slug,
  seed.description,
  'operational',
  seed.display_order,
  true,
  true
from (
  values
    ('gstfy-platform', 'GSTfy Web Application', 'web-application', 'Main GSTfy web app and tenant dashboard.', 10),
    ('gstfy-platform', 'GSTfy API', 'api', 'Main API used by GSTfy web and POS flows.', 20),
    ('gstfy-platform', 'Authentication', 'authentication', 'Login, session, and tenant lookup services.', 30),
    ('gstfy-platform', 'Invoice Engine', 'invoice-engine', 'Sales invoices, purchase bills, returns, and invoice PDFs.', 40),
    ('gstfy-platform', 'GST Integration', 'gst-integration', 'GST filing, reconciliation, ITC, and e-invoice provider operations.', 50),
    ('infrastructure', 'Primary Database', 'primary-database', 'Primary PostgreSQL database for GSTfy application data.', 10),
    ('infrastructure', 'Redis and Queues', 'redis-queues', 'Redis-backed queues and automation workers.', 20),
    ('infrastructure', 'Object Storage', 'object-storage', 'Cloudflare R2 storage for product images, logos, and documents.', 30),
    ('infrastructure', 'Background Workers', 'background-workers', 'Automation, reconciliation, notifications, and e-invoice workers.', 40),
    ('external-services', 'Payment Provider', 'payment-provider', 'Payment gateway and subscription billing dependency.', 10),
    ('external-services', 'Email Provider', 'email-provider', 'Transactional email delivery dependency.', 20),
    ('external-services', 'SMS Provider', 'sms-provider', 'SMS and OTP delivery dependency.', 30)
) as seed(group_slug, name, slug, description, display_order)
join public.status_service_groups groups on groups.slug = seed.group_slug
on conflict (slug) do nothing;

insert into public.status_settings (key, value)
values
  ('overall_status_precedence', '["major_outage","partial_outage","degraded_performance","maintenance","unknown","operational"]'::jsonb),
  ('branding', '{"name":"GSTfy","title":"GSTfy System Status","supportUrl":"https://gstfy.in/support"}'::jsonb),
  ('retention', '{"rawChecksDays":30,"aggregateFiveMinuteDays":90,"aggregateHourlyDays":365}'::jsonb)
on conflict (key) do nothing;
