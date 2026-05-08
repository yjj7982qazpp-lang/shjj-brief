-- SHJJ Brief Supabase RPC Patch
-- Purpose: save member list changes from the company room admin UI.
-- Apply manually in Supabase SQL Editor after preview review.
-- Existing tables assumed: company_members, invite_codes.

create or replace function public.save_company_members_rpc(
  p_company_id uuid,
  p_admin_member_id uuid,
  p_members jsonb
)
returns table(ok boolean, message text, saved_count integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item jsonb;
  v_member_id uuid;
  v_saved_count integer := 0;
  v_invite_code text;
  v_member_name text;
  v_role text;
  v_schedule_permission text;
  v_status text;
begin
  if not exists (
    select 1
    from company_members m
    where m.id = p_admin_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
      and m.role = 'admin'
  ) then
    return query select false, '관리자 권한이 없습니다.'::text, 0;
    return;
  end if;

  if jsonb_typeof(p_members) <> 'array' then
    return query select false, '구성원 저장 데이터 형식이 올바르지 않습니다.'::text, 0;
    return;
  end if;

  for v_item in select * from jsonb_array_elements(p_members)
  loop
    v_invite_code := upper(trim(coalesce(v_item->>'invite_code', '')));
    v_member_name := nullif(trim(coalesce(v_item->>'member_name', '')), '');
    v_role := case when v_item->>'role' = 'admin' then 'admin' else 'member' end;
    v_schedule_permission := case when v_role = 'admin' or v_item->>'schedule_permission' = 'write' then 'write' else 'read' end;
    v_status := case when v_item->>'status' = 'inactive' then 'inactive' else 'active' end;

    if v_invite_code = '' or v_member_name is null then
      continue;
    end if;

    if nullif(v_item->>'member_id', '') is not null then
      v_member_id := (v_item->>'member_id')::uuid;
    else
      select ic.member_id
      into v_member_id
      from invite_codes ic
      where ic.company_id = p_company_id
        and upper(ic.invite_code) = v_invite_code
      limit 1;
    end if;

    if v_member_id is not null and exists (
      select 1 from company_members m where m.id = v_member_id and m.company_id = p_company_id
    ) then
      update company_members
      set
        display_name = v_member_name,
        role = v_role,
        schedule_permission = v_schedule_permission,
        status = v_status
      where id = v_member_id
        and company_id = p_company_id;
    else
      insert into company_members (
        company_id,
        display_name,
        role,
        schedule_permission,
        status
      ) values (
        p_company_id,
        v_member_name,
        v_role,
        v_schedule_permission,
        v_status
      )
      returning id into v_member_id;
    end if;

    insert into invite_codes (
      company_id,
      member_id,
      invite_code,
      pin_code,
      status
    ) values (
      p_company_id,
      v_member_id,
      v_invite_code,
      '0000',
      case when v_status = 'active' then 'active' else 'revoked' end
    )
    on conflict (invite_code)
    do update set
      company_id = excluded.company_id,
      member_id = excluded.member_id,
      pin_code = excluded.pin_code,
      status = excluded.status;

    v_saved_count := v_saved_count + 1;
  end loop;

  return query select true, '구성원 변경 저장 완료'::text, v_saved_count;
end;
$function$;
