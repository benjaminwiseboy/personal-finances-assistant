"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/money";

export type ChartPoint = { label: string; sublabel: string; value: number };

const W = 1000;
const H = 220;

/**
 * Net-worth-over-time area chart. One series (brand ember), recessive axes, a
 * crosshair + tooltip on hover. Hand-built SVG so it reads as part of the app
 * rather than a charting-library default; the line uses a non-scaling stroke
 * so it stays crisp while the area stretches to the container width.
 */
export function NetWorthChart({ data }: { data: ChartPoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    // Flat series: give it a little vertical room so the line sits centered.
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  } else {
    const pad = (hi - lo) * 0.18;
    lo -= pad;
    hi += pad;
  }

  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  const pctX = (i: number) => (i / (data.length - 1)) * 100;
  const pctY = (v: number) => ((hi - v) / (hi - lo)) * 100;

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(Math.round(rel * (data.length - 1)), data.length - 1)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={H}
          className="block"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--ember)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>

        {/* Interaction + crosshair overlay */}
        <div
          className="absolute inset-0 touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Évolution du patrimoine : ${data
            .map((d) => `${d.sublabel} ${formatMoney(d.value)}`)
            .join(", ")}`}
        >
          {hover !== null && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/20"
                style={{ left: `${pctX(hover)}%` }}
              />
              <div
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember ring-2 ring-card"
                style={{
                  left: `${pctX(hover)}%`,
                  top: `${pctY(data[hover].value)}%`,
                }}
              />
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-popover px-2.5 py-1.5 ring-1 ring-white/12 whitespace-nowrap"
                style={{
                  left: `clamp(3rem, ${pctX(hover)}%, calc(100% - 3rem))`,
                  top: `${pctY(data[hover].value)}%`,
                }}
              >
                <div className="font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase">
                  {data[hover].sublabel}
                </div>
                <div
                  data-slot="figure"
                  className="font-display text-sm font-semibold"
                >
                  {formatMoney(data[hover].value)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sparse month axis */}
      <div className="flex justify-between font-mono text-[0.5625rem] tracking-wide text-muted-foreground uppercase">
        {data.map((d, i) => (
          <span key={i} className={i % 2 === 0 || i === data.length - 1 ? "" : "opacity-0"}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
