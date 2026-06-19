import { useCallback, useEffect, useMemo, useState } from "react";
import { Pitch } from "./components/Pitch";
import { SequenceList } from "./components/SequenceList";
import { useProject } from "./lib/store";
import { useSquads } from "./lib/useSquads";
import { useMatches } from "./lib/useMatches";
import { useYouTube } from "./lib/useYouTube";
import { AttackDirection, BODY_PARTS, BodyPart, DIRECTIONS, EVENT_META, EVENT_ORDER, EventType } from "./lib/types";
import { fmtClock, parseYouTubeId } from "./lib/util";
import { supabaseConfigured } from "./lib/supabase";
import { pushProject } from "./lib/sync";
import { Auth } from "./lib/useAuth";

const YT_CONTAINER = "gcip-yt";
const CAC_URL = "https://calcioac.com";

type Selection = { code: string; player: string; bodyPart: BodyPart | "" };

export function App({ auth }: { auth: Auth | null }) {
  const {
    project,
    activeSequenceId,
    setActiveSequenceId,
    updateMatch,
    newSequence,
    deleteSequence,
    addEvent,
    updateEvent,
    deleteEvent,
  } = useProject();

  const { teams, byCode } = useSquads();
  const { matches: scheduledMatches } = useMatches();
  const yt = useYouTube(YT_CONTAINER, project.match.videoId || null);

  const [activeTab, setActiveTab] = useState<"setup" | "tagging">("setup");
  const [armed, setArmed] = useState<EventType | null>(null);
  const [armedTime, setArmedTime] = useState<number | null>(null);
  
  const [toast, setToast] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(project.match.videoUrl);
  const [syncing, setSyncing] = useState(false);
  const [matchPickerOpen, setMatchPickerOpen] = useState(true);
  const [matchSearch, setMatchSearch] = useState("");
  // Actual match minute (manual) — highlight videos don't carry the real clock.
  const [matchMinute, setMatchMinute] = useState<string>("");
  // Attack direction this half (teams switch ends) — used to normalize coords.
  const [direction, setDirection] = useState<AttackDirection>("ltr");
  // When set, the next pitch click records the shot END location for this event.
  const [awaitingEndFor, setAwaitingEndFor] = useState<string | null>(null);
  // When set, the next pitch click MOVES this event to the new location (re-plot).
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Per-action country + player selection (used when plotting on the pitch).
  const [sel, setSel] = useState<Record<EventType, Selection>>({
    pre_assist: { code: "", player: "", bodyPart: "" },
    assist: { code: "", player: "", bodyPart: "" },
    goal: { code: "", player: "", bodyPart: "" },
  });

  const { homeCode, awayCode } = project.match;
  const matchTeams = useMemo(
    () => [homeCode, awayCode].filter(Boolean) as string[],
    [homeCode, awayCode],
  );

  // Default each action's country to the home team once teams are picked.
  useEffect(() => {
    if (!homeCode) return;
    setSel((s) => {
      const next = { ...s };
      let changed = false;
      for (const t of EVENT_ORDER) {
        if (!matchTeams.includes(next[t].code)) {
          next[t] = { code: homeCode, player: "", bodyPart: next[t].bodyPart };
          changed = true;
        }
      }
      return changed ? next : s;
    });
  }, [homeCode, awayCode, matchTeams]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }, []);

  const loadVideo = () => {
    const id = parseYouTubeId(urlInput);
    if (!id) return flash("Couldn’t read a YouTube id from that URL");
    updateMatch({ videoUrl: urlInput, videoId: id });
    setActiveTab("tagging"); // Auto-switch to tagging tab when video loads
  };

  const pickTeam = (side: "home" | "away", code: string) => {
    const sq = byCode(code);
    if (side === "home") updateMatch({ homeCode: code, homeTeam: sq?.name ?? code });
    else updateMatch({ awayCode: code, awayTeam: sq?.name ?? code });
  };

  // Quick-load a scheduled match into the project metadata.
  const loadScheduledMatch = (m: typeof scheduledMatches[0]) => {
    updateMatch({
      homeCode: m.home_code,
      homeTeam: m.home_team,
      awayCode: m.away_code,
      awayTeam: m.away_team,
      matchDate: m.match_date ?? "",
      ...(m.video_url ? { videoUrl: m.video_url } : {}),
      ...(m.video_id ? { videoId: m.video_id } : {}),
    });
    if (m.video_url) setUrlInput(m.video_url);
    setMatchPickerOpen(false);
    flash(`Loaded: ${m.home_team} vs ${m.away_team}`);
  };

  const filteredMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    if (!q) return scheduledMatches;
    return scheduledMatches.filter(
      (m) =>
        m.home_team.toLowerCase().includes(q) ||
        m.away_team.toLowerCase().includes(q) ||
        m.home_code.toLowerCase().includes(q) ||
        m.away_code.toLowerCase().includes(q) ||
        (m.match_date ?? "").includes(q),
    );
  }, [scheduledMatches, matchSearch]);

  const setSelField = (type: EventType, patch: Partial<Selection>) =>
    setSel((s) => ({ ...s, [type]: { ...s[type], ...patch } }));

  // Re-plot: move an existing event to a new pitch position.
  const startReplot = useCallback((id: string) => {
    setEditingEventId(id);
    setArmed(null);
    setArmedTime(null);
    setAwaitingEndFor(null);
    flash("Click the pitch to move this event");
  }, [flash]);

  const cancelReplot = useCallback(() => {
    setEditingEventId(null);
  }, []);

  const armTag = useCallback((type: EventType | null) => {
    if (!type) {
      setArmed(null);
      setArmedTime(null);
      return;
    }
    setArmed(type);
    const t = yt.getTime();
    setArmedTime(t);
    flash(`Armed ${EVENT_META[type].label} @ ${fmtClock(t)} — Click pitch to plot`);
  }, [yt, flash]);

  // Place the armed action at a pitch coordinate.
  const placeAt = useCallback(
    (x: number, y: number) => {
      // Re-plot mode: move an existing event's START position.
      if (editingEventId) {
        updateEvent(editingEventId, { x, y });
        flash(`Moved to (${x}, ${y}) m`);
        setEditingEventId(null);
        return;
      }
      // Second click of a goal: record the shot END location.
      if (awaitingEndFor) {
        updateEvent(awaitingEndFor, { endX: x, endY: y });
        flash(`Shot end @ ${x}, ${y}m`);
        setAwaitingEndFor(null);
        setArmed(null);
        setArmedTime(null);
        return;
      }
      if (!armed) return flash("Arm a tag first (P / A / G)");
      if (matchTeams.length < 2) return flash("Pick both teams in Match Setup first");
      let seqId = activeSequenceId;
      if (!seqId) seqId = newSequence().id;
      
      const vt = armedTime !== null ? armedTime : yt.getTime();
      const s = sel[armed];
      // Match minute is entered manually (highlight video time ≠ real match clock).
      const mmRaw = matchMinute.trim();
      const mm = mmRaw === "" ? Math.floor(vt / 60) : parseInt(mmRaw, 10);
      const ev = addEvent({
        sequenceId: seqId,
        type: armed,
        videoTime: Math.round(vt * 100) / 100, // video position → for replay
        minute: Number.isFinite(mm) ? mm : Math.floor(vt / 60), // real match minute
        second: mmRaw === "" ? Math.floor(vt % 60) : 0,
        x,
        y,
        direction, // normalized later by the goals_flat view
        teamCode: s.code || undefined,
        player: s.player || undefined,
        bodyPart: s.bodyPart || undefined,
      });
      flash(`${EVENT_META[armed].label}${s.player ? ` · ${s.player}` : ""} @ ${x}, ${y}m`);
      if (armed === "goal") {
        // Goal needs a second click for the shot end location.
        setAwaitingEndFor(ev.id);
      } else {
        // Auto-advance the chain.
        setArmed(armed === "pre_assist" ? "assist" : "goal");
      }
      setArmedTime(null);
    },
    [editingEventId, awaitingEndFor, armed, armedTime, matchTeams.length, activeSequenceId, newSequence, yt, sel, matchMinute, direction, addEvent, updateEvent, flash],
  );

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      switch (e.key.toLowerCase()) {
        case "p": armTag("pre_assist"); break;
        case "a": armTag("assist"); break;
        case "g": armTag("goal"); break;
        case "n": newSequence(); flash("New goal sequence"); break;
        case "escape": armTag(null); setAwaitingEndFor(null); setEditingEventId(null); break;
        case " ": e.preventDefault(); yt.togglePlay(); break;
        case "arrowleft": e.preventDefault(); e.shiftKey ? yt.nudge(-5) : yt.frameStep(-1); break;
        case "arrowright": e.preventDefault(); e.shiftKey ? yt.nudge(5) : yt.frameStep(1); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [yt, newSequence, flash, armTag]);

  const syncToSupabase = async () => {
    if (project.sequences.length === 0) return flash("Nothing to sync yet");
    if (!project.match.homeCode || !project.match.awayCode)
      return flash("Pick both teams before syncing");
    setSyncing(true);
    try {
      const r = await pushProject(project);
      flash(`Synced ✓ ${r.sequences} goals · ${r.events} events`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      flash(`Sync failed: ${msg}`);
      console.error("Supabase sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const teamOptions = teams.map((t) => (
    <option key={t.code} value={t.code}>
      {t.name} ({t.code})
    </option>
  ));

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={CAC_URL} target="_blank" rel="noopener noreferrer" title="calcioac.com">
          <img className="cac" src={`${import.meta.env.BASE_URL}assets/CAC.svg`} alt="Calcio AC" />
          <div>
            <div className="title">
              GCIP <span className="accent">·</span> TAGGER
            </div>
            <div className="sub">Goal Creation Intelligence Platform</div>
          </div>
        </a>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 13 }}>
          {project.sequences.length} goals · {project.events.length} events
        </span>
        {auth?.email && (
          <span className="user-chip">
            <span className="dot-on" />
            {auth.email}
            <button className="btn sm ghost" onClick={auth.signOut}>
              Sign out
            </button>
          </span>
        )}
      </header>

      <div className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === "setup" ? "active" : ""}`} 
          onClick={() => setActiveTab("setup")}
        >
          1. Match Setup
        </button>
        <button 
          className={`tab-btn ${activeTab === "tagging" ? "active" : ""}`} 
          onClick={() => setActiveTab("tagging")}
          disabled={!project.match.videoId}
        >
          2. Tagging Workspace
        </button>
      </div>

      <main className={`main ${activeTab}-view`}>
        {/* ── Setup Column ── */}
        <section className="col col-setup">
          <div className="card match-picker-card">
            <h3
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setMatchPickerOpen((o) => !o)}
            >
              <span className="step">★</span> Group Stage Matches
              <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>
                {scheduledMatches.length} fixtures
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {matchPickerOpen ? "▲ hide" : "▼ show"}
              </span>
            </h3>
            {matchPickerOpen && (
              <>
                <input
                  className="match-search"
                  placeholder="Search team or date…"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                />
                <div className="match-list">
                  {filteredMatches.map((m) => {
                    const isActive =
                      project.match.homeCode === m.home_code &&
                      project.match.awayCode === m.away_code &&
                      project.match.matchDate === (m.match_date ?? "");
                    const hasVideo = !!m.video_id;
                    return (
                      <button
                        key={m.id}
                        className={`match-row-btn${isActive ? " active" : ""}${hasVideo ? " tagged" : ""}`}
                        onClick={() => loadScheduledMatch(m)}
                      >
                        <span className="match-date">
                          {m.match_date
                            ? new Date(m.match_date + "T00:00:00").toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })
                            : "TBD"}
                        </span>
                        <span className="match-teams">
                          <span className="match-code">{m.home_code}</span>
                          <span className="match-home">{m.home_team}</span>
                          <span className="match-vs">vs</span>
                          <span className="match-away">{m.away_team}</span>
                          <span className="match-code">{m.away_code}</span>
                        </span>
                        {hasVideo && <span className="match-tagged" title="Video already loaded">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h3>
              <span className="step">1</span> Match Configuration
            </h3>
            <div className="grid2">
              <div className="field">
                <label>Home team</label>
                <select value={homeCode} onChange={(e) => pickTeam("home", e.target.value)}>
                  <option value="">Select country…</option>
                  {teamOptions}
                </select>
              </div>
              <div className="field">
                <label>Away team</label>
                <select value={awayCode} onChange={(e) => pickTeam("away", e.target.value)}>
                  <option value="">Select country…</option>
                  {teamOptions}
                </select>
              </div>
            </div>
            {homeCode && awayCode && (
              <div className="matchup">
                {project.match.homeTeam} <span className="muted">vs</span> {project.match.awayTeam}
              </div>
            )}
            <div className="grid2" style={{ marginTop: 8 }}>
              <div className="field">
                <label>Competition</label>
                <input value={project.match.competition} onChange={(e) => updateMatch({ competition: e.target.value })} />
              </div>
              <div className="field">
                <label>Match date</label>
                <input type="date" value={project.match.matchDate} onChange={(e) => updateMatch({ matchDate: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Tagger</label>
              <input value={project.match.tagger} onChange={(e) => updateMatch({ tagger: e.target.value })} />
            </div>
          </div>

          <div className="card">
            <h3>
              <span className="step">2</span> Video Source
            </h3>
            <div className="row">
              <input
                style={{ flex: 1, background: "#0e120b", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 7, padding: "7px 9px", fontFamily: "var(--body-font)" }}
                placeholder="Paste YouTube URL or video id…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadVideo()}
              />
              <button className="btn primary" onClick={loadVideo}>Load Video</button>
            </div>
          </div>
        </section>

        {/* ── Video Column (Shared/Persistent) ── */}
        <section className="col col-video">
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {activeTab === "setup" ? (
              <h3 style={{ marginBottom: 10 }}><span className="step">3</span> Verify Video</h3>
            ) : (
              <div className="transport" style={{ marginTop: 0, marginBottom: 10, padding: 0, background: "transparent", border: "none" }}>
                <span className="clock">{fmtClock(yt.time)} / {fmtClock(yt.duration)}</span>
                <button className="btn sm" onClick={() => yt.togglePlay()}>{yt.playing ? "⏸" : "▶"} <span className="kbd">Space</span></button>
                <button className="btn sm" onClick={() => yt.frameStep(-1)}>◁ frame</button>
                <button className="btn sm" onClick={() => yt.frameStep(1)}>frame ▷</button>
                <button className="btn sm" onClick={() => yt.nudge(-5)}>−5s</button>
                <button className="btn sm" onClick={() => yt.nudge(5)}>+5s</button>
                <select
                  style={{ background: "#0e120b", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 7, padding: "5px 8px" }}
                  defaultValue="1"
                  onChange={(e) => yt.setRate(parseFloat(e.target.value))}
                  title="playback speed"
                >
                  {[0.25, 0.5, 1, 1.5, 2].map((r) => (<option key={r} value={r}>{r}×</option>))}
                </select>
              </div>
            )}
            
            <div className="video-wrap" style={{ flex: 1 }}>
              <div id={YT_CONTAINER} style={{ width: "100%", height: "100%" }} />
              {!project.match.videoId && (
                <div className="placeholder">
                  <div>
                    <div style={{ fontFamily: "var(--head-font)", fontSize: 22 }}>NO VIDEO LOADED</div>
                    <div style={{ marginTop: 6 }}>Paste a YouTube match link in the Setup tab.</div>
                  </div>
                </div>
              )}
            </div>
            
            {activeTab === "setup" && project.match.videoId && (
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <button className="btn primary big" onClick={() => setActiveTab("tagging")}>
                  Continue to Tagging →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Tagging Column ── */}
        <section className="col col-tagging">
          <div className="card">
            <h3>
              <span className="step">3</span> Tag Action
            </h3>
            {matchTeams.length < 2 ? (
              <p className="empty">Pick both teams in Match Setup to enable player selection.</p>
            ) : (
              <>
              <div className="minute-row">
                <label>Match minute</label>
                <input
                  type="number"
                  min={0}
                  max={130}
                  value={matchMinute}
                  onChange={(e) => setMatchMinute(e.target.value)}
                  placeholder="e.g. 25"
                />
                <label style={{ marginLeft: 6 }}>Attacking</label>
                <div className="dir-toggle">
                  {DIRECTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      className={direction === d.value ? "on" : ""}
                      onClick={() => setDirection(d.value)}
                    >
                      {d.value === "ltr" ? "→ L-R" : "← R-L"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="actions">
                {EVENT_ORDER.map((t) => {
                  const squad = byCode(sel[t].code);
                  const isArmed = armed === t;
                  return (
                    <div key={t} className={`action-row ${isArmed ? "armed" : ""}`}>
                      <button className="action-arm" onClick={() => armTag(isArmed ? null : t)}>
                        <span className="dot" style={{ background: EVENT_META[t].color }} />
                        <span className="name">{EVENT_META[t].label}</span>
                        <span className="kbd">{EVENT_META[t].key}</span>
                      </button>
                      <select
                        className="sel-country"
                        value={sel[t].code}
                        onChange={(e) => setSelField(t, { code: e.target.value, player: "" })}
                      >
                        {matchTeams.map((c) => (
                          <option key={c} value={c}>{byCode(c)?.name ?? c}</option>
                        ))}
                      </select>
                      <select
                        className="sel-player"
                        value={sel[t].player}
                        onChange={(e) => setSelField(t, { player: e.target.value })}
                      >
                        <option value="">Player…</option>
                        {squad?.players.map((p) => (
                          <option key={p.name + p.number} value={p.name}>
                            {p.number ? `${p.number}. ` : ""}{p.name} · {p.pos}
                          </option>
                        ))}
                      </select>
                      <select
                        className="sel-body"
                        value={sel[t].bodyPart}
                        onChange={(e) => setSelField(t, { bodyPart: e.target.value as BodyPart })}
                      >
                        <option value="">Body part…</option>
                        {BODY_PARTS.map((b) => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              </>
            )}
            <div className="legend">
              <span><span className="kbd">P</span>/<span className="kbd">A</span>/<span className="kbd">G</span> capture time & arm</span>
              <span><span className="kbd">N</span> new goal</span>
              <span><span className="kbd">Esc</span> disarm</span>
            </div>
          </div>

          <div className="card">
            <h3>
              Spatial Map <span className="count">105 × 68 m</span>
            </h3>
            <div className="pitch-hint">
              {awaitingEndFor ? (
                <span style={{ color: EVENT_META.goal.color }}>
                  ◎ Now click the <strong>shot end location</strong> (where the ball finished) ·
                  Esc to skip
                </span>
              ) : armed ? (
                <span style={{ color: EVENT_META[armed].color }}>
                  ● Armed: {EVENT_META[armed].label}
                  {sel[armed].player ? ` — ${sel[armed].player} (${sel[armed].code})` : ""}
                  {sel[armed].bodyPart
                    ? ` · ${BODY_PARTS.find((b) => b.value === sel[armed].bodyPart)?.label}`
                    : ""} — click to plot{armed === "goal" ? " shot start" : ""}
                </span>
              ) : (
                "No tag armed — press P / A / G to capture time and start"
              )}
            </div>
            <Pitch events={project.events} onPick={placeAt} highlightSequenceId={activeSequenceId} />
            <div className="legend">
              {EVENT_ORDER.map((t) => (
                <span key={t}>
                  <span className="dot" style={{ background: EVENT_META[t].color }} />
                  {EVENT_META[t].label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Goals Column ── */}
        <section className="col col-goals">
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Goals <span className="count">{project.sequences.length}</span>
              <span style={{ flex: 1 }} />
              <button className="btn sm primary" onClick={() => newSequence()}>+ New <span className="kbd">N</span></button>
            </h3>
            
            <div style={{ overflow: "auto", flex: 1, marginTop: 14 }}>
              <SequenceList
                sequences={project.sequences}
                events={project.events}
                activeSequenceId={activeSequenceId}
                onSelect={setActiveSequenceId}
                onDeleteSequence={deleteSequence}
                onDeleteEvent={deleteEvent}
                onUpdateEvent={updateEvent}
                onSeek={(t) => yt.seekTo(t)}
                editingEventId={editingEventId}
                onStartReplot={startReplot}
                onCancelReplot={cancelReplot}
                matchTeams={matchTeams}
                byCode={byCode}
              />
            </div>

            {supabaseConfigured && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", textAlign: "center" }}>
                <button 
                  className="btn primary big" 
                  style={{ width: "100%", padding: "12px" }}
                  onClick={syncToSupabase} 
                  disabled={syncing || project.sequences.length === 0}
                >
                  {syncing ? "Syncing…" : "⬆ Save Logs to Supabase"}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
