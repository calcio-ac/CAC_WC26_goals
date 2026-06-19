import { supabase } from "./supabase";
import { GcipProject } from "./types";

export interface SyncResult {
  matchId: string;
  sequences: number;
  events: number;
}

/**
 * Push a project to Supabase as a fresh match snapshot.
 * Server generates UUIDs; we map client sequence ids → db ids via seq_index.
 * Each call inserts a NEW match (re-syncing creates another snapshot).
 */
export async function pushProject(project: GcipProject): Promise<SyncResult> {
  if (!supabase) throw new Error("Supabase is not configured (.env missing)");
  const { match, sequences, events } = project;

  // 1. match
  let matchId = match.id || "";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);

  if (isUuid) {
    // Exact match selected from the Supabase dropdown. Update its row.
    const { error: mErr } = await supabase
      .from("matches")
      .update({
        video_url: match.videoUrl || null,
        video_id: match.videoId || null,
        tagger: match.tagger || null,
      })
      .eq("id", matchId);
    if (mErr) throw mErr;
  } else {
    // Client-generated fallback ID or manually created match.
    // Try to find the exact existing match by teams to prevent duplication.
    let existingId: string | undefined;
    if (match.homeCode && match.awayCode) {
      let query = supabase
        .from("matches")
        .select("id")
        .eq("home_code", match.homeCode)
        .eq("away_code", match.awayCode);
      
      if (match.matchDate) {
        query = query.eq("match_date", match.matchDate);
      }
      
      const { data: existing } = await query.maybeSingle();
      if (existing) existingId = existing.id;
    }

    if (existingId) {
      matchId = existingId;
      const { error: mErr } = await supabase
        .from("matches")
        .update({
          video_url: match.videoUrl || null,
          video_id: match.videoId || null,
          tagger: match.tagger || null,
        })
        .eq("id", matchId);
      if (mErr) throw mErr;
    } else {
      // Complete new row, nothing like it exists in DB.
      const { data: m, error: mErr } = await supabase
        .from("matches")
        .insert({
          competition: match.competition || null,
          match_date: match.matchDate || null,
          home_code: match.homeCode || null,
          home_team: match.homeTeam || null,
          away_code: match.awayCode || null,
          away_team: match.awayTeam || null,
          video_url: match.videoUrl || null,
          video_id: match.videoId || null,
          tagger: match.tagger || null,
        })
        .select("id")
        .single();
      if (mErr) throw mErr;
      matchId = m.id as string;
    }
  }

  // 2. sequences
  let idMap = new Map<string, string>();
  if (sequences.length) {
    const rows = sequences.map((s) => ({
      match_id: matchId,
      seq_index: s.index,
      outcome: s.outcome,
      notes: s.notes || null,
    }));
    const { data: seqs, error: sErr } = await supabase
      .from("attack_sequences")
      .insert(rows)
      .select("id, seq_index");
    if (sErr) throw sErr;
    const byIndex = new Map<number, string>();
    for (const r of seqs!) byIndex.set(r.seq_index, r.id);
    for (const s of sequences) {
      const dbId = byIndex.get(s.index);
      if (dbId) idMap.set(s.id, dbId);
    }
  }

  // 3. events
  if (events.length) {
    const rows = events
      .filter((e) => idMap.has(e.sequenceId))
      .map((e) => ({
        sequence_id: idMap.get(e.sequenceId)!,
        type: e.type,
        minute: e.minute ?? null,
        second: e.second ?? null,
        video_time: e.videoTime ?? null,
        x: e.x ?? null,
        y: e.y ?? null,
        end_x: e.endX ?? null,
        end_y: e.endY ?? null,
        team_code: e.teamCode || null,
        player: e.player || null,
        body_part: e.bodyPart || null,
        direction: e.direction || "ltr",
        notes: e.notes || null,
      }));
    if (rows.length) {
      const { error: eErr } = await supabase.from("events").insert(rows);
      if (eErr) throw eErr;
    }
  }

  return { matchId, sequences: sequences.length, events: events.length };
}

/** Lightweight connectivity check against the reference data. */
export async function testConnection(): Promise<number> {
  if (!supabase) throw new Error("Supabase is not configured (.env missing)");
  const { count, error } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
