import { useRef } from "react";
import { EVENT_META, PITCH_LENGTH, PITCH_WIDTH, TaggedEvent } from "../lib/types";

const SCALE = 7; // px per meter → 735 x 476 viewBox

interface Props {
  events: TaggedEvent[];
  onPick: (x: number, y: number) => void;
  highlightSequenceId: string | null;
}

/** Standardized 105m x 68m pitch. Clicks return meters in [0,105]x[0,68]. */
export function Pitch({ events, onPick, highlightSequenceId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = PITCH_LENGTH * SCALE;
  const H = PITCH_WIDTH * SCALE;

  const line = { stroke: "#9fd6a8", strokeWidth: 1.5, fill: "none", opacity: 0.7 };
  // Goal dimensions (FIFA standard): 7.32m wide, 2.44m high
  const goalW = 7.32 * SCALE;
  const goalH = 2.44 * SCALE;
  const goalPost = { stroke: "#ffffff", strokeWidth: 4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();

    // The viewBox is expanded to show goal posts:
    //   origin = (-goalH - 2, -2), total size = (W + 2*(goalH+2)) x (H+4)
    // We must map pixel → viewBox coords first, then subtract the viewBox offset
    // so that only clicks on the actual 105×68 m pitch area return valid coords.
    const vbW = W + 2 * (goalH + 2);
    const vbH = H + 4;
    const vbOriginX = -(goalH + 2);
    const vbOriginY = -2;

    const svgX = ((e.clientX - r.left) / r.width)  * vbW + vbOriginX;
    const svgY = ((e.clientY - r.top)  / r.height) * vbH + vbOriginY;

    const x = Math.min(PITCH_LENGTH, Math.max(0, svgX / SCALE));
    const y = Math.min(PITCH_WIDTH,  Math.max(0, svgY / SCALE));
    onPick(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };


  return (
    <svg
      ref={svgRef}
      className="pitch-svg"
      viewBox={`${-goalH - 2} -2 ${W + 2 * (goalH + 2)} ${H + 4}`}
      onClick={handleClick}
      role="img"
      aria-label="Football pitch, 105 by 68 meters"
    >
      {/* turf stripes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={i}
          x={(i * W) / 10}
          y={0}
          width={W / 10}
          height={H}
          fill={i % 2 ? "#163a1c" : "#15321a"}
        />
      ))}
      {/* outline */}
      <rect x={2} y={2} width={W - 4} height={H - 4} {...line} />
      {/* halfway */}
      <line x1={W / 2} y1={2} x2={W / 2} y2={H - 2} {...line} />
      <circle cx={W / 2} cy={H / 2} r={9.15 * SCALE} {...line} />
      <circle cx={W / 2} cy={H / 2} r={2} fill="#9fd6a8" opacity={0.7} />
      {/* penalty + 6-yard boxes, both ends */}
      {[0, 1].map((side) => {
        const left = side === 0;
        const pbW = 16.5 * SCALE;
        const pbH = 40.32 * SCALE;
        const gbW = 5.5 * SCALE;
        const gbH = 18.32 * SCALE;
        const px = left ? 2 : W - 2 - pbW;
        const gx = left ? 2 : W - 2 - gbW;
        const spotX = left ? 11 * SCALE : W - 11 * SCALE;
        return (
          <g key={side}>
            <rect x={px} y={(H - pbH) / 2} width={pbW} height={pbH} {...line} />
            <rect x={gx} y={(H - gbH) / 2} width={gbW} height={gbH} {...line} />
            <circle cx={spotX} cy={H / 2} r={2} fill="#9fd6a8" opacity={0.7} />
          </g>
        );
      })}

      {/* Goal posts — left end */}
      <g opacity={0.95}>
        {/* back post line (goal line) — net width */}
        <line
          x1={0}
          y1={(H - goalW) / 2}
          x2={0}
          y2={(H + goalW) / 2}
          {...goalPost}
        />
        {/* left post (top bar from goal line into pitch) */}
        <line
          x1={0}
          y1={(H - goalW) / 2}
          x2={-goalH}
          y2={(H - goalW) / 2}
          {...goalPost}
        />
        {/* right post */}
        <line
          x1={0}
          y1={(H + goalW) / 2}
          x2={-goalH}
          y2={(H + goalW) / 2}
          {...goalPost}
        />
        {/* crossbar */}
        <line
          x1={-goalH}
          y1={(H - goalW) / 2}
          x2={-goalH}
          y2={(H + goalW) / 2}
          {...goalPost}
        />
      </g>

      {/* Goal posts — right end */}
      <g opacity={0.95}>
        <line
          x1={W}
          y1={(H - goalW) / 2}
          x2={W}
          y2={(H + goalW) / 2}
          {...goalPost}
        />
        <line
          x1={W}
          y1={(H - goalW) / 2}
          x2={W + goalH}
          y2={(H - goalW) / 2}
          {...goalPost}
        />
        <line
          x1={W}
          y1={(H + goalW) / 2}
          x2={W + goalH}
          y2={(H + goalW) / 2}
          {...goalPost}
        />
        <line
          x1={W + goalH}
          y1={(H - goalW) / 2}
          x2={W + goalH}
          y2={(H + goalW) / 2}
          {...goalPost}
        />
      </g>

      {/* plotted events */}
      {events.map((ev) => {
        const cx = (ev.x / PITCH_LENGTH) * W;
        const cy = (ev.y / PITCH_WIDTH) * H;
        const color = EVENT_META[ev.type].color;
        const active = ev.sequenceId === highlightSequenceId;
        const dim = highlightSequenceId && !active ? 0.28 : 1;
        const hasEnd = ev.endX != null && ev.endY != null;
        const ex = hasEnd ? (ev.endX! / PITCH_LENGTH) * W : 0;
        const ey = hasEnd ? (ev.endY! / PITCH_WIDTH) * H : 0;
        return (
          <g key={ev.id} opacity={dim}>
            {hasEnd && (
              <>
                {/* shot trajectory: start → end */}
                <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={color} strokeWidth={2} strokeDasharray="4 3" />
                <circle cx={ex} cy={ey} r={active ? 6 : 5} fill="none" stroke={color} strokeWidth={2} />
              </>
            )}
            <circle cx={cx} cy={cy} r={active ? 8 : 6} fill={color} stroke="#0c0f0a" strokeWidth={1.5} />
            <text
              x={cx}
              y={cy + 3}
              textAnchor="middle"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              fill="#0c0f0a"
              fontWeight={700}
            >
              {EVENT_META[ev.type].short}
            </text>
          </g>
        );
      })}

      {/* attack direction hint */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#9fd6a8" opacity={0.5}>
        attacking direction →
      </text>
    </svg>
  );
}
