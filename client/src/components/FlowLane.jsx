import { useMemo } from 'react';
import { vcColor } from '../lib/theme.js';
import { num } from '../lib/format.js';
import { cx } from './ui.jsx';

/**
 * A stylised corridor lane with vehicles moving at a speed proportional to the
 * simulated average speed. Used side by side (baseline vs strategy) so the
 * difference an intervention makes is legible at a glance rather than only as a
 * number in a table.
 *
 * Density of vehicles tracks the volume/capacity ratio; travel time across the
 * lane tracks the modelled speed.
 */
export default function FlowLane({ result, label, sublabel, animate = true, className }) {
  const { color, cars, duration } = useMemo(() => {
    const vc = result?.vc ?? 0;
    const speed = Math.max(4, result?.avgSpeed ?? 20);
    return {
      color: vcColor(vc),
      // 4 vehicles at free flow up to 13 when the lane is jammed.
      cars: Math.max(4, Math.min(13, Math.round(vc * 10))),
      // A 70 km/h lane crosses in ~1.6s, an 8 km/h crawl takes ~14s.
      duration: Math.max(1.6, 110 / speed),
    };
  }, [result]);

  if (!result) return null;

  return (
    <div className={cx('rounded-lg border border-white/[0.06] bg-ink-950/50 p-3', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="tnum shrink-0 text-xs font-bold" style={{ color }}>
          {num(result.avgSpeed, 1)} km/h
        </p>
      </div>

      <div className="relative h-7 overflow-hidden rounded-md border border-white/[0.06] bg-ink-950">
        {/* lane markings */}
        <div
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-30"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.6) 0 10px, transparent 10px 22px)',
          }}
        />
        {Array.from({ length: cars }).map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-2 w-4 -translate-y-1/2 rounded-[2px]"
            style={{
              background: color,
              boxShadow: `0 0 8px -1px ${color}`,
              left: '-18px',
              animation: animate ? `laneDrive ${duration}s linear infinite` : 'none',
              animationDelay: `${-(duration / cars) * i}s`,
              opacity: 0.9,
            }}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span className="tnum">v/c {num(result.vc, 2)}</span>
        <span className="tnum">LOS {result.los}</span>
        <span className="tnum">{sublabel}</span>
      </div>

      {/* `left` percentages resolve against the lane, so one keyframe set works at any width. */}
      <style>{`
        @keyframes laneDrive {
          from { left: -18px; }
          to   { left: 100%; }
        }
      `}</style>
    </div>
  );
}
