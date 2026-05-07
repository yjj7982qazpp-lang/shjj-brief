-- SHJJ Brief Existing Supabase RPC Patch Draft
-- Purpose: patch current existing tables/RPCs without creating duplicate tables.
-- Target flow: feature/supabase-rpc-patch -> preview-main -> manual Supabase SQL Editor review/apply.
-- Important: Do not run supabase/schema.sql as-is against the current project.

-- =========================================================
-- 0. Existing DB mapping
-- =========================================================
-- Current tables to keep:
-- - companies
-- - company_members
-- - invite_codes
-- - member_sessions
-- - schedules
-- - user_settings
--
-- Do NOT create duplicate tables:
-- - company_invites
-- - company_schedules
--
-- This patch only replaces selected existing RPCs.

-- =========================================================
-- 1. Patch set_company_member_status_rpc
-- =========================================================
-- Goal:
-- - Keep member status as active/inactive.
-- - When a member is deactivated, invite_codes.status should become revoked.
-- - When a member is restored, invite_codes.status can become active again.
-- - Prevent the active admin from deactivating himself.

create or replace function public.set_company_member_status_rpc(
  p_company_id uuid,
  p_admin_member_id uuid,
  p_target_member_id uuid,
  p_status text
)
returns table(ok boolean, message text, member_id uuid, status text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
  v_invite_status text;
begin
  v_status := case when p_status = 'inactive' then 'inactive' else 'active' end;
  v_invite_status := case when v_status = 'inactive' then 'revoked' else 'active' end;

  if not exists (
    select 1
    from company_members m
    where m.id = p_admin_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
      and m.role = 'admin'
  ) then
    return query
    select false, '관리자 권한이 없습니다.'::text, null::uuid, null::text;
    return;
  end if;

  if p_admin_member_id = p_target_member_id and v_status = 'inactive' then
    return query
    select false, '본인 관리자 계정은 비활성화할 수 없습니다.'::text, p_target_member_id, null::text;
    return;
  end if;

  update company_members
  set status = v_status
  where id = p_target_member_id
    and company_id = p_company_id;

  if not found then
    return query
    select false, '구성원을 찾을 수 없습니다.'::text, p_target_member_id, null::text;
    return;
  end if;

  update invite_codes
  set status = v_invite_status
  where member_id = p_target_member_id
    and company_id = p_company_id;

  return query
  select true, '구성원 상태 변경 완료'::text, p_target_member_id, v_status;
end;
$function$;

-- =========================================================
-- 2. Patch update_company_schedule
-- =========================================================
-- Goal:
-- - admin can update every schedule in the company.
-- - editor/write member can update only schedules created by himself.
-- - viewer/read member cannot update schedules.

create or replace function public.update_company_schedule(
  p_company_id uuid,
  p_member_id uuid,
  p_schedule_id uuid,
  p_schedule_date date,
  p_schedule_time time without time zone default null::time without time zone,
  p_title text default ''::text,
  p_location text default null::text,
  p_memo text default null::text
)
returns table(
  ok boolean,
  message text,
  id uuid,
  company_id uuid,
  created_by_member_id uuid,
  schedule_date date,
  schedule_time time without time zone,
  title text,
  location text,
  memo text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_admin boolean := false;
  v_can_edit_own boolean := false;
begin
  if nullif(trim(p_title), '') is null then
    return query
    select false, '일정명을 입력해주세요.'::text,
      null::uuid, null::uuid, null::uuid, null::date, null::time,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select
    exists (
      select 1
      from company_members m
      where m.id = p_member_id
        and m.company_id = p_company_id
        and m.status = 'active'
        and m.role = 'admin'
    ),
    exists (
      select 1
      from company_members m
      join schedules s
        on s.id = p_schedule_id
       and s.company_id = p_company_id
      where m.id = p_member_id
        and m.company_id = p_company_id
        and m.status = 'active'
        and m.schedule_permission = 'write'
        and s.created_by_member_id = p_member_id
    )
  into v_is_admin, v_can_edit_own;

  if not (v_is_admin or v_can_edit_own) then
    return query
    select false, '일정 수정 권한이 없습니다.'::text,
      null::uuid, null::uuid, null::uuid, null::date, null::time,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  return query
  with updated as (
    update schedules s
    set
      schedule_date = p_schedule_date,
      schedule_time = p_schedule_time,
      title = trim(p_title),
      location = nullif(trim(coalesce(p_location, '')), ''),
      memo = nullif(trim(coalesce(p_memo, '')), ''),
      updated_at = now()
    where s.id = p_schedule_id
      and s.company_id = p_company_id
    returning *
  )
  select
    true,
    '일정 수정 완료'::text,
    u.id,
    u.company_id,
    u.created_by_member_id,
    u.schedule_date,
    u.schedule_time,
    u.title,
    u.location,
    u.memo,
    u.created_at,
    u.updated_at
  from updated u;
end;
$function$;

-- =========================================================
-- 3. Patch delete_company_schedule
-- =========================================================
-- Goal:
-- - Only active admin can delete schedules.
-- - editor/write member cannot delete schedules in MVP.
-- - Current table has no status column, so deletion is physical delete for now.
-- - Soft delete should be a later migration if a status column is added to schedules.

create or replace function public.delete_company_schedule(
  p_company_id uuid,
  p_member_id uuid,
  p_schedule_id uuid
)
returns table(ok boolean, message text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1
    from company_members m
    where m.id = p_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
      and m.role = 'admin'
  ) then
    return query
    select false, '일정 삭제는 관리자만 가능합니다.'::text;
    return;
  end if;

  delete from schedules s
  where s.id = p_schedule_id
    and s.company_id = p_company_id;

  if not found then
    return query
    select false, '삭제할 일정을 찾을 수 없습니다.'::text;
    return;
  end if;

  return query
  select true, '일정 삭제 완료'::text;
end;
$function$;

-- =========================================================
-- 4. Patch verify_invite_code messages
-- =========================================================
-- Goal:
-- - Keep current invite_code + PIN flow.
-- - Return clearer message for revoked/expired/inactive member states.
-- - Current client already displays result.message when ok=false.

create or replace function public.verify_invite_code(
  p_invite_code text,
  p_pin_code text
)
returns table(
  ok boolean,
  company_id uuid,
  company_name text,
  member_id uuid,
  member_name text,
  role text,
  schedule_permission text,
  member_status text,
  message text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row record;
begin
  select
    ic.status as invite_status,
    ic.expires_at,
    c.id as company_id,
    c.name as company_name,
    m.id as member_id,
    m.display_name as member_name,
    m.role,
    m.schedule_permission,
    m.status as member_status
  into v_row
  from invite_codes ic
  join companies c on c.id = ic.company_id
  join company_members m on m.id = ic.member_id
  where upper(ic.invite_code) = upper(trim(p_invite_code))
    and ic.pin_code = trim(p_pin_code)
  limit 1;

  if v_row is null then
    return query
    select false, null::uuid, null::text, null::uuid, null::text, null::text, null::text, null::text,
      '초대코드 또는 PIN이 올바르지 않습니다.'::text;
    return;
  end if;

  if v_row.invite_status = 'revoked' then
    return query
    select false, null::uuid, null::text, null::uuid, null::text, null::text, null::text, null::text,
      '사용할 수 없는 초대코드입니다. 관리자에게 문의하세요.'::text;
    return;
  end if;

  if v_row.invite_status <> 'active' then
    return query
    select false, null::uuid, null::text, null::uuid, null::text, null::text, null::text, null::text,
      '활성화되지 않은 초대코드입니다. 관리자에게 문의하세요.'::text;
    return;
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return query
    select false, null::uuid, null::text, null::uuid, null::text, null::text, null::text, null::text,
      '만료된 초대코드입니다. 관리자에게 문의하세요.'::text;
    return;
  end if;

  if v_row.member_status <> 'active' then
    return query
    select false, null::uuid, null::text, null::uuid, null::text, null::text, null::text, v_row.member_status,
      '접근이 제한되었습니다. 관리자에게 문의하세요.'::text;
    return;
  end if;

  return query
  select
    true,
    v_row.company_id,
    v_row.company_name,
    v_row.member_id,
    v_row.member_name,
    v_row.role,
    v_row.schedule_permission,
    v_row.member_status,
    '인증 성공'::text;
end;
$function$;

-- =========================================================
-- 5. Post-apply smoke test queries
-- =========================================================
-- These are examples. Replace UUID values before running.

-- select * from public.set_company_member_status_rpc(
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000',
--   'inactive'
-- );

-- select * from public.delete_company_schedule(
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000'
-- );

-- =========================================================
-- 6. Review checklist
-- =========================================================
-- [ ] Confirm current production code expects invite_codes.status active/inactive or active/revoked.
-- [ ] Confirm UI handles revoked invite status message properly.
-- [ ] Confirm editor should only edit own schedules.
-- [ ] Confirm admin-only delete policy.
-- [ ] Apply to Supabase only after preview-main review.
