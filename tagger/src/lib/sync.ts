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
      .upsert(rows, { onConflict: "match_id,seq_index" })
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
    const dbSeqIds = [...idMap.values()];
    if (dbSeqIds.length) {
      const { error: delErr } = await supabase.from("events").delete().in("sequence_id", dbSeqIds);
      if (delErr) throw delErr;
    }
    
    if (rows.length) {
      const { error: eErr } = await supabase.from("events").insert(rows);
      if (eErr) throw eErr;
    }
  }

  return { matchId, sequences: sequences.length, events: events.length };
}

/**
 * Pull a project from Supabase by its match ID.
 * Returns null if the match does not exist.
 */
export async function pullProject(matchId: string): Promise<GcipProject | null> {
  if (!supabase) throw new Error("Supabase is not configured (.env missing)");

  // 1. Fetch match
  const { data: m, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!m) return null;

  // 2. Fetch sequences
  const { data: seqs, error: sErr } = await supabase
    .from("attack_sequences")
    .select("*")
    .eq("match_id", matchId)
    .order("seq_index", { ascending: true });
  if (sErr) throw sErr;

  const sequences = (seqs || []).map((s) => ({
    id: s.id, // we use the DB UUID directly on the client when pulling
    matchId: s.match_id,
    index: s.seq_index,
    outcome: s.outcome as "goal",
    notes: s.notes || undefined,
    syncedAt: new Date().toISOString(), // perfectly synced
    createdAt: s.created_at,
  }));

  // 3. Fetch events
  const seqIds = sequences.map((s) => s.id);
  let events: any[] = [];
  if (seqIds.length > 0) {
    const { data: evs, error: eErr } = await supabase
      .from("events")
      .select("*")
      .in("sequence_id", seqIds)
      .order("created_at", { ascending: true });
    if (eErr) throw eErr;
    
    events = (evs || []).map((e) => ({
      id: e.id,
      sequenceId: e.sequence_id,
      type: e.type,
      minute: e.minute ?? 0,
      second: e.second ?? 0,
      videoTime: e.video_time ? Number(e.video_time) : 0,
      x: e.x ? Number(e.x) : 0,
      y: e.y ? Number(e.y) : 0,
      endX: e.end_x ? Number(e.end_x) : undefined,
      endY: e.end_y ? Number(e.end_y) : undefined,
      teamCode: e.team_code || undefined,
      player: e.player || undefined,
      bodyPart: e.body_part || undefined,
      direction: e.direction || "ltr",
      notes: e.notes || undefined,
      createdAt: e.created_at,
    }));
  }

  return {
    schemaVersion: 1,
    match: {
      id: m.id,
      competition: m.competition || "FIFA World Cup 2026",
      matchDate: m.match_date || "",
      homeCode: m.home_code || "",
      homeTeam: m.home_team || "",
      awayCode: m.away_code || "",
      awayTeam: m.away_team || "",
      videoUrl: m.video_url || "",
      videoId: m.video_id || "",
      tagger: m.tagger || "",
      createdAt: m.created_at,
    },
    sequences,
    events,
  };
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
