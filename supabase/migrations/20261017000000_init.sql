-- =============================================================================
-- Family House Booking: initial schema
--
-- Security model
--   * Only rows in public.profiles with status = 'active' are "members".
--     An auth.users row on its own grants access to nothing.
--   * Profiles can only be created through public.redeem_invitation(), which
--     validates and consumes an invitation atomically.
--   * Clients never write role/status columns; privileged changes go through
--     SECURITY DEFINER functions that check the caller's role themselves.
--   * Overlapping bookings are rejected by an exclusion constraint, so the rule
--     holds no matter which client (or how many at once) writes to the table.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Internal helpers live in a schema that PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.member_role as enum ('member', 'admin');
create type public.member_status as enum ('active', 'revoked');
create type public.booking_status as enum ('confirmed', 'cancelled');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  -- sha256 of the normalised code. The plaintext is shown once, then discarded.
  code_hash   bytea not null unique,
  -- Last four characters, so admins can tell codes apart.
  code_hint   text not null check (code_hint ~ '^[A-Z0-9]{4}$'),
  label       text check (label is null or char_length(label) <= 80),
  role        public.member_role not null default 'member',
  max_uses    integer not null default 1 check (max_uses between 1 and 50),
  use_count   integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  display_name   text not null
                   check (char_length(display_name) between 1 and 40
                          and display_name = btrim(display_name)),
  avatar         text not null check (avatar ~ '^avatar-(0[1-9]|1[0-8])$'),
  color          text not null check (color in (
                   'sage', 'terracotta', 'ocean', 'plum', 'mustard',
                   'rose', 'teal', 'slate', 'olive', 'coral')),
  role           public.member_role not null default 'member',
  status         public.member_status not null default 'active',
  invitation_id  uuid references public.invitations (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.invitation_redemptions (
  invitation_id  uuid not null references public.invitations (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  redeemed_at    timestamptz not null default now(),
  primary key (invitation_id, user_id)
);

create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,
  title         text not null
                  check (char_length(title) between 1 and 80 and title = btrim(title)),
  notes         text check (notes is null or char_length(notes) <= 2000),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        public.booking_status not null default 'confirmed',
  -- Incremented on every write; clients send the version they edited so a
  -- concurrent change is detected instead of silently overwritten.
  version       integer not null default 1,
  cancelled_at  timestamptz,
  cancelled_by  uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint bookings_valid_range check (ends_at > starts_at),
  constraint bookings_min_length check (ends_at - starts_at >= interval '15 minutes'),
  constraint bookings_max_length check (ends_at - starts_at <= interval '62 days'),
  -- Half-open [start, end): a stay ending at 11:00 does not clash with one
  -- starting at 11:00. Cancelled bookings never block the house.
  constraint bookings_no_overlap
    exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
    where (status = 'confirmed')
);

create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_ends_at_idx on public.bookings (ends_at) where status = 'confirmed';
create index bookings_starts_at_idx on public.bookings (starts_at) where status = 'confirmed';
create index profiles_invitation_id_idx on public.profiles (invitation_id);
create index invitation_redemptions_user_id_idx on public.invitation_redemptions (user_id);
create index invitations_created_by_idx on public.invitations (created_by);
create index bookings_cancelled_by_idx on public.bookings (cancelled_by);

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

create function private.is_active_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active'
  );
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active' and role = 'admin'
  );
$$;

revoke all on function private.is_active_member() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.is_active_member() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Codes are compared case-insensitively and ignoring dashes/spaces.
create function private.normalize_invite_code(p_code text)
returns text
language sql immutable set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function private.hash_invite_code(p_code text)
returns bytea
language sql immutable set search_path = ''
as $$
  select extensions.digest(private.normalize_invite_code(p_code), 'sha256');
$$;

-- 12 characters from a 31-symbol alphabet without look-alikes (0/O, 1/I/L):
-- ~59 bits of entropy, drawn with rejection sampling to avoid modulo bias.
create function private.generate_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  bytes bytea;
  b integer;
  i integer;
begin
  while char_length(result) < 12 loop
    bytes := extensions.gen_random_bytes(32);
    for i in 0 .. 31 loop
      b := get_byte(bytes, i);
      if b < 248 then -- 248 = 31 * 8
        result := result || substr(alphabet, (b % 31) + 1, 1);
        exit when char_length(result) = 12;
      end if;
    end loop;
  end loop;
  return substr(result, 1, 4) || '-' || substr(result, 5, 4) || '-' || substr(result, 9, 4);
end;
$$;

