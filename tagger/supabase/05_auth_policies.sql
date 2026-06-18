-- ════════════════════════════════════════════════════════════════════
--  GCIP — lock writes to authenticated taggers only
--
--  Replaces the open anon-write policies (03_policies_anon.sql) with
--  policies that allow writes ONLY for signed-in users whose email is in
--  the tagger allowlist. Public READ stays open so the user dashboard works.
--
--  PREREQUISITE — create the two tagger accounts in Supabase:
--    Dashboard → Authentication → Users → "Add user"
--      • pp33@cac.com   (set a password, tick "Auto Confirm User")
--      • av@cac.com     (set a password, tick "Auto Confirm User")
--
--  Run AFTER 01_schema.sql (and after 03 if you ran it). Idempotent.
-- ════════════════════════════════════════════════════════════════════

-- 1) remove the open anon-write policies (if present)
drop policy if exists "matches anon write"   on public.matches;
drop policy if exists "sequences anon write" on public.attack_sequences;
drop policy if exists "events anon write"    on public.events;

-- 2) remove the original "any authenticated" write policies from 01
drop policy if exists "matches write"   on public.matches;
drop policy if exists "sequences write" on public.attack_sequences;
drop policy if exists "events write"    on public.events;

-- 3) helper: is the current user an allowed tagger?
create or replace function public.is_tagger()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in ('pp33@cac.com', 'av@cac.com'),
    false
  );
$$;

-- 4) email-restricted write policies (read stays public via 01_schema.sql)
create policy "matches tagger write" on public.matches
  for all to authenticated
  using (public.is_tagger()) with check (public.is_tagger());

create policy "sequences tagger write" on public.attack_sequences
  for all to authenticated
  using (public.is_tagger()) with check (public.is_tagger());

create policy "events tagger write" on public.events
  for all to authenticated
  using (public.is_tagger()) with check (public.is_tagger());

-- To change the allowlist later, just edit the email list in public.is_tagger()
-- and re-run this file.
