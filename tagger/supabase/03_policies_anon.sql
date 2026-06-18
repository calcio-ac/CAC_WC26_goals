-- ════════════════════════════════════════════════════════════════════
--  GCIP — allow ANON (public) writes
--
--  Phase 1 convenience: the tagger uses the public anon key in the
--  browser, so it writes as the `anon` role. This grants anon INSERT/
--  UPDATE/DELETE on the tagging tables.
--
--  ⚠️  SECURITY: with these policies, ANYONE who has your anon key (it is
--      shipped in the frontend) can write to these tables. Fine for a
--      private, single-user tagging setup. Before opening this up, switch
--      to Supabase Auth and scope writes to authenticated users / owners
--      (see notes in supabase/README.md), then DROP these anon policies.
--
--  Run AFTER 01_schema.sql. Idempotent.
-- ════════════════════════════════════════════════════════════════════

drop policy if exists "matches anon write"   on public.matches;
drop policy if exists "sequences anon write" on public.attack_sequences;
drop policy if exists "events anon write"    on public.events;

create policy "matches anon write" on public.matches
  for all to anon using (true) with check (true);

create policy "sequences anon write" on public.attack_sequences
  for all to anon using (true) with check (true);

create policy "events anon write" on public.events
  for all to anon using (true) with check (true);

-- (teams / players already have public read policies from 01_schema.sql)
