-- ════════════════════════════════════════════════════════════════════
--  GCIP — expose assist + pre-assist coordinates on goals_flat
--
--  Adds normalized (left→right) coordinates for the assist and pre-assist
--  events so the dashboard can draw an assist heat map.
--
--  Run AFTER 01/04/06/07 (or just run 00_full_setup.sql). Idempotent.
-- ════════════════════════════════════════════════════════════════════

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
  case when g.direction = 'rtl' then 105 - g.x else g.x end as goal_x,
  case when g.direction = 'rtl' then 68  - g.y else g.y end as goal_y,
  case when g.direction = 'rtl' then 105 - g.end_x else g.end_x end as shot_end_x,
  case when g.direction = 'rtl' then 68  - g.end_y else g.end_y end as shot_end_y,
  g.direction                  as goal_direction,
  a.player                     as assist_by,
  a.team_code                  as assist_team,
  case when a.direction = 'rtl' then 105 - a.x else a.x end as assist_x,
  case when a.direction = 'rtl' then 68  - a.y else a.y end as assist_y,
  p.player                     as pre_assist_by,
  p.team_code                  as pre_assist_team,
  case when p.direction = 'rtl' then 105 - p.x else p.x end as pre_assist_x,
  case when p.direction = 'rtl' then 68  - p.y else p.y end as pre_assist_y
from public.attack_sequences s
join public.matches m on m.id = s.match_id
left join public.events g on g.sequence_id = s.id and g.type = 'goal'
left join public.events a on a.sequence_id = s.id and a.type = 'assist'
left join public.events p on p.sequence_id = s.id and p.type = 'pre_assist';
