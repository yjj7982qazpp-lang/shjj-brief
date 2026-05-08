-- SHJJ Brief Supabase RPC Patch
-- Purpose: allow active write members to delete company schedules.
-- Apply manually in Supabase SQL Editor after preview review.
-- This patch replaces only public.delete_company_schedule.

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
      and (
        m.role = 'admin'
        or m.schedule_permission = 'write'
      )
  ) then
    return query
    select false, 'schedule_delete_forbidden'::text;
    return;
  end if;

  delete from schedules s
  where s.id = p_schedule_id
    and s.company_id = p_company_id;

  if not found then
    return query
    select false, 'schedule_delete_not_found'::text;
    return;
  end if;

  return query
  select true, 'schedule_delete_success'::text;
end;
$function$;

-- Smoke test template. Replace UUIDs before running.
-- select * from public.delete_company_schedule(
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000'
-- );
