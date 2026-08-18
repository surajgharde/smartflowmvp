import { useMemo } from 'react';
import { vcColor } from '../lib/theme.js';
import { num } from '../lib/format.js';
import { cx } from './ui.jsx';

/**
 * A stylised corridor lane with vehicles moving at a speed proportional to the
 * simulated average speed, and packed at a density proportional to saturation.
 *
 * Shown as a baseline/treatment pair so the difference an intervention makes is
 * legible at a glance rather than only as a number in a table.
 */
export default function FlowLane({ result, label, sublabel, animate = true, className }) {
  const { color, cars, duration } = useMemo(() => {
    const vc = result?.vc ?? 0;
    const speed = Math.max(4, result?.avgSpeed ?? 20);
    return {
      color: vcColor(vc),
      cars: Math.max(4, Math.min(14, Math.round(vc * 11))),
      // A 70 km/h lane clears in ~1.6s; an 8 km/h crawl takes ~14s.
      duration: Math.max(1.6, 110 / speed),
    };
  }, [result]);

  if (!result) return null;

  return (
    <div className={cx('rounded-md bg-ink-850 p-3', className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="label truncate">{label}</p>
        <p className="tnum shrink-0 text-xs font-medium" style={{ color }}>
          {num(result.avgSpeed, 1)} km/h
        </p>
      </div>

      <div className="relative h-6 overflow-hidden rounded-sm bg-ink-950">
        {/* lane centreline */}
        <div
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(226,222,215,0.5) 0 8px, transparent 8px 20px)',
          }}
        />
        {Array.from({ length: cars }).map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-1.5 w-3.5 -translate-y-1/2 rounded-[1px]"
            style={{
              background: color,
              left: '-16px',
              animation: animate ? `laneDrive ${duration}s linear infinite` : 'none',
              animationDelay: `${-(duration / cars) * i}s`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div className="tnum mt-2 flex items-center justify-between text-[10px] text-ink-600">
        <span>v/c {num(result.vc, 2)}</span>
        <span>LOS {result.los}</span>
        <span>{sublabel}</span>
      </div>

      {/* `left` percentages resolve against the lane, so one keyframe set fits any width. */}
      <style>{`
        @keyframes laneDrive {
          from { left: -16px; }
          to   { left: 100%; }
        }
      `}</style>
    </div>
  );
}
