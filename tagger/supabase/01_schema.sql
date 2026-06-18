-- ════════════════════════════════════════════════════════════════════
--  GCIP — Goal Creation Intelligence Platform
--  Supabase / PostgreSQL schema  (Phase 1: goal tagging)
--
--  Run order:
--    1. 01_schema.sql        (this file)
--    2. 02_seed_squads.sql   (teams + players from the WC2026 PDF)
--
--  Paste into the Supabase SQL Editor and run, or use the Supabase CLI:
--    supabase db execute --file 01_schema.sql
-- ════════════════════════════════════════════════════════════════════

-- gen_random_uuid() lives in pgcrypto (already available on Supabase).
create extension if not exists "pgcrypto";

-- ── Enumerated types ────────────────────────────────────────────────
-- The three decisive goal-creation actions GCIP isolates.
do $$ begin
  create type event_type as enum ('pre_assist', 'assist', 'goal');
exception when duplicate_object then null; end $$;

-- We only record goals, but the column is kept for forward compatibility.
do $$ begin
  create type sequence_outcome as enum ('goal');
exception when duplicate_object then null; end $$;

-- How the action was struck.
do $$ begin
  create type body_part as enum ('right_foot', 'left_foot', 'head', 'other');
exception when duplicate_object then null; end $$;


-- ── Reference: teams ────────────────────────────────────────────────
create table if not exists public.teams (
  code  text primary key,                       -- FIFA 3-letter code, e.g. 'ARG'
  name  text not null
);

-- ── Reference: players (squad lists) ────────────────────────────────
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  team_code    text not null references public.teams (code) on delete cascade,
  shirt_number int,
  position     text,                             -- GK / DF / MF / FW
  name         text not null,                    -- name on shirt
  unique (team_code, name)
);
create index if not exists players_team_idx on public.players (team_code);


-- ── matches ─────────────────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  competition text not null default 'FIFA World Cup 2026',
  match_date  date,
  home_code   text references public.teams (code),
  home_team   text,                              -- denormalized display name
  away_code   text references public.teams (code),
  away_team   text,
  video_url   text,
  video_id    text,                              -- YouTube id
  tagger      text,
  created_at  timestamptz not null default now()
);

-- ── attack_sequences ────────────────────────────────────────────────
-- The heart of the model: one connected goal-creation move.
create table if not exists public.attack_sequences (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  seq_index  int not null,                       -- ordering within the match
  outcome    sequence_outcome not null default 'goal',
  notes      text,
  created_at timestamptz not null default now(),
  unique (match_id, seq_index)
);
create index if not exists sequences_match_idx on public.attack_sequences (match_id);

-- ── events ──────────────────────────────────────────────────────────
-- Every tagged action, with temporal + standardized spatial coordinates.
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.attack_sequences (id) on delete cascade,
  type        event_type not null,
  minute      int,                               -- match clock
  second      int,
  video_time  numeric(10,2),                     -- raw video timestamp (s)
  x           numeric(5,2) check (x between 0 and 105),  -- standardized pitch, meters
  y           numeric(5,2) check (y between 0 and 68),
  end_x       numeric(5,2) check (end_x between 0 and 105), -- shot END location (goals)
  end_y       numeric(5,2) check (end_y between 0 and 68),
  team_code   text references public.teams (code),
  player      text,                              -- name on shirt
  body_part   body_part,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists events_sequence_idx on public.events (sequence_id);
create index if not exists events_type_idx     on public.events (type);
create index if not exists events_player_idx   on public.events (team_code, player);


-- ── Convenience view: one row per goal ──────────────────────────────
-- Flattens each sequence into scorer / assister / pre-assister + body part,
-- ready for dashboards and scouting queries.
create or replace view public.goals_flat as
select
  s.id                         as sequence_id,
  m.id                         as match_id,
  m.competition,
  m.match_date,
  m.home_team,
  m.away_team,
  s.seq_index,
  g.team_code                  as scoring_team,
  g.player                     as scorer,
  g.body_part                  as goal_body_part,
  g.minute,
  g.x      as goal_x,
  g.y      as goal_y,
  g.end_x  as shot_end_x,
  g.end_y  as shot_end_y,
  a.player                     as assist_by,
  a.team_code                  as assist_team,
  p.player                     as pre_assist_by,
  p.team_code                  as pre_assist_team
from public.attack_sequences s
join public.matches m on m.id = s.match_id
left join public.events g on g.sequence_id = s.id and g.type = 'goal'
left join public.events a on a.sequence_id = s.id and a.type = 'assist'
left join public.events p on p.sequence_id = s.id and p.type = 'pre_assist';


-- ── Row Level Security ──────────────────────────────────────────────
-- Reference tables (teams/players) are world-readable.
-- Tagging tables are readable by anyone but writable only by signed-in users.
-- Tighten these to your needs (e.g. per-tagger ownership) before production.
alter table public.teams            enable row level security;
alter table public.players          enable row level security;
alter table public.matches          enable row level security;
alter table public.attack_sequences enable row level security;
alter table public.events           enable row level security;

-- read-only reference data
create policy "teams read"   on public.teams   for select using (true);
create policy "players read" on public.players for select using (true);

-- matches
create policy "matches read"  on public.matches for select using (true);
create policy "matches write" on public.matches for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- sequences
create policy "sequences read"  on public.attack_sequences for select using (true);
create policy "sequences write" on public.attack_sequences for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- events
create policy "events read"  on public.events for select using (true);
create policy "events write" on public.events for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
