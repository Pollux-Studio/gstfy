alter table public.parties
  add column if not exists profile_image_seed text;

update public.parties
set profile_image_seed = id::text
where profile_image_seed is null;
