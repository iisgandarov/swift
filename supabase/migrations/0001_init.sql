-- Swift — initial schema
-- Every table has Row Level Security: a signed-in user can only touch their own rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type item_type     as enum ('task', 'event');
create type item_priority as enum ('low', 'medium', 'high');
create type item_status   as enum ('open', 'done');
create type item_source   as enum ('voice', 'text', 'manual');
create type sync_status   as enum ('none', 'pending', 'synced', 'failed');
create type ui_locale     as enum ('az', 'en');
create type voice_locale  as enum ('auto', 'az', 'en');
create type theme_pref    as enum ('system', 'light', 'dark');
create type time_format   as enum ('24h', '12h');
create type ai_kind       as enum ('voice', 'parse');

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text not null default '',
  ui_locale             ui_locale not null default 'az',
  voice_locale          voice_locale not null default 'auto',
  theme                 theme_pref not null default 'system',
  timezone              text not null default 'Asia/Baku',
  default_event_minutes int not null default 60 check (default_event_minutes between 5 and 600),
  time_format           time_format not null default '24h',
  auto_create           boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- categories
create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name_az    text not null check (char_length(name_az) between 1 and 40),
  name_en    text not null check (char_length(name_en) between 1 and 40),
  color      text not null default 'blue',
  icon       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_user_idx on categories (user_id, sort_order);

-- ---------------------------------------------------------------- items
create table items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            item_type not null default 'task',
  title           text not null check (char_length(title) between 1 and 200),
  notes           text check (char_length(notes) <= 4000),
  date            date,                 -- local day (user timezone); set for tasks with a date and for all events
  start_at        timestamptz,
  end_at          timestamptz,
  all_day         boolean not null default false,
  priority        item_priority not null default 'medium',
  category_id     uuid references categories (id) on delete set null,
  status          item_status not null default 'open',
  completed_at    timestamptz,
  source          item_source not null default 'manual',
  raw_transcript  text,
  language        text,
  google_event_id text,
  sync_status     sync_status not null default 'none',
  sync_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint event_has_start check (type = 'task' or all_day or start_at is not null),
  constraint end_after_start check (end_at is null or start_at is null or end_at >= start_at),
  constraint done_has_time check ((status = 'done') = (completed_at is not null))
);
create index items_user_date_idx   on items (user_id, date);
create index items_user_status_idx on items (user_id, status);
create index items_user_completed_idx on items (user_id, completed_at) where status = 'done';
create trigger items_updated_at before update on items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- google connection
create table google_connections (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  google_email            text,
  refresh_token_encrypted text not null,
  calendar_id             text not null default 'primary',
  connected_at            timestamptz not null default now(),
  last_error              text,
  needs_reconnect         boolean not null default false
);

-- ---------------------------------------------------------------- focus sessions
create table focus_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  item_id         uuid references items (id) on delete set null,
  started_at      timestamptz not null,
  planned_minutes int not null check (planned_minutes between 1 and 240),
  actual_minutes  int not null default 0 check (actual_minutes between 0 and 600),
  completed       boolean not null default false
);
create index focus_sessions_user_idx on focus_sessions (user_id, started_at);

-- ---------------------------------------------------------------- AI request log (rate limit + cost visibility)
create table ai_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       ai_kind not null,
  created_at timestamptz not null default now()
);
create index ai_requests_user_time_idx on ai_requests (user_id, created_at);

-- ---------------------------------------------------------------- RLS
alter table profiles           enable row level security;
alter table categories         enable row level security;
alter table items              enable row level security;
alter table google_connections enable row level security;
alter table focus_sessions     enable row level security;
alter table ai_requests        enable row level security;

create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own categories" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own items" on items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own focus sessions" on focus_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own ai requests (read)" on ai_requests
  for select using (user_id = auth.uid());
create policy "own ai requests (insert)" on ai_requests
  for insert with check (user_id = auth.uid());

-- google_connections holds an (encrypted) refresh token: no client policies at all.
-- Only the server, using the service-role key, reads or writes it.
revoke all on google_connections from anon, authenticated;

-- A category used on an item must belong to the same user.
create or replace function check_item_category() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
    select 1 from categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'category does not belong to user';
  end if;
  return new;
end $$;
create trigger items_category_owner before insert or update of category_id on items
  for each row execute function check_item_category();