create function private.create_invitation(
  p_label      text,
  p_role       public.member_role,
  p_max_uses   integer,
  p_expires_at timestamptz,
  p_created_by uuid
)
returns table (id uuid, code text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := private.generate_invite_code();
  v_id uuid;
begin
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVITATION_EXPIRY_IN_PAST' using errcode = 'P0001';
  end if;

  insert into public.invitations (code_hash, code_hint, label, role, max_uses, expires_at, created_by)
  values (
    private.hash_invite_code(v_code),
    right(private.normalize_invite_code(v_code), 4),
    nullif(btrim(p_label), ''),
    coalesce(p_role, 'member'),
    coalesce(p_max_uses, 1),
    p_expires_at,
    p_created_by
  )
  returning invitations.id into v_id;

  return query select v_id, v_code;
end;
$$;

revoke all on function private.normalize_invite_code(text) from public;
revoke all on function private.hash_invite_code(text) from public;
revoke all on function private.generate_invite_code() from public;
revoke all on function private.create_invitation(text, public.member_role, integer, timestamptz, uuid) from public;

create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Server-maintained booking fields; also blocks edits clients must not make.
create function private.bookings_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean := private.is_admin();
begin
  if tg_op = 'INSERT' then
    new.status := 'confirmed';
    new.version := 1;
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.created_at := now();
    new.updated_at := now();
    if v_uid is not null and new.ends_at <= now() then
      raise exception 'BOOKING_IN_PAST' using errcode = 'P0001',
        hint = 'A new booking must end in the future.';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.user_id is distinct from old.user_id then
    raise exception 'BOOKING_OWNER_IMMUTABLE' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' then
    raise exception 'BOOKING_ALREADY_CANCELLED' using errcode = 'P0001';
  end if;
  if v_uid is not null and not v_is_admin and old.ends_at <= now() then
    raise exception 'BOOKING_ALREADY_ENDED' using errcode = 'P0001',
      hint = 'Bookings that have already ended can no longer be changed.';
  end if;
  if v_uid is not null
     and (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at)
     and new.ends_at <= now() then
    raise exception 'BOOKING_IN_PAST' using errcode = 'P0001',
      hint = 'A booking must end in the future.';
  end if;

  if new.status = 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := v_uid;
  end if;

  new.created_at := old.created_at;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.bookings_before_write() from public;

create trigger bookings_before_write
  before insert or update on public.bookings
  for each row execute function private.bookings_before_write();

-- Keep the profile email in step with the auth account.
create function private.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_profile_email() from public;

create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email and new.email is not null)
  execute function private.sync_profile_email();

-- -----------------------------------------------------------------------------
-- Row Level Security and privileges
--
-- Supabase grants broad table privileges to anon/authenticated by default, so
-- every table starts from zero and only the needed privileges are re-granted.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_redemptions enable row level security;

revoke all on public.profiles, public.bookings, public.invitations, public.invitation_redemptions
  from anon, authenticated;

-- profiles: active members see everyone; anyone signed in sees their own row
-- (so a revoked member can be told why they have no access).
grant select on public.profiles to authenticated;
grant update (display_name, avatar, color) on public.profiles to authenticated;

create policy "Members can read profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_active_member()));

create policy "Members can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_member()))
  with check (id = (select auth.uid()));

-- bookings: one shared calendar, readable by every active member.
grant select on public.bookings to authenticated;
grant insert (title, notes, starts_at, ends_at) on public.bookings to authenticated;
grant update (title, notes, starts_at, ends_at, status) on public.bookings to authenticated;

create policy "Members can read bookings"
  on public.bookings for select to authenticated
  using ((select private.is_active_member()));

create policy "Members can create their own bookings"
  on public.bookings for insert to authenticated
  with check ((select private.is_active_member()) and user_id = (select auth.uid()));

create policy "Owners and admins can update bookings"
  on public.bookings for update to authenticated
  using (
    (select private.is_active_member())
    and (user_id = (select auth.uid()) or (select private.is_admin()))
  )
  with check (
    (select private.is_active_member())
    and (user_id = (select auth.uid()) or (select private.is_admin()))
  );

-- invitations: admins can list them (never the hash); writes go through RPCs.
grant select (id, code_hint, label, role, max_uses, use_count, expires_at, revoked_at, created_by, created_at)
  on public.invitations to authenticated;

create policy "Admins can read invitations"
  on public.invitations for select to authenticated
  using ((select private.is_admin()));

grant select on public.invitation_redemptions to authenticated;

create policy "Admins can read redemptions"
  on public.invitation_redemptions for select to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- RPC functions (exposed through PostgREST)
-- -----------------------------------------------------------------------------

-- Lets the welcome page tell a visitor whether their code is usable before
-- they sign in. Reveals a single boolean; codes carry ~59 bits of entropy.
create function public.check_invitation(p_code text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.invitations
    where code_hash = private.hash_invite_code(p_code)
      and revoked_at is null
      and (expires_at is null or expires_at > now())
      and use_count < max_uses
  );
$$;

