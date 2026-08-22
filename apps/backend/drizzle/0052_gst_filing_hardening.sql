alter table if exists public.gst_filing_runs
  add column if not exists external_response_received_at timestamptz,
  add column if not exists acknowledgement_artifact_id text,
  add column if not exists correction_required_at timestamptz,
  add column if not exists correction_reason text;

alter table if exists public.gst_filing_runs
  drop constraint if exists gst_filing_runs_external_response_received_chk;

alter table if exists public.gst_filing_runs
  add constraint gst_filing_runs_external_response_received_chk
  check (raw_external_response is null or external_response_received_at is not null);
