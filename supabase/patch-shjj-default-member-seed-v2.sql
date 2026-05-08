-- SHJJ Brief seed patch v2
-- Purpose:
-- - Ensure the default SHJJ admin/member accounts exist and stay stable.
-- - Keep SHJJ-ADMIN / 0920 and SHJJ-MEMBER / 0000 available.

do $$
declare
  v_company_id uuid := 'e978f664-848e-4609-a56a-820d11ef55e6';
  v_admin_member_id uuid;
  v_member_member_id uuid;
begin
  select m.id
  into v_admin_member_id
  from company_members m
  left join invite_codes ic
    on ic.member_id = m.id
   and ic.company_id = m.company_id
  where m.company_id = v_company_id
    and (
      m.role = 'admin'
      or upper(coalesce(ic.invite_code, '')) = 'SHJJ-ADMIN'
    )
  order by case when m.role = 'admin' then 0 else 1 end, m.created_at asc
  limit 1;

  if v_admin_member_id is null then
    insert into company_members (
      company_id,
      display_name,
      role,
      schedule_permission,
      status
    ) values (
      v_company_id,
      '관리자',
      'admin',
      'write',
      'active'
    )
    returning id into v_admin_member_id;
  else
    update company_members
    set
      display_name = '관리자',
      role = 'admin',
      schedule_permission = 'write',
      status = 'active'
    where id = v_admin_member_id
      and company_id = v_company_id;
  end if;

  insert into invite_codes (
    company_id,
    member_id,
    invite_code,
    pin_code,
    status
  ) values (
    v_company_id,
    v_admin_member_id,
    'SHJJ-ADMIN',
    '0920',
    'active'
  )
  on conflict (invite_code)
  do update set
    company_id = excluded.company_id,
    member_id = excluded.member_id,
    pin_code = excluded.pin_code,
    status = 'active';

  select m.id
  into v_member_member_id
  from company_members m
  left join invite_codes ic
    on ic.member_id = m.id
   and ic.company_id = m.company_id
  where m.company_id = v_company_id
    and m.role <> 'admin'
    and (
      upper(coalesce(ic.invite_code, '')) = 'SHJJ-MEMBER'
      or m.display_name = '구성원'
    )
  order by m.created_at asc
  limit 1;

  if v_member_member_id is null then
    insert into company_members (
      company_id,
      display_name,
      role,
      schedule_permission,
      status
    ) values (
      v_company_id,
      '구성원',
      'member',
      'read',
      'active'
    )
    returning id into v_member_member_id;
  else
    update company_members
    set
      display_name = '구성원',
      role = 'member',
      schedule_permission = 'read',
      status = 'active'
    where id = v_member_member_id
      and company_id = v_company_id;
  end if;

  insert into invite_codes (
    company_id,
    member_id,
    invite_code,
    pin_code,
    status
  ) values (
    v_company_id,
    v_member_member_id,
    'SHJJ-MEMBER',
    '0000',
    'active'
  )
  on conflict (invite_code)
  do update set
    company_id = excluded.company_id,
    member_id = excluded.member_id,
    pin_code = excluded.pin_code,
    status = 'active';
end
$$;
