-- ════════════════════════════════════════════════════════════════════
--  GCIP — add shot END location to events
--
--  Goal events capture where the shot was struck (x, y) AND where the ball
--  finished (end_x, end_y) — both on the standardized 105 x 68 m pitch.
--
--  Run AFTER 01_schema.sql. Idempotent.
-- ════════════════════════════════════════════════════════════════════

alter table public.events
  add column if not exists end_x numeric(5,2) check (end_x between 0 and 105),
  add column if not exists end_y numeric(5,2) check (end_y between 0 and 68);

-- Surface the shot end location in the convenience view.
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
