import { AttackSequence, BODY_PARTS, EVENT_META, EVENT_ORDER, TaggedEvent } from "../lib/types";
import { fmtClock } from "../lib/util";

const bodyLabel = (v?: string) => BODY_PARTS.find((b) => b.value === v)?.label;

interface Props {
  sequences: AttackSequence[];
  events: TaggedEvent[];
  activeSequenceId: string | null;
  onSelect: (id: string) => void;
  onDeleteSequence: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onSeek: (videoTime: number) => void;
}

export function SequenceList({
  sequences,
  events,
  activeSequenceId,
  onSelect,
  onDeleteSequence,
  onDeleteEvent,
  onSeek,
}: Props) {
  if (sequences.length === 0) {
    return <p className="empty">No goals logged yet. Hit “New goal” to start a sequence.</p>;
  }

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
              {evs.map((ev, i) => (
                <span key={ev.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <span className="arrow">→</span>}
                  <span className="chip" title={`(${ev.x}, ${ev.y}) m`}>
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
                    <span className="x" onClick={() => onDeleteEvent(ev.id)} title="remove">
                      ×
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
