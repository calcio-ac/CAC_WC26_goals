-- ════════════════════════════════════════════════════════════════════
--  GCIP — expose video info + match minute on goals_flat
--
--  Adds the goal's YouTube video id and video timestamp so the user
--  dashboard can pop up the highlight clip seeked to the goal, plus the
--  (manually tagged) match minute for timing analysis.
--
--  Run AFTER 01/04. Idempotent.
--  (Dropped & recreated because the new columns change the column order,
--   which CREATE OR REPLACE VIEW does not allow.)
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
  m.video_id,                                 -- YouTube id for the clip
  s.seq_index,
  g.team_code                  as scoring_team,
  g.player                     as scorer,
  g.body_part                  as goal_body_part,
  g.minute,                                   -- real match minute (manual)
  g.second,
  g.video_time                 as goal_video_time,  -- seek point in the video
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
