-- ════════════════════════════════════════════════════════════════════
--  GCIP — FULL SETUP (idempotent)
--  Goal Creation Intelligence Platform · Supabase / PostgreSQL
--
--  One script that creates/updates EVERYTHING except the player seed:
--    • enums, tables (incl. shot end_x/end_y), indexes
--    • goals_flat view (with video + match minute)
--    • is_tagger() + email-restricted RLS (writes = pp33/av only, read = public)
--
--  Safe to run on a fresh DB or on top of your existing one.
--
--  AFTER this, also run 02_seed_squads.sql (48 teams + 1,248 players),
--  and create the two tagger users:
--    Dashboard → Authentication → Users → Add user
--      pp33@cac.com / av@cac.com  (set password, tick "Auto Confirm User")
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────
do $$ begin create type event_type as enum ('pre_assist','assist','goal');
exception when duplicate_object then null; end $$;

do $$ begin create type sequence_outcome as enum ('goal');
exception when duplicate_object then null; end $$;

do $$ begin create type body_part as enum ('right_foot','left_foot','head','other');
exception when duplicate_object then null; end $$;

-- ── Reference tables ────────────────────────────────────────────────
create table if not exists public.teams (
  code text primary key,
  name text not null
);

create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  team_code    text not null references public.teams(code) on delete cascade,
  shirt_number int,
  position     text,
  name         text not null,
  unique (team_code, name)
);
create index if not exists players_team_idx on public.players (team_code);

-- ── matches ─────────────────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  competition text not null default 'FIFA World Cup 2026',
  match_date  date,
  home_code   text references public.teams(code),
  home_team   text,
  away_code   text references public.teams(code),
  away_team   text,
  video_url   text,
  video_id    text,
  tagger      text,
  created_at  timestamptz not null default now()
);

-- ── attack_sequences ────────────────────────────────────────────────
create table if not exists public.attack_sequences (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  seq_index  int not null,
  outcome    sequence_outcome not null default 'goal',
  notes      text,
  created_at timestamptz not null default now(),
  unique (match_id, seq_index)
);
create index if not exists sequences_match_idx on public.attack_sequences (match_id);

-- ── events ──────────────────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.attack_sequences(id) on delete cascade,
  type        event_type not null,
  minute      int,                         -- real match minute (manual)
  second      int,
  video_time  numeric(10,2),               -- video position → replay seek
  x           numeric(5,2) check (x between 0 and 105),
  y           numeric(5,2) check (y between 0 and 68),
  end_x       numeric(5,2) check (end_x between 0 and 105),  -- shot end (goals)
  end_y       numeric(5,2) check (end_y between 0 and 68),
  team_code   text references public.teams(code),
  player      text,
  body_part   body_part,
  direction   text not null default 'ltr' check (direction in ('ltr','rtl')), -- attack dir
  notes       text,
  created_at  timestamptz not null default now()
);
-- add columns if the table already existed without them
alter table public.events
  add column if not exists end_x numeric(5,2) check (end_x between 0 and 105),
  add column if not exists end_y numeric(5,2) check (end_y between 0 and 68);
alter table public.events
  add column if not exists direction text not null default 'ltr';
do $$ begin
  alter table public.events add constraint events_direction_check
    check (direction in ('ltr','rtl'));
exception when duplicate_object then null; end $$;

create index if not exists events_sequence_idx on public.events (sequence_id);
create index if not exists events_type_idx     on public.events (type);
create index if not exists events_player_idx   on public.events (team_code, player);

-- ── goals_flat view (one row per goal) ──────────────────────────────
drop view if exists public.goals_flat;
create view public.goals_flat as
select
  s.id                         as sequence_id,
  m.id                         as match_id,
  m.competition,
  m.match_date,
  m.home_team,
  m.away_team,
  m.video_id,
  s.seq_index,
  g.team_code                  as scoring_team,
  g.player                     as scorer,
  g.body_part                  as goal_body_part,
  g.minute,
  g.second,
  g.video_time                 as goal_video_time,
  -- normalize to left→right: mirror (point-reflection) when attack was right→left
  case when g.direction = 'rtl' then 105 - g.x else g.x end as goal_x,
  case when g.direction = 'rtl' then 68  - g.y else g.y end as goal_y,
  case when g.direction = 'rtl' then 105 - g.end_x else g.end_x end as shot_end_x,
  case when g.direction = 'rtl' then 68  - g.end_y else g.end_y end as shot_end_y,
  g.direction                  as goal_direction,
  a.player                     as assist_by,
  a.team_code                  as assist_team,
  p.player                     as pre_assist_by,
  p.team_code                  as pre_assist_team
from public.attack_sequences s
join public.matches m on m.id = s.match_id
left join public.events g on g.sequence_id = s.id and g.type = 'goal'
left join public.events a on a.sequence_id = s.id and a.type = 'assist'
left join public.events p on p.sequence_id = s.id and p.type = 'pre_assist';

-- ── Tagger allowlist helper ─────────────────────────────────────────
create or replace function public.is_tagger()
returns boolean language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('pp33@cac.com','av@cac.com'), false);
$$;

-- ── Row Level Security ──────────────────────────────────────────────
alter table public.teams            enable row level security;
alter table public.players          enable row level security;
alter table public.matches          enable row level security;
alter table public.attack_sequences enable row level security;
alter table public.events           enable row level security;

-- clear any prior policies so this script is fully idempotent
drop policy if exists "teams read"            on public.teams;
drop policy if exists "players read"          on public.players;
drop policy if exists "matches read"          on public.matches;
drop policy if exists "matches write"         on public.matches;
drop policy if exists "matches anon write"    on public.matches;
drop policy if exists "matches tagger write"  on public.matches;
drop policy if exists "sequences read"          on public.attack_sequences;
drop policy if exists "sequences write"         on public.attack_sequences;
drop policy if exists "sequences anon write"    on public.attack_sequences;
drop policy if exists "sequences tagger write"  on public.attack_sequences;
drop policy if exists "events read"           on public.events;
drop policy if exists "events write"          on public.events;
drop policy if exists "events anon write"     on public.events;
drop policy if exists "events tagger write"   on public.events;

-- public READ (so the user dashboard works)
create policy "teams read"     on public.teams            for select using (true);
create policy "players read"   on public.players          for select using (true);
create policy "matches read"   on public.matches          for select using (true);
create policy "sequences read" on public.attack_sequences for select using (true);
create policy "events read"    on public.events           for select using (true);

-- WRITE only for signed-in taggers on the allowlist
create policy "matches tagger write" on public.matches
  for all to authenticated using (public.is_tagger()) with check (public.is_tagger());
create policy "sequences tagger write" on public.attack_sequences
  for all to authenticated using (public.is_tagger()) with check (public.is_tagger());
create policy "events tagger write" on public.events
  for all to authenticated using (public.is_tagger()) with check (public.is_tagger());
