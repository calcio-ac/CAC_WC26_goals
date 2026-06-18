# CAC · GCIP — Goal Creation Intelligence Platform (WC2026)

A Human-in-the-Loop football analytics system that isolates the goal-creation chain —
**Pre-Assist → Assist → Goal** — for the FIFA World Cup 2026, by Calcio AC.

## Two surfaces

| Folder | Audience | Purpose |
|--------|----------|---------|
| [`tagger/`](tagger/) | **Taggers** (`pp33@cac.com`, `av@cac.com`) | Expert tagging tool — log goals from YouTube onto a standardized pitch. React + Vite + Supabase. Password-gated. |
| [`landing/`](landing/) | **Users / fans / clubs** | Public results dashboard — shot maps, goals feed, leaderboards. Reads Supabase (read-only). Static. |

The database (Supabase / Postgres) schema + seed + RLS lives in
[`tagger/supabase/`](tagger/supabase/).

## Run locally

```bash
# Tagger (data entry)
cd tagger && npm install && npm run dev      # http://localhost:5180

# Output site (results) — static
python3 -m http.server 5190 --directory landing   # http://localhost:5190
```

The tagger needs a `tagger/.env` (copy `tagger/.env.example`) with your Supabase URL +
anon key. See [`tagger/README.md`](tagger/README.md) and
[`tagger/supabase/README.md`](tagger/supabase/README.md) for full setup.

## Stack

React · TypeScript · Vite · Supabase (Postgres + Auth + RLS) · vanilla JS dashboard.
Branded with the Calcio AC and FIFA World Cup 2026 visual identity.
