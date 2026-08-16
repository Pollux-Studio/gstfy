update public.users as user_account
set must_change_password = true
where user_account.password_hash is not null
  and user_account.email is not null
  and user_account.last_login_at is null
  and exists (
    select 1
    from public.business_members as member
    where member.user_id = user_account.id
      and member.role not in ('owner', 'admin')
  )
  and not exists (
    select 1
    from public.business_members as owner_member
    where owner_member.user_id = user_account.id
      and owner_member.role in ('owner', 'admin')
  );
