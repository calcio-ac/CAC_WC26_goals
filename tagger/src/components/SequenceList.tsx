import { useState } from "react";
import { AttackSequence, BODY_PARTS, BodyPart, EVENT_META, EVENT_ORDER, Squad, TaggedEvent } from "../lib/types";
import { fmtClock } from "../lib/util";

const bodyLabel = (v?: string) => BODY_PARTS.find((b) => b.value === v)?.label;

interface Props {
  sequences: AttackSequence[];
  events: TaggedEvent[];
  activeSequenceId: string | null;
  onSelect: (id: string) => void;
  onDeleteSequence: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (id: string, patch: Partial<TaggedEvent>) => void;
  onSeek: (videoTime: number) => void;
  /** When set, the pitch is "armed" to re-plot this event's position */
  editingEventId: string | null;
  onStartReplot: (id: string) => void;
  onCancelReplot: () => void;
  /** Squad list for the two teams in the match */
  matchTeams: string[];
  byCode: (code: string) => Squad | undefined;
}

export function SequenceList({
  sequences,
  events,
  activeSequenceId,
  onSelect,
  onDeleteSequence,
  onDeleteEvent,
  onUpdateEvent,
  onSeek,
  editingEventId,
  onStartReplot,
  onCancelReplot,
  matchTeams,
  byCode,
}: Props) {
  /** Which event's edit drawer is open */
  const [openEditId, setOpenEditId] = useState<string | null>(null);

  if (sequences.length === 0) {
    return <p className="empty">No goals logged yet. Hit "New goal" to start a sequence.</p>;
  }

  const toggleEdit = (id: string) => {
    if (openEditId === id) {
      setOpenEditId(null);
      onCancelReplot();
    } else {
      setOpenEditId(id);
    }
  };

  return (
    <>
      {[...sequences].reverse().map((seq) => {
        const evs = events
          .filter((e) => e.sequenceId === seq.id)
          .sort(
            (a, b) =>
              EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || a.videoTime - b.videoTime,
          );
        const active = seq.id === activeSequenceId;
        const scorer = evs.find((e) => e.type === "goal");
        return (
          <div key={seq.id} className={`seq ${active ? "active" : ""}`}>
            <div
              className="seq-head"
              onClick={() => onSelect(seq.id)}
              style={{ cursor: "pointer" }}
            >
              <span className="name">GOAL {seq.index}</span>
              {scorer?.player && (
                <span className="outcome goal">
                  ⚽ {scorer.player}
                  {scorer.teamCode ? ` · ${scorer.teamCode}` : ""}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button
                className="btn sm danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSequence(seq.id);
                }}
              >
                ✕
              </button>
            </div>
            <div className="chain">
              {evs.length === 0 && (
                <span className="empty">empty — arm a tag and click the pitch</span>
              )}
              {evs.map((ev, i) => {
                const isEditing = openEditId === ev.id;
                const isReplotting = editingEventId === ev.id;
                const squad = byCode(ev.teamCode ?? "");
                return (
                  <span key={ev.id} style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                    {/* ── chip row ── */}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {i > 0 && <span className="arrow">→</span>}
                      <span className={`chip${isEditing ? " chip-editing" : ""}`} title={`(${ev.x}, ${ev.y}) m`}>
                        <span className="dot" style={{ background: EVENT_META[ev.type].color }} />
                        <span>{EVENT_META[ev.type].short}</span>
                        {ev.player && (
                          <span>
                            {ev.player}
                            {ev.teamCode ? <span className="muted"> ({ev.teamCode})</span> : null}
                          </span>
                        )}
                        {ev.bodyPart && <span className="muted">· {bodyLabel(ev.bodyPart)}</span>}
                        <span
                          className="muted"
                          style={{ cursor: "pointer" }}
                          onClick={() => onSeek(ev.videoTime)}
                          title="jump to video"
                        >
                          {fmtClock(ev.videoTime)}
                        </span>
                        {/* Edit button */}
                        <span
                          className="chip-edit-btn"
                          title="Edit event"
                          onClick={(e) => { e.stopPropagation(); toggleEdit(ev.id); }}
                        >
                          ✎
                        </span>
                        <span className="x" onClick={() => onDeleteEvent(ev.id)} title="remove">
                          ×
                        </span>
                      </span>
                    </span>

                    {/* ── inline edit drawer ── */}
                    {isEditing && (
                      <div className="event-edit-drawer">
                        <div className="event-edit-grid">
                          {/* Team */}
                          {matchTeams.length > 0 && (
                            <div className="event-edit-field">
                              <label>Team</label>
                              <select
                                value={ev.teamCode ?? ""}
                                onChange={(e) => onUpdateEvent(ev.id, { teamCode: e.target.value, player: "" })}
                              >
                                <option value="">—</option>
                                {matchTeams.map((c) => (
                                  <option key={c} value={c}>{byCode(c)?.name ?? c}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {/* Player */}
                          <div className="event-edit-field">
                            <label>Player</label>
                            <select
                              value={ev.player ?? ""}
                              onChange={(e) => onUpdateEvent(ev.id, { player: e.target.value })}
                            >
                              <option value="">—</option>
                              {squad?.players.map((p) => (
                                <option key={p.name + p.number} value={p.name}>
                                  {p.number ? `${p.number}. ` : ""}{p.name} · {p.pos}
                                </option>
                              ))}
                            </select>
                          </div>
                          {/* Body part */}
                          <div className="event-edit-field">
                            <label>Body part</label>
                            <select
                              value={ev.bodyPart ?? ""}
                              onChange={(e) => onUpdateEvent(ev.id, { bodyPart: e.target.value as BodyPart })}
                            >
                              <option value="">—</option>
                              {BODY_PARTS.map((b) => (
                                <option key={b.value} value={b.value}>{b.label}</option>
                              ))}
                            </select>
                          </div>
                          {/* Match minute */}
                          <div className="event-edit-field">
                            <label>Minute</label>
                            <input
                              type="number"
                              min={0}
                              max={130}
                              value={ev.minute ?? ""}
                              onChange={(e) => onUpdateEvent(ev.id, { minute: parseInt(e.target.value, 10) })}
                            />
                          </div>
                        </div>
                        {/* Position */}
                        <div className="event-edit-pos">
                          <span className="muted" style={{ fontSize: 12 }}>
                            Position: <strong style={{ color: "var(--text)" }}>({ev.x}, {ev.y}) m</strong>
                            {ev.endX != null && <> → end: ({ev.endX}, {ev.endY}) m</>}
                          </span>
                          {isReplotting ? (
                            <button className="btn sm" onClick={onCancelReplot} style={{ color: "var(--amber)" }}>
                              ✕ Cancel replot
                            </button>
                          ) : (
                            <button
                              className="btn sm"
                              onClick={() => onStartReplot(ev.id)}
                              title="Click pitch to move this event"
                            >
                              ◎ Move on pitch
                            </button>
                          )}
                        </div>
                        {isReplotting && (
                          <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 4 }}>
                            ← Click the pitch to set the new position
                          </div>
                        )}
                      </div>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
