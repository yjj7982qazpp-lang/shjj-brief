-- SHJJ Brief Supabase RPC Patch
-- Purpose: return company members with invite code and schedule permission
-- for the admin company-room UI without relying on localStorage.

create or replace function public.list_company_members_with_invites_rpc(
  p_requester_member_id uuid,
  p_company_id uuid
)
returns table (
  member_id uuid,
  member_name text,
  role text,
  schedule_permission text,
  status text,
  invite_code text,
  pin_code text,
  invite_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1
    from company_members m
    where m.id = p_requester_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
      and m.role = 'admin'
  ) then
    raise exception 'permission denied';
  end if;

  return query
  select
    m.id as member_id,
    m.display_name as member_name,
    m.role,
    m.schedule_permission,
    m.status,
    ic.invite_code,
    ic.pin_code,
    ic.status as invite_status
  from company_members m
  left join lateral (
    select
      invite_codes.invite_code,
      invite_codes.pin_code,
      invite_codes.status
    from invite_codes
    where invite_codes.company_id = m.company_id
      and invite_codes.member_id = m.id
    order by
      case when invite_codes.status = 'active' then 0 else 1 end,
      upper(invite_codes.invite_code)
    limit 1
  ) ic on true
  where m.company_id = p_company_id
    and m.status <> 'deleted'
  order by m.created_at asc;
end;
$function$;
