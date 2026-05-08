-- SHJJ Brief Supabase RPC Patch v2
-- Purpose:
-- - List company members for the admin UI with invite code and PIN.
-- - Hide inactive members from the main admin member list after save.
-- - Keep admins at the top, then active members, then the rest.

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
    case
      when m.role = 'admin' then 'write'
      else m.schedule_permission
    end as schedule_permission,
    case
      when m.role = 'admin' then 'active'
      else m.status
    end as status,
    coalesce(ic.invite_code, '') as invite_code,
    coalesce(ic.pin_code, '') as pin_code,
    coalesce(ic.status, case when m.role = 'admin' then 'active' else 'inactive' end) as invite_status
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
      invite_codes.created_at asc nulls last,
      invite_codes.id asc,
      upper(invite_codes.invite_code)
    limit 1
  ) ic on true
  where m.company_id = p_company_id
    and m.status = 'active'
  order by
    case when m.role = 'admin' then 0 else 1 end,
    case when m.status = 'active' then 0 else 1 end,
    m.created_at asc,
    m.display_name asc;
end;
$function$;
