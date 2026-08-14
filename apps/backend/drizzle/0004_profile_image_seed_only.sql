alter table public.users
  add column if not exists profile_image_style text not null default 'glyphs';

update public.users
set profile_image_seed = gen_random_uuid()::text
where profile_image_seed is null
  and profile_image_url is not null;

alter table public.users
  drop column if exists profile_image_url;