-- Atomically consumes an invitation and creates the caller's profile.
-- The invitation row is locked FOR UPDATE, so concurrent redemptions of a
-- single-use code serialise and only the first one succeeds.
create function public.redeem_invitation(
  p_code text,
  p_display_name text,
  p_avatar text
)
returns public.profiles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations;
  v_email text;
  v_color text;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'ALREADY_ENROLLED' using errcode = 'P0001';
  end if;

  select * into v_invitation
  from public.invitations
  where code_hash = private.hash_invite_code(p_code)
  for update;

  if not found then
    raise exception 'INVITATION_INVALID' using errcode = 'P0001';
  elsif v_invitation.revoked_at is not null then
    raise exception 'INVITATION_REVOKED' using errcode = 'P0001';
  elsif v_invitation.expires_at is not null and v_invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0001';
  elsif v_invitation.use_count >= v_invitation.max_uses then
    raise exception 'INVITATION_USED' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'EMAIL_REQUIRED' using errcode = 'P0001';
  end if;

  -- Give each new member the calendar colour that is least used so far.
  select c.color into v_color
  from unnest(array['sage', 'terracotta', 'ocean', 'plum', 'mustard',
                    'rose', 'teal', 'slate', 'olive', 'coral'])
       with ordinality as c(color, ord)
  left join public.profiles p on p.color = c.color and p.status = 'active'
  group by c.color, c.ord
  order by count(p.id), c.ord
  limit 1;

  begin
    insert into public.profiles (id, email, display_name, avatar, color, role, invitation_id)
    values (v_uid, v_email, btrim(p_display_name), p_avatar, v_color,
            v_invitation.role, v_invitation.id)
    returning * into v_profile;
  exception
    when unique_violation then
      raise exception 'ALREADY_ENROLLED' using errcode = 'P0001';
    when check_violation then
      raise exception 'PROFILE_INVALID' using errcode = 'P0001';
  end;

  update public.invitations set use_count = use_count + 1 where id = v_invitation.id;

  insert into public.invitation_redemptions (invitation_id, user_id)
  values (v_invitation.id, v_uid);

  return v_profile;
end;
$$;

create function public.create_invitation(
  p_label text default null,
  p_role public.member_role default 'member',
  p_max_uses integer default 1,
  p_expires_at timestamptz default null
)
returns table (id uuid, code text)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select * from private.create_invitation(p_label, p_role, p_max_uses, p_expires_at, (select auth.uid()));
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.invitations
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invitation_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

-- Admins change other members' role or access. Admins cannot change their own
-- row, which also guarantees the acting admin always remains an admin.
create function public.admin_update_member(
  p_user_id uuid,
  p_role public.member_role,
  p_status public.member_status
)
returns public.profiles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'CANNOT_CHANGE_SELF' using errcode = 'P0001';
  end if;

  update public.profiles
  set role = coalesce(p_role, role),
      status = coalesce(p_status, status)
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_profile;
end;
$$;

-- Operator-only bootstrap helpers. Not callable by anon/authenticated; run them
-- with the service-role key (npm scripts) or from the Supabase SQL editor.
create function public.bootstrap_admin_invitation(p_label text default 'Initial administrator')
returns table (id uuid, code text)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return query
    select * from private.create_invitation(p_label, 'admin', 1, now() + interval '7 days', null);
end;
$$;

create function public.bootstrap_promote_admin(p_email text)
returns public.profiles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set role = 'admin', status = 'active'
  where lower(email) = lower(btrim(p_email))
  returning * into v_profile;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001',
      hint = 'The account must finish enrolling (redeem an invitation) first.';
  end if;
  return v_profile;
end;
$$;

-- Functions are executable by PUBLIC by default; lock each one down explicitly.
revoke all on function public.check_invitation(text) from public, anon, authenticated;
revoke all on function public.redeem_invitation(text, text, text) from public, anon, authenticated;
revoke all on function public.create_invitation(text, public.member_role, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_invitation(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_member(uuid, public.member_role, public.member_status) from public, anon, authenticated;
revoke all on function public.bootstrap_admin_invitation(text) from public, anon, authenticated;
revoke all on function public.bootstrap_promote_admin(text) from public, anon, authenticated;

grant execute on function public.check_invitation(text) to anon, authenticated;
grant execute on function public.redeem_invitation(text, text, text) to authenticated;
grant execute on function public.create_invitation(text, public.member_role, integer, timestamptz) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.admin_update_member(uuid, public.member_role, public.member_status) to authenticated;
grant execute on function public.bootstrap_admin_invitation(text) to service_role;
grant execute on function public.bootstrap_promote_admin(text) to service_role;

-- -----------------------------------------------------------------------------
-- Realtime: push booking changes to open calendars (RLS still applies).
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.bookings;
  end if;
end;
$$;
