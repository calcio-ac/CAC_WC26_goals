# GCIP — Output site (user-facing results dashboard)

The **public, user-facing** view of the Goal Creation Intelligence Platform. Users come
here to *explore the results*; they do not tag. It reads tagged goal data from Supabase
(anon key, **read-only**) and renders:

- **Hero** — cinematic WC2026 background video + "Eye of the Tiger" anthem, with live
  headline stats (goals / teams / scorers / assists).
- **Shot Map** — every goal plotted on a 105×68 m pitch, with shot-trajectory lines to the
  shot end location.
- **Goals feed** — each goal as a Pre-Assist → Assist → Goal chain, with team, minute and
  body part.
- **Leaders** — top scorers, top assisters, and a body-part breakdown.
- **Team filter** — scope everything to one nation.

Static — no build step.

## Who uses what

| Audience | Surface | Action |
|----------|---------|--------|
| **Users / fans / clubs** | this site (`landing/`) | view results & analytics |
| **Taggers** (`pp33@cac.com`, `av@cac.com`) | the tagger (`../tagger/`) | upload goal data |

The footer has a small **Tagger login** link to the tagger; everything else is for users.

## Run

```bash
python3 -m http.server 5190 --directory landing   # → http://localhost:5190
```

## Files

| File | |
|------|--|
| `index.html` | Hero + dashboard structure. |
| `app.js` | Supabase REST reads + shot map / feed / leaders rendering. |
| `styles.css` | Brand styling (video dimmed via CSS `filter` for legibility). |
| `assets/` | `hero.mp4`, `anthem.mp3`, logos, fonts. |

## Data source

Reads the `goals_flat` view (and `teams`) from Supabase via the public anon key — only
read policies are needed (already in `../tagger/supabase/01_schema.sql`). The dashboard
shows an empty state until taggers push goals, then populates automatically on reload.
