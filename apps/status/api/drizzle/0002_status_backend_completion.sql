create table if not exists public.status_admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'admin',
  permissions text[] not null default array[]::text[],
  mfa_enabled boolean not null default false,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_admin_users_role_check check (
    role in ('owner', 'admin', 'incident_manager', 'viewer')
  )
);

create unique index if not exists status_admin_users_email_lower_idx
on public.status_admin_users(lower(email));

drop trigger if exists status_admin_users_touch_updated_at on public.status_admin_users;
create trigger status_admin_users_touch_updated_at
before update on public.status_admin_users
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.status_admin_users(id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists status_admin_sessions_user_idx
on public.status_admin_sessions(user_id, expires_at desc);

create table if not exists public.status_api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array[]::text[],
  active boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.status_admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists status_api_keys_active_idx
on public.status_api_keys(active, expires_at);

drop trigger if exists status_api_keys_touch_updated_at on public.status_api_keys;
create trigger status_api_keys_touch_updated_at
before update on public.status_api_keys
for each row
execute function public.gstfy_status_touch_updated_at();

alter table public.status_subscriptions
  add column if not exists webhook_secret_ciphertext text,
  add column if not exists webhook_secret_iv text,
  add column if not exists webhook_secret_tag text,
  add column if not exists webhook_unhealthy boolean not null default false;

alter table public.status_notification_deliveries
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists headers jsonb not null default '{}'::jsonb,
  add column if not exists delivery_id uuid not null default gen_random_uuid(),
  add column if not exists subscription_type text;

create index if not exists status_notification_deliveries_next_attempt_idx
on public.status_notification_deliveries(status, next_attempt_at, created_at);

create table if not exists public.status_worker_heartbeats (
  worker_id text primary key,
  worker_type text not null,
  region text not null,
  version text not null,
  status text not null,
  queue_name text,
  last_seen timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_worker_heartbeats_type_check check (
    worker_type in ('monitoring', 'incident-engine', 'notifications')
  ),
  constraint status_worker_heartbeats_status_check check (
    status in ('starting', 'healthy', 'degraded', 'stopped')
  )
);

drop trigger if exists status_worker_heartbeats_touch_updated_at on public.status_worker_heartbeats;
create trigger status_worker_heartbeats_touch_updated_at
before update on public.status_worker_heartbeats
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_sla_targets (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.status_services(id) on delete restrict,
  availability_target numeric(6,3) not null default 99.900,
  latency_p95_target_ms integer,
  exclude_maintenance boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_sla_targets_availability_check check (
    availability_target > 0 and availability_target <= 100
  ),
  constraint status_sla_targets_latency_check check (
    latency_p95_target_ms is null or latency_p95_target_ms > 0
  )
);

drop trigger if exists status_sla_targets_touch_updated_at on public.status_sla_targets;
create trigger status_sla_targets_touch_updated_at
before update on public.status_sla_targets
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_postmortems (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null unique references public.status_incidents(id) on delete restrict,
  summary text not null,
  root_cause text,
  impact text,
  timeline text,
  resolution text,
  preventive_actions text,
  follow_up_tasks text,
  public boolean not null default false,
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_postmortems_public_publish_check check (
    (public = false) or (public = true and published_at is not null)
  )
);

drop trigger if exists status_postmortems_touch_updated_at on public.status_postmortems;
create trigger status_postmortems_touch_updated_at
before update on public.status_postmortems
for each row
execute function public.gstfy_status_touch_updated_at();

create table if not exists public.status_monitor_aggregates (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.status_services(id) on delete restrict,
  monitor_id uuid references public.status_monitors(id) on delete restrict,
  region text not null,
  bucket_start timestamptz not null,
  bucket_size text not null,
  total_checks integer not null default 0,
  success_checks integer not null default 0,
  failed_checks integer not null default 0,
  degraded_checks integer not null default 0,
  avg_response_time_ms numeric(12,2),
  p95_response_time_ms integer,
  p99_response_time_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_monitor_aggregates_bucket_size_check check (
    bucket_size in ('5m', '1h', '1d')
  ),
  constraint status_monitor_aggregates_counts_check check (
    total_checks >= 0
    and success_checks >= 0
    and failed_checks >= 0
    and degraded_checks >= 0
  )
);

create unique index if not exists status_monitor_aggregates_unique_idx
on public.status_monitor_aggregates(
  service_id,
  coalesce(monitor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  region,
  bucket_start,
  bucket_size
);

drop trigger if exists status_monitor_aggregates_touch_updated_at on public.status_monitor_aggregates;
create trigger status_monitor_aggregates_touch_updated_at
before update on public.status_monitor_aggregates
for each row
execute function public.gstfy_status_touch_updated_at();
