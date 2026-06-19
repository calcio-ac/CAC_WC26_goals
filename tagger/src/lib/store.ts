import { useCallback, useEffect, useState } from "react";
import { AttackSequence, GcipProject, MatchMeta, TaggedEvent } from "./types";
import { uid } from "./util";

const KEY = "gcip.project.v1";

function emptyMatch(): MatchMeta {
  return {
    id: uid("match_"),
    videoUrl: "",
    videoId: "",
    competition: "FIFA World Cup 2026",
    homeTeam: "",
    homeCode: "",
    awayTeam: "",
    awayCode: "",
    matchDate: "",
    tagger: "",
    createdAt: new Date().toISOString(),
  };
}

function emptyProject(): GcipProject {
  return { schemaVersion: 1, match: emptyMatch(), sequences: [], events: [] };
}

function load(): GcipProject {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GcipProject;
  } catch {
    /* ignore corrupt state */
  }
  return emptyProject();
}

export function useProject() {
  const [project, setProject] = useState<GcipProject>(load);
  const [activeSequenceId, setActiveSequenceId] = useState<string | null>(
    () => load().sequences.at(-1)?.id ?? null,
  );

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(project));
  }, [project]);

  const updateMatch = useCallback((patch: Partial<MatchMeta>) => {
    setProject((p) => ({ ...p, match: { ...p.match, ...patch } }));
  }, []);

  const newSequence = useCallback(() => {
    const seq: AttackSequence = {
      id: uid("seq_"),
      matchId: project.match.id,
      index: project.sequences.length + 1,
      outcome: "goal", // we only record goals
      createdAt: new Date().toISOString(),
    };
    setProject((p) => ({ ...p, sequences: [...p.sequences, seq] }));
    setActiveSequenceId(seq.id);
    return seq;
  }, [project.match.id, project.sequences.length]);

  const deleteSequence = useCallback(
    (id: string) => {
      setProject((p) => ({
        ...p,
        sequences: p.sequences.filter((s) => s.id !== id),
        events: p.events.filter((e) => e.sequenceId !== id),
      }));
      setActiveSequenceId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const addEvent = useCallback(
    (e: Omit<TaggedEvent, "id" | "createdAt">) => {
      const ev: TaggedEvent = { ...e, id: uid("ev_"), createdAt: new Date().toISOString() };
      setProject((p) => ({ ...p, events: [...p.events, ev] }));
      return ev;
    },
    [],
  );

  const updateEvent = useCallback((id: string, patch: Partial<TaggedEvent>) => {
    setProject((p) => {
      const ev = p.events.find((e) => e.id === id);
      if (!ev) return p;
      return {
        ...p,
        events: p.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        sequences: p.sequences.map((s) => (s.id === ev.sequenceId ? { ...s, syncedAt: undefined } : s)),
      };
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setProject((p) => {
      const ev = p.events.find((e) => e.id === id);
      if (!ev) return p;
      return {
        ...p,
        events: p.events.filter((e) => e.id !== id),
        sequences: p.sequences.map((s) => (s.id === ev.sequenceId ? { ...s, syncedAt: undefined } : s)),
      };
    });
  }, []);

  const importProject = useCallback((next: GcipProject) => {
    setProject(next);
    setActiveSequenceId(next.sequences.at(-1)?.id ?? null);
  }, []);

  const resetProject = useCallback(() => {
    const fresh = emptyProject();
    setProject(fresh);
    setActiveSequenceId(null);
  }, []);

  const startNewMatch = useCallback((patch: Partial<MatchMeta>) => {
    setProject((p) => ({
      ...emptyProject(),
      match: {
        ...emptyMatch(),
        tagger: p.match.tagger, // preserve the user's name
        ...patch,
      },
    }));
    setActiveSequenceId(null);
  }, []);

  const markSequencesSynced = useCallback((syncedIds: string[]) => {
    const now = new Date().toISOString();
    setProject((p) => ({
      ...p,
      sequences: p.sequences.map((s) =>
        syncedIds.includes(s.id) ? { ...s, syncedAt: s.syncedAt || now } : s
      ),
    }));
  }, []);

  return {
    project,
    activeSequenceId,
    setActiveSequenceId,
    updateMatch,
    newSequence,
    deleteSequence,
    addEvent,
    updateEvent,
    deleteEvent,
    importProject,
    resetProject,
    startNewMatch,
    markSequencesSynced,
  };
}
