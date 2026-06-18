-- ════════════════════════════════════════════════════════════════════
--  GCIP — attack direction + coordinate normalization
--
--  Teams switch ends each half, so an action can be tagged attacking
--  right→left. We store RAW coordinates plus a direction flag, and the
--  goals_flat view mirrors "rtl" actions (point reflection: x→105-x,
--  y→68-y) so the dashboard always shows everything left→right.
--
--  Run AFTER 01/04/06 (or just run 00_full_setup.sql instead). Idempotent.
-- ════════════════════════════════════════════════════════════════════

alter table public.events
  add column if not exists direction text not null default 'ltr';

do $$ begin
  alter table public.events add constraint events_direction_check
    check (direction in ('ltr','rtl'));
exception when duplicate_object then null; end $$;

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
  -- normalize to left→right: mirror when the attack was right→left
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
