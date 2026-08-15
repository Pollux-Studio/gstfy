update "public"."gst_registrations"
set
  "state_code" = substring(upper("gstin") from 1 for 2),
  "updated_at" = now()
where
  ("state_code" is null or "state_code" = '')
  and "gstin" ~ '^[0-9]{2}';

update "public"."business_locations" bl
set
  "state_code" = substring(upper(gr."gstin") from 1 for 2),
  "updated_at" = now()
from "public"."gst_registrations" gr
where
  gr."principal_location_id" = bl."id"
  and (bl."state_code" is null or bl."state_code" = '')
  and gr."gstin" ~ '^[0-9]{2}';
