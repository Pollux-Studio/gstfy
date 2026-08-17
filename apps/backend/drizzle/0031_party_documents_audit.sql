CREATE TABLE IF NOT EXISTS public.party_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  document_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  file_reference text NOT NULL,
  file_name text,
  mime_type text,
  file_size_bytes integer CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  notes text,
  status text NOT NULL DEFAULT 'active',
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS party_documents_business_id_idx
  ON public.party_documents(business_id);

CREATE INDEX IF NOT EXISTS party_documents_party_id_idx
  ON public.party_documents(party_id);

CREATE INDEX IF NOT EXISTS party_documents_status_idx
  ON public.party_documents(status);

CREATE UNIQUE INDEX IF NOT EXISTS party_documents_id_business_id_unique
  ON public.party_documents(id, business_id);

CREATE UNIQUE INDEX IF NOT EXISTS party_documents_id_party_business_unique
  ON public.party_documents(id, party_id, business_id);

ALTER TABLE public.party_documents
  DROP CONSTRAINT IF EXISTS party_documents_party_business_fk;

ALTER TABLE public.party_documents
  ADD CONSTRAINT party_documents_party_business_fk
  FOREIGN KEY (party_id, business_id)
  REFERENCES public.parties(id, business_id)
  ON DELETE RESTRICT;

DROP TRIGGER IF EXISTS set_party_documents_updated_at ON public.party_documents;

CREATE TRIGGER set_party_documents_updated_at
  BEFORE UPDATE ON public.party_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
