alter table public.businesses
  add column if not exists tenant_slug text;

do $$
declare
  business_record record;
  base_slug text;
  candidate_slug text;
  suffix integer;
begin
  for business_record in
    select id, trade_name, legal_name
    from public.businesses
    where tenant_slug is null or btrim(tenant_slug) = ''
  loop
    base_slug := lower(
      regexp_replace(
        coalesce(
          nullif(btrim(business_record.trade_name), ''),
          nullif(btrim(business_record.legal_name), ''),
          business_record.id::text
        ),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    );
    base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
    base_slug := left(base_slug, 48);

    if length(base_slug) < 3 then
      base_slug := 'business';
    end if;

    if base_slug in ('api', 'app', 'auth', 'admin', 'www', 'mail', 'support', 'gstfy') then
      base_slug := left(base_slug || '-business', 48);
    end if;

    candidate_slug := base_slug;
    suffix := 2;

    while exists (
      select 1
      from public.businesses
      where tenant_slug = candidate_slug
        and id <> business_record.id
    ) loop
      candidate_slug := left(base_slug, greatest(3, 48 - length(suffix::text) - 1)) || '-' || suffix::text;
      suffix := suffix + 1;
    end loop;

    update public.businesses
    set tenant_slug = candidate_slug,
        updated_at = now()
    where id = business_record.id;
  end loop;
end $$;

alter table public.businesses
  alter column tenant_slug set not null;

create unique index if not exists businesses_tenant_slug_unique
  on public.businesses (tenant_slug);
