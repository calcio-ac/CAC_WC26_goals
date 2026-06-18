# GCIP — Supabase database

SQL to stand up the Goal Creation Intelligence Platform database.

| File | What it does |
|------|--------------|
| `01_schema.sql` | Enums, tables (`teams`, `players`, `matches`, `attack_sequences`, `events`), indexes, the `goals_flat` view, and base RLS (public read). |
| `02_seed_squads.sql` | Seeds all **48 WC2026 teams** and **1,248 players** (from `SquadLists-English.pdf`). Idempotent. |
| `04_add_shot_end.sql` | Adds `end_x` / `end_y` (shot end location) to `events` and updates `goals_flat`. |
| `05_auth_policies.sql` | **Locks writes to authenticated taggers** (`pp33@cac.com`, `av@cac.com`) via `is_tagger()`. Public read stays open so the dashboard works. |
| ~~`03_policies_anon.sql`~~ | _Superseded by `05`._ Only use for a quick anon-write demo; `05` replaces it. |

## Apply it (recommended order)

In **SQL Editor → New query**, run in order: `01_schema.sql`, `02_seed_squads.sql`,
`04_add_shot_end.sql`, then `05_auth_policies.sql`.

**Then create the two tagger accounts:** Dashboard → **Authentication → Users → Add user**
for `pp33@cac.com` and `av@cac.com` (set a password, tick **Auto Confirm User**). Only
these emails can sign into the tagger and write.

**Supabase CLI:**

```bash
supabase db execute --file 01_schema.sql
supabase db execute --file 02_seed_squads.sql
```

## Model

```
teams (code PK) ──< players
                └─< matches (home_code / away_code)
                        └─< attack_sequences ──< events
```

- An **attack_sequence** is one connected goal-creation move; `outcome` is always `goal`.
- An **event** is a `pre_assist | assist | goal`, with match clock + `video_time`,
  standardized pitch coordinates (`x ∈ [0,105]`, `y ∈ [0,68]` meters, enforced by CHECK),
  `team_code`, `player`, and `body_part` (`right_foot | left_foot | head | other`).
- **`goals_flat`** flattens each sequence into one row: scorer / assister / pre-assister,
  body part, teams — ready for dashboards and scouting queries.

This matches the tagger's JSON export 1:1, so the Phase 2 sync layer can map exported
projects straight into these tables.

## Notes

- RLS is **read-open, write = authenticated**. Tighten to per-tagger ownership before
  production (e.g. add a `tagger_id uuid references auth.users` column and scope the
  write policies with `auth.uid()`).
- IDs are server-generated `uuid`s. The tagger's local string ids (`seq_…`, `ev_…`) are
  client-only — when syncing, insert and let Postgres assign uuids, keeping a client→db
  id map for the foreign keys.
- Re-generate `02_seed_squads.sql` from `public/assets/squads.json` if the squad lists
  change.
```
