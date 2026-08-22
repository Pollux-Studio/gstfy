alter table public.purchase_bills
  add column if not exists delivery_note_number text,
  add column if not exists buyer_order_number text,
  add column if not exists buyer_order_date text,
  add column if not exists dispatch_document_number text,
  add column if not exists delivery_note_date text,
  add column if not exists dispatched_through text,
  add column if not exists destination text,
  add column if not exists terms_of_delivery text;
