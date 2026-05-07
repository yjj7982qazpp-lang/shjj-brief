-- SHJJ Brief Supabase MVP Schema Draft
-- Purpose: company room, member invite, permission, schedule, and user settings structure.
-- Target branch: feature/supabase-schema-draft -> preview-main -> main
-- Note: Review before running in Supabase SQL Editor.

-- Required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- =========================================================
-- 1. companies
-- =========================================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text,
  slug text unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is 'Company rooms for SHJJ Brief schedule sharing.';
comment on column public.companies.status is 'active or inactive.';

-- =========================================================
-- 2. company_members
-- =========================================================
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_name text not null,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive', 'deleted')),
  invite_id uuid,
  device_label text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_members is 'Members in a company room. Initial MVP avoids email/social login.';
comment on column public.company_members.role is 'admin, editor, or viewer.';
comment on column public.company_members.status is 'active, inactive, or deleted.';

create index if not exists idx_company_members_company_id on public.company_members(company_id);
create index if not exists idx_company_members_company_status on public.company_members(company_id, status);
create index if not exists idx_company_members_company_role on public.company_members(company_id, role);

-- =========================================================
-- 3. company_invites
-- =========================================================
create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invite_code text not null unique,
  pin_hash text not null,
  role_to_assign text not null default 'viewer' check (role_to_assign in ('admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'used', 'revoked', 'expired')),
  created_by_member_id uuid references public.company_members(id) on delete set null,
  used_by_member_id uuid references public.company_members(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

comment on table public.company_invites is 'Per-member invite code + PIN structure.';
comment on column public.company_invites.pin_hash is 'PIN must not be stored as plain text.';

create index if not exists idx_company_invites_company_id on public.company_invites(company_id);
create index if not exists idx_company_invites_status on public.company_invites(status);
create index if not exists idx_company_invites_code_status on public.company_invites(invite_code, status);

-- Add invite_id FK after company_invites exists.
alter table public.company_members
  add constraint company_members_invite_id_fkey
  foreign key (invite_id)
  references public.company_invites(id)
  on delete set null;

-- Add created_by_member_id FK after company_members exists.
alter table public.companies
  add constraint companies_created_by_member_id_fkey
  foreign key (created_by_member_id)
  references public.company_members(id)
  on delete set null;

-- =========================================================
-- 4. company_schedules
-- =========================================================
create table if not exists public.company_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  category text default 'work',
  created_by_member_id uuid references public.company_members(id) on delete set null,
  updated_by_member_id uuid references public.company_members(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_schedules_end_after_start check (end_at is null or end_at >= start_at)
);

comment on table public.company_schedules is 'Company shared schedules. Use status=deleted for soft delete.';

create index if not exists idx_company_schedules_company_start on public.company_schedules(company_id, start_at);
create index if not exists idx_company_schedules_company_status on public.company_schedules(company_id, status);
create index if not exists idx_company_schedules_created_by on public.company_schedules(created_by_member_id);

-- =========================================================
-- 5. user_settings
-- =========================================================
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.company_members(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  notification_time text,
  weather_location text,
  law_categories jsonb not null default '[]'::jsonb,
  ui_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_member_company_unique unique (member_id, company_id),
  constraint user_settings_notification_time_format check (
    notification_time is null or notification_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  )
);

comment on table public.user_settings is 'Per-member app settings: notification time, weather location, law categories, UI preferences.';

create index if not exists idx_user_settings_company_id on public.user_settings(company_id);

-- =========================================================
-- 6. updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger trg_company_members_updated_at
before update on public.company_members
for each row execute function public.set_updated_at();

create trigger trg_company_schedules_updated_at
before update on public.company_schedules
for each row execute function public.set_updated_at();

create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- 7. Helper permission functions
-- =========================================================
create or replace function public.is_active_admin(p_member_id uuid, p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_members m
    where m.id = p_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

create or replace function public.can_write_schedule(p_member_id uuid, p_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_members m
    where m.id = p_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
      and m.role in ('admin', 'editor')
  );
$$;

-- =========================================================
-- 8. RPC drafts
-- =========================================================
-- These RPCs are draft-level and must be reviewed before production.

create or replace function public.list_company_members_rpc(
  p_requester_member_id uuid,
  p_company_id uuid
)
returns table (
  id uuid,
  display_name text,
  role text,
  status text,
  last_seen_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  if not public.is_active_admin(p_requester_member_id, p_company_id) then
    raise exception 'permission denied';
  end if;

  return query
  select m.id, m.display_name, m.role, m.status, m.last_seen_at, m.created_at
  from public.company_members m
  where m.company_id = p_company_id
    and m.status <> 'deleted'
  order by m.created_at asc;
end;
$$;

create or replace function public.set_company_member_status_rpc(
  p_requester_member_id uuid,
  p_company_id uuid,
  p_target_member_id uuid,
  p_status text
)
returns public.company_members
language plpgsql
security definer
as $$
declare
  v_member public.company_members;
begin
  if p_status not in ('active', 'inactive', 'deleted') then
    raise exception 'invalid status';
  end if;

  if not public.is_active_admin(p_requester_member_id, p_company_id) then
    raise exception 'permission denied';
  end if;

  update public.company_members
  set status = p_status
  where id = p_target_member_id
    and company_id = p_company_id
  returning * into v_member;

  if v_member.id is null then
    raise exception 'member not found';
  end if;

  if p_status <> 'active' then
    update public.company_invites
    set status = 'revoked'
    where used_by_member_id = p_target_member_id
      and company_id = p_company_id
      and status in ('active', 'used');
  end if;

  return v_member;
end;
$$;

create or replace function public.update_company_member_role_rpc(
  p_requester_member_id uuid,
  p_company_id uuid,
  p_target_member_id uuid,
  p_role text
)
returns public.company_members
language plpgsql
security definer
as $$
declare
  v_member public.company_members;
begin
  if p_role not in ('admin', 'editor', 'viewer') then
    raise exception 'invalid role';
  end if;

  if not public.is_active_admin(p_requester_member_id, p_company_id) then
    raise exception 'permission denied';
  end if;

  update public.company_members
  set role = p_role
  where id = p_target_member_id
    and company_id = p_company_id
    and status <> 'deleted'
  returning * into v_member;

  if v_member.id is null then
    raise exception 'member not found';
  end if;

  return v_member;
end;
$$;

create or replace function public.list_company_schedules_rpc(
  p_member_id uuid,
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns setof public.company_schedules
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1
    from public.company_members m
    where m.id = p_member_id
      and m.company_id = p_company_id
      and m.status = 'active'
  ) then
    raise exception 'permission denied';
  end if;

  return query
  select s.*
  from public.company_schedules s
  where s.company_id = p_company_id
    and s.status = 'active'
    and s.start_at >= p_from
    and s.start_at < p_to
  order by s.start_at asc;
end;
$$;

create or replace function public.create_company_schedule_rpc(
  p_member_id uuid,
  p_company_id uuid,
  p_title text,
  p_description text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_all_day boolean,
  p_category text
)
returns public.company_schedules
language plpgsql
security definer
as $$
declare
  v_schedule public.company_schedules;
begin
  if not public.can_write_schedule(p_member_id, p_company_id) then
    raise exception 'permission denied';
  end if;

  insert into public.company_schedules (
    company_id, title, description, start_at, end_at, all_day, category, created_by_member_id, updated_by_member_id
  ) values (
    p_company_id, p_title, p_description, p_start_at, p_end_at, coalesce(p_all_day, false), coalesce(p_category, 'work'), p_member_id, p_member_id
  ) returning * into v_schedule;

  return v_schedule;
end;
$$;

-- =========================================================
-- 9. RLS draft
-- =========================================================
-- For the current MVP, access should preferably go through security definer RPCs.
-- Direct table access from the client should be restricted before production.

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invites enable row level security;
alter table public.company_schedules enable row level security;
alter table public.user_settings enable row level security;

-- Draft policy: disable direct anonymous table reads/writes by default.
-- Concrete authenticated policies should be added after the login/session model is finalized.

-- =========================================================
-- 10. Review checklist before applying
-- =========================================================
-- [ ] Confirm whether current Supabase project already has these tables.
-- [ ] Backup existing tables before running.
-- [ ] Confirm invite PIN hashing method.
-- [ ] Confirm whether anon client can call RPC safely.
-- [ ] Confirm RLS policies before public deployment.
-- [ ] Test admin/editor/viewer roles separately.
-- [ ] Test inactive member access denial.
