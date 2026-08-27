create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  account_type text not null,
  category text not null,
  rating integer not null,
  effort_score integer not null,
  message text not null,
  page_url text,
  contact_consent boolean not null default false,
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_feedback_account_type_check
    check (account_type in ('business', 'ca')),
  constraint user_feedback_category_check
    check (category in (
      'ease_of_use',
      'billing_pos',
      'gst_filing',
      'inventory',
      'payments',
      'performance',
      'bug',
      'feature_request',
      'other'
    )),
  constraint user_feedback_rating_check
    check (rating between 1 and 5),
  constraint user_feedback_effort_score_check
    check (effort_score between 1 and 5),
  constraint user_feedback_message_length_check
    check (length(trim(message)) between 10 and 2000),
  constraint user_feedback_status_check
    check (status in ('new', 'reviewed', 'planned', 'closed'))
);

create index if not exists user_feedback_business_id_idx
  on public.user_feedback (business_id, created_at desc);

create index if not exists user_feedback_user_id_idx
  on public.user_feedback (user_id, created_at desc);

create index if not exists user_feedback_status_idx
  on public.user_feedback (status, created_at desc);

drop trigger if exists set_user_feedback_updated_at on public.user_feedback;
create trigger set_user_feedback_updated_at
before update on public.user_feedback
for each row execute function public.set_updated_at();
