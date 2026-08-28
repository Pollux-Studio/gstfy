create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  account_type text not null,
  subject text not null,
  message text not null,
  contact_method text not null default 'none',
  contact_value text,
  workspace_name text,
  tenant_url text,
  page_url text,
  status text not null default 'open',
  priority text not null default 'normal',
  source text not null default 'workspace_support',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_account_type_check
    check (account_type in ('business', 'ca')),
  constraint support_tickets_subject_length_check
    check (length(trim(subject)) between 3 and 160),
  constraint support_tickets_message_length_check
    check (length(trim(message)) between 10 and 4000),
  constraint support_tickets_contact_method_check
    check (contact_method in ('email', 'phone', 'none')),
  constraint support_tickets_status_check
    check (status in ('open', 'in_review', 'resolved', 'closed')),
  constraint support_tickets_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'))
);

create index if not exists support_tickets_business_id_idx
  on public.support_tickets (business_id, created_at desc);

create index if not exists support_tickets_user_id_idx
  on public.support_tickets (user_id, created_at desc);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, created_at desc);

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();
