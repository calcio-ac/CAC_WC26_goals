// ══════════════════════════════════════════════════════════════════════
//  GCIP — user-facing results dashboard
//  Reads tagged goal data from Supabase (anon key, read-only) and renders
//  a shot map, goals feed and leaderboards.
// ══════════════════════════════════════════════════════════════════════

const SB = {
  url: "https://fsufkacwjoimgjcnmeff.supabase.co/rest/v1",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWZrYWN3am9pbWdqY25tZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjAxMzYsImV4cCI6MjA5NzI5NjEzNn0.OCQ-pVQfddQZwgAAnRs5cWtv2HoxzxS1SRzHd6yBVcs",
};

async function sbGet(path) {
  const res = await fetch(`${SB.url}/${path}`, {
    headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const PITCH_L = 105;
const PITCH_W = 68;

let ALL_GOALS = []; // goals_flat rows
let RENDERED = []; // currently shown (filtered) rows — index source for clicks
let TEAM_NAMES = {}; // code -> name

// ── Pitch SVG ─────────────────────────────────────────────────────────
function pitchSvg(goals) {
  const S = 8;
  const W = PITCH_L * S;
  const H = PITCH_W * S;
  const line = `stroke="#3f7d47" stroke-width="1.5" fill="none" opacity="0.7"`;
  let p = `<svg viewBox="0 0 ${W} ${H}" class="pitch" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i < 10; i++)
    p += `<rect x="${(i * W) / 10}" y="0" width="${W / 10}" height="${H}" fill="${
      i % 2 ? "#11240f" : "#0e1f0d"
    }"/>`;
  p += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" ${line}/>`;
  p += `<line x1="${W / 2}" y1="2" x2="${W / 2}" y2="${H - 2}" ${line}/>`;
  p += `<circle cx="${W / 2}" cy="${H / 2}" r="${9.15 * S}" ${line}/>`;
  for (const left of [true, false]) {
    const pbW = 16.5 * S,
      pbH = 40.32 * S,
      gbW = 5.5 * S,
      gbH = 18.32 * S;
    const px = left ? 2 : W - 2 - pbW;
    const gx = left ? 2 : W - 2 - gbW;
    p += `<rect x="${px}" y="${(H - pbH) / 2}" width="${pbW}" height="${pbH}" ${line}/>`;
    p += `<rect x="${gx}" y="${(H - gbH) / 2}" width="${gbW}" height="${gbH}" ${line}/>`;
  }
  goals.forEach((g, i) => {
    if (g.goal_x == null || g.goal_y == null) return;
    const cx = (g.goal_x / PITCH_L) * W;
    const cy = (g.goal_y / PITCH_W) * H;
    const hasEnd = g.shot_end_x != null && g.shot_end_y != null;
    const tip = `${g.scorer || "Goal"}${g.scoring_team ? " (" + g.scoring_team + ")" : ""}${
      g.minute != null ? " · " + g.minute + "'" : ""
    }${g.goal_body_part ? " · " + g.goal_body_part.replace("_", " ") : ""}`;
    p += `<g class="goal-dot" data-idx="${i}" style="cursor:pointer">`;
    p += `<title>${esc(tip)} — click to watch</title>`;
    if (hasEnd) {
      const ex = (g.shot_end_x / PITCH_L) * W;
      const ey = (g.shot_end_y / PITCH_W) * H;
      p += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3" opacity="0.8"/>`;
      p += `<circle cx="${ex}" cy="${ey}" r="4" fill="none" stroke="#f59e0b" stroke-width="2"/>`;
    }
    p += `<circle cx="${cx}" cy="${cy}" r="9" fill="transparent"/>`; // larger hit area
    p += `<circle cx="${cx}" cy="${cy}" r="6" fill="#6bdb58" stroke="#0c0f0a" stroke-width="1.5"/>`;
    p += `</g>`;
  });
  p += `</svg>`;
  return p;
}

// ── Assist heat map (binned density on a pitch) ───────────────────────
function heatColor(t) {
  // 0 → green, 0.5 → lime/yellow, 1 → orange-red
  const stops = [
    [0.0, [46, 125, 50]],
    [0.5, [155, 219, 58]],
    [0.8, [245, 158, 11]],
    [1.0, [239, 68, 68]],
  ];
  let a = stops[0],
    b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const f = (t - a[0]) / (b[0] - a[0] || 1);
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function heatMapSvg(goals) {
  const pts = goals
    .filter((g) => g.assist_x != null && g.assist_y != null)
    .map((g) => ({ x: +g.assist_x, y: +g.assist_y }));
  const S = 8;
  const W = PITCH_L * S;
  const H = PITCH_W * S;
  const line = `stroke="#3f7d47" stroke-width="1.5" fill="none" opacity="0.7"`;
  let p = `<svg viewBox="0 0 ${W} ${H}" class="pitch" xmlns="http://www.w3.org/2000/svg">`;
  p += `<defs><filter id="heatblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="11"/></filter></defs>`;
  p += `<rect x="0" y="0" width="${W}" height="${H}" fill="#0e1f0d"/>`;

  if (pts.length) {
    // bin into a grid and color by density
    const NX = 14,
      NY = 9;
    const bins = Array.from({ length: NX * NY }, () => 0);
    for (const pt of pts) {
      const ix = Math.min(NX - 1, Math.max(0, Math.floor((pt.x / PITCH_L) * NX)));
      const iy = Math.min(NY - 1, Math.max(0, Math.floor((pt.y / PITCH_W) * NY)));
      bins[iy * NX + ix]++;
    }
    const max = Math.max(...bins);
    const cw = W / NX,
      ch = H / NY;
    p += `<g filter="url(#heatblur)">`;
    for (let iy = 0; iy < NY; iy++) {
      for (let ix = 0; ix < NX; ix++) {
        const n = bins[iy * NX + ix];
        if (!n) continue;
        const t = n / max;
        p += `<rect x="${ix * cw}" y="${iy * ch}" width="${cw}" height="${ch}" fill="${heatColor(t)}" opacity="${0.25 + 0.65 * t}"/>`;
      }
    }
    p += `</g>`;
  }

  // pitch lines on top
  p += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" ${line}/>`;
  p += `<line x1="${W / 2}" y1="2" x2="${W / 2}" y2="${H - 2}" ${line}/>`;
  p += `<circle cx="${W / 2}" cy="${H / 2}" r="${9.15 * S}" ${line}/>`;
  for (const left of [true, false]) {
    const pbW = 16.5 * S,
      pbH = 40.32 * S;
    const px = left ? 2 : W - 2 - pbW;
    p += `<rect x="${px}" y="${(H - pbH) / 2}" width="${pbW}" height="${pbH}" ${line}/>`;
  }
  // assist points
  for (const pt of pts) {
    p += `<circle cx="${(pt.x / PITCH_L) * W}" cy="${(pt.y / PITCH_W) * H}" r="3" fill="#fff" opacity="0.55"/>`;
  }
  p += `</svg>`;
  return p;
}

function renderHeatMap(goals) {
  const wrap = document.getElementById("heatWrap");
  const withAssist = goals.filter((g) => g.assist_x != null && g.assist_y != null);
  if (!withAssist.length) {
    wrap.innerHTML = emptyMsg("No assist locations yet — the heat map fills in as taggers upload.");
    return;
  }
  wrap.innerHTML = heatMapSvg(goals);
}

// ── Renders ───────────────────────────────────────────────────────────
function renderStats(goals) {
  const scorers = new Set(goals.map((g) => g.scorer).filter(Boolean));
  const teams = new Set(goals.map((g) => g.scoring_team).filter(Boolean));
  const assists = goals.filter((g) => g.assist_by).length;
  setText("sGoals", goals.length);
  setText("sTeams", teams.size);
  setText("sPlayers", scorers.size);
  setText("sAssists", assists);
}

function renderShotMap(goals) {
  const wrap = document.getElementById("pitchWrap");
  if (!goals.length) {
    wrap.innerHTML = emptyMsg("No goals tagged yet — the shot map fills in as taggers upload.");
    return;
  }
  wrap.innerHTML = pitchSvg(goals);
}

function renderGoals(goals) {
  const el = document.getElementById("goalsList");
  if (!goals.length) {
    el.innerHTML = emptyMsg("No goals to show yet.");
    return;
  }
  el.innerHTML = goals
    .slice()
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))
    .map((g) => {
      const idx = RENDERED.indexOf(g);
      const playable = !!g.video_id;
      const chain = [
        g.pre_assist_by && `<span class="seg pa">PA ${esc(g.pre_assist_by)}</span>`,
        g.assist_by && `<span class="seg a">A ${esc(g.assist_by)}</span>`,
        `<span class="seg g">⚽ ${esc(g.scorer || "—")}</span>`,
      ]
        .filter(Boolean)
        .join('<span class="arr">→</span>');
      return `<article class="goal-card${playable ? " playable" : ""}" data-idx="${idx}">
        <div class="gc-top">
          <span class="team-pill">${esc(g.scoring_team || "")}</span>
          <span class="gc-match">${esc(g.home_team || "")} v ${esc(g.away_team || "")}</span>
          ${g.minute != null ? `<span class="gc-min">${g.minute}'</span>` : ""}
          ${g.goal_body_part ? `<span class="gc-bp">${esc(g.goal_body_part.replace("_", " "))}</span>` : ""}
          ${playable ? `<span class="gc-play">▶ watch</span>` : ""}
        </div>
        <div class="gc-chain">${chain}</div>
      </article>`;
    })
    .join("");
}

// ── Goal timing histogram (5-minute windows) ──────────────────────────
function renderTiming(goals) {
  const el = document.getElementById("timingChart");
  const withMin = goals.filter((g) => g.minute != null);
  if (!withMin.length) {
    el.style.display = "block"; // don't squish the message into one grid column
    el.innerHTML = emptyMsg("No timing data yet.");
    return;
  }
  el.style.display = "grid";
  // buckets: 0-5, 5-10 … 85-90, 90+
  const buckets = Array.from({ length: 19 }, () => 0);
  for (const g of withMin) {
    const b = Math.min(18, Math.floor(g.minute / 5));
    buckets[b]++;
  }
  const max = Math.max(...buckets, 1);
  el.innerHTML = buckets
    .map((n, i) => {
      const label = i === 18 ? "90+" : `${i * 5}`;
      return `<div class="tcol" title="${label}': ${n} goal${n === 1 ? "" : "s"}">
        <span class="tcount">${n || ""}</span>
        <span class="tbar" style="height:${(n / max) * 100}%"></span>
        <span class="tlabel">${label}</span>
      </div>`;
    })
    .join("");
}

function tally(goals, key) {
  const m = new Map();
  for (const g of goals) {
    const v = g[key];
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBars(id, rows, fmt = (k) => k) {
  const el = document.getElementById(id);
  if (!rows.length) {
    el.innerHTML = emptyMsg("—");
    return;
  }
  const max = rows[0][1];
  el.innerHTML = rows
    .slice(0, 8)
    .map(
      ([k, n]) => `<div class="bar">
        <span class="bar-label">${esc(fmt(k))}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(n / max) * 100}%"></span></span>
        <span class="bar-val">${n}</span>
      </div>`,
    )
    .join("");
}

function renderLeaders(goals) {
  renderBars("scorers", tally(goals, "scorer"));
  renderBars("assisters", tally(goals, "assist_by"));
  renderBars("bodyparts", tally(goals, "goal_body_part"), (k) => k.replace("_", " "));
}

function renderAll(goals) {
  RENDERED = goals;
  renderStats(goals);
  renderShotMap(goals);
  renderHeatMap(goals);
  renderTiming(goals);
  renderGoals(goals);
  renderLeaders(goals);
  const fc = document.getElementById("filterCount");
  fc.textContent = `${goals.length} goal${goals.length === 1 ? "" : "s"}`;
}

// ── Goal video modal ──────────────────────────────────────────────────
function openGoalVideo(g) {
  if (!g) return;
  const modal = document.getElementById("videoModal");
  const title = document.getElementById("modalTitle");
  const video = document.getElementById("modalVideo");
  const meta = document.getElementById("modalMeta");

  title.textContent =
    `${g.scorer || "Goal"}${g.scoring_team ? " · " + (TEAM_NAMES[g.scoring_team] || g.scoring_team) : ""}` +
    `${g.minute != null ? " · " + g.minute + "'" : ""}`;
  meta.textContent =
    `${g.home_team || ""} v ${g.away_team || ""}` +
    `${g.assist_by ? " · assist " + g.assist_by : ""}` +
    `${g.goal_body_part ? " · " + g.goal_body_part.replace("_", " ") : ""}`;

  if (g.video_id) {
    const start = Math.max(0, Math.floor(g.goal_video_time || 0));
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(g.video_id)}&t=${start}s`;
    video.innerHTML =
      `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(
        g.video_id,
      )}?start=${start}&autoplay=1&rel=0" title="Goal highlight" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    // Fallback link — some clips (e.g. FIFA official) block embedding.
    meta.innerHTML +=
      ` · <a class="yt-link" href="${watchUrl}" target="_blank" rel="noopener">Watch on YouTube ↗</a>`;
  } else {
    video.innerHTML = emptyMsg("No video linked for this goal.");
  }
  // pause the anthem so it doesn't clash with the clip
  if (typeof anthem !== "undefined") anthem.pause();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeGoalVideo() {
  const modal = document.getElementById("videoModal");
  document.getElementById("modalVideo").innerHTML = ""; // stops playback
  modal.hidden = true;
  document.body.style.overflow = "";
}

// click delegation: pitch dots + feed cards
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) return closeGoalVideo();
  const dot = e.target.closest(".goal-dot");
  const card = e.target.closest(".goal-card");
  const node = dot || card;
  if (node && node.dataset.idx != null) openGoalVideo(RENDERED[+node.dataset.idx]);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeGoalVideo();
});

// ── Filtering ─────────────────────────────────────────────────────────
function applyFilter() {
  const code = document.getElementById("teamFilter").value;
  renderAll(code ? ALL_GOALS.filter((g) => g.scoring_team === code) : ALL_GOALS);
}

function buildTeamFilter(goals) {
  const sel = document.getElementById("teamFilter");
  const codes = [...new Set(goals.map((g) => g.scoring_team).filter(Boolean))].sort();
  for (const c of codes) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = TEAM_NAMES[c] || c;
    sel.appendChild(o);
  }
  sel.addEventListener("change", applyFilter);
}

// ── Helpers ───────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function setText(id, v) {
  document.getElementById(id).textContent = v;
}
function emptyMsg(t) {
  return `<div class="empty">${esc(t)}</div>`;
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  try {
    const [teams, goals] = await Promise.all([
      sbGet("teams?select=code,name").catch(() => []),
      sbGet("goals_flat?select=*"),
    ]);
    TEAM_NAMES = Object.fromEntries(teams.map((t) => [t.code, t.name]));
    ALL_GOALS = goals;
    buildTeamFilter(goals);
    renderAll(goals);
  } catch (err) {
    console.error("Dashboard load failed:", err);
    document.getElementById("pitchWrap").innerHTML = emptyMsg(
      "Couldn't load data from Supabase. Check the connection.",
    );
  }
}
// expose for manual testing
window.__renderAll = renderAll;
init();

// ── Solid nav once scrolled past the hero (avoids logo over headings) ──
const navEl = document.querySelector(".nav");
const onScroll = () => navEl.classList.toggle("scrolled", window.scrollY > 80);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ── Background video — force play for Safari (blocks autoplay attr alone) ─
const bgVideo = document.getElementById("bgvideo");
if (bgVideo) {
  bgVideo.defaultMuted = true;
  bgVideo.muted = true;
  // Attempt immediately (works in Chrome/FF with muted+autoplay)
  bgVideo.play().catch(() => {});
  // Safari needs a user-gesture; retry on first touch/click
  function tryBg() {
    bgVideo.play().catch(() => {});
    window.removeEventListener("pointerdown", tryBg);
  }
  window.addEventListener("pointerdown", tryBg, { passive: true });
  // Resume if tab becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) bgVideo.play().catch(() => {});
  });
}

// ── Hero anthem + reveal ──────────────────────────────────────────────
const anthem = document.getElementById("anthem");
const soundBtn = document.getElementById("sound");
const soundLabel = soundBtn.querySelector(".sound-label");
anthem.volume = 0.55;
let playing = false;
function setPlaying(on) {
  playing = on;
  soundBtn.classList.toggle("playing", on);
  soundLabel.textContent = on ? "Anthem on" : "Play anthem";
}
soundBtn.addEventListener("click", () => {
  if (playing) {
    anthem.pause();
    setPlaying(false);
  } else anthem.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
});
function autoStart() {
  if (!playing) anthem.play().then(() => setPlaying(true)).catch(() => {});
  window.removeEventListener("pointerdown", autoStart);
}
window.addEventListener("pointerdown", autoStart);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) anthem.pause();
  else if (playing) anthem.play().catch(() => {});
});
