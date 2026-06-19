// ── GCIP core data model ──────────────────────────────────────────────
// Mirrors the relational schema: matches → attack_sequences → events.
// Pitch coordinates are standardized to a 105m x 68m pitch so data is
// consistent across every league and broadcast feed.

export const PITCH_LENGTH = 105; // meters, x axis (goal to goal)
export const PITCH_WIDTH = 68; // meters, y axis (touchline to touchline)

/** The three decisive goal-creation actions GCIP isolates. We only record goals. */
export type EventType = "pre_assist" | "assist" | "goal";

export const EVENT_ORDER: EventType[] = ["pre_assist", "assist", "goal"];

export const EVENT_META: Record<
  EventType,
  { label: string; short: string; key: string; color: string }
> = {
  pre_assist: { label: "Pre-Assist", short: "PA", key: "P", color: "#3b82f6" },
  assist: { label: "Assist", short: "A", key: "A", color: "#6BDB58" },
  goal: { label: "Goal", short: "G", key: "G", color: "#f59e0b" },
};

/** Every recorded sequence ends in a goal. */
export type SequenceOutcome = "goal";

/**
 * Direction the scoring team attacks in the video for this action.
 * Coordinates are stored RAW (as clicked on the fixed 0→105 pitch); the
 * goals_flat view mirrors "rtl" actions so the dashboard is always L→R.
 */
export type AttackDirection = "ltr" | "rtl";

export const DIRECTIONS: { value: AttackDirection; label: string }[] = [
  { value: "ltr", label: "Left → Right" },
  { value: "rtl", label: "Right → Left" },
];

/** Body part used to perform the action. */
export type BodyPart = "right_foot" | "left_foot" | "head" | "other";

export const BODY_PARTS: { value: BodyPart; label: string }[] = [
  { value: "right_foot", label: "Right foot" },
  { value: "left_foot", label: "Left foot" },
  { value: "head", label: "Head" },
  { value: "other", label: "Other" },
];

export interface TaggedEvent {
  id: string;
  sequenceId: string;
  type: EventType;
  /** Match clock at which the action occurs. */
  minute: number;
  second: number;
  /** Raw video timestamp in seconds (for jump-back / sync). */
  videoTime: number;
  /** Standardized pitch coordinates: x ∈ [0,105], y ∈ [0,68]. */
  x: number;
  y: number;
  /** Shot END location (goal events only): where the ball finished. */
  endX?: number;
  endY?: number;
  /** The player performing the action (name on shirt). */
  player?: string;
  /** FIFA 3-letter code of the player's national team. */
  teamCode?: string;
  /** Body part used (foot/head/other). */
  bodyPart?: BodyPart;
  /** Attack direction in the video; the view mirrors "rtl" to normalize. */
  direction?: AttackDirection;
  notes?: string;
  createdAt: string;
}

export interface AttackSequence {
  id: string;
  matchId: string;
  index: number; // ordering within the match
  outcome: SequenceOutcome; // always "goal" — we only record goals
  notes?: string;
  syncedAt?: string;
  createdAt: string;
}

export interface MatchMeta {
  id: string;
  videoUrl: string;
  videoId: string;
  competition: string;
  homeTeam: string; // display name
  homeCode: string; // FIFA 3-letter code
  awayTeam: string;
  awayCode: string;
  matchDate: string; // ISO yyyy-mm-dd
  tagger: string;
  createdAt: string;
}

// ── Squad data (loaded from /assets/squads.json) ──────────────────────
export interface SquadPlayer {
  number: number | null;
  pos: string;
  name: string;
}
export interface Squad {
  name: string;
  code: string;
  players: SquadPlayer[];
}
export interface SquadData {
  tournament: string;
  teams: Squad[];
}

/** The full serialized project — what gets exported / imported as JSON. */
export interface GcipProject {
  schemaVersion: 1;
  match: MatchMeta;
  sequences: AttackSequence[];
  events: TaggedEvent[];
}
