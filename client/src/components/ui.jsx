import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react';
import { STATUS, LOS_COLOR, AUTHORITY_COLOR, vcColor } from '../lib/theme.js';
import { num, pct } from '../lib/format.js';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ panels */

export function Panel({ className, children, ...rest }) {
  return (
    <section className={cx('panel', className)} {...rest}>
      {children}
    </section>
  );
}

/**
 * Panel header. Title in sentence case at body weight — an icon and an uppercase
 * caption on every single container is what makes a dashboard read as generated.
 * The caption sits inline, dimmed, as an aside.
 */
export function PanelHead({ title, subtitle, actions, className }) {
  return (
    <header className={cx('panel-head', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold text-bone-100">{title}</h2>
        {subtitle && <p className="mt-1 truncate text-2xs text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Section divider with a label — used to break long pages without adding boxes. */
export function SectionLabel({ children, className, actions }) {
  return (
    <div className={cx('flex items-center gap-4', className)}>
      <span className="label shrink-0">{children}</span>
      <span className="h-px flex-1 bg-white/[0.07]" />
      {actions}
    </div>
  );
}

/* ------------------------------------------------------------------- stats */

/**
 * Compact metric. Sits in a ruled strip rather than its own card — a row of
 * identically-weighted cards flattens hierarchy and is the most recognisable
 * template layout there is.
 */
export function Metric({ label, value, unit, delta, goodWhenNegative, hint, accent, className }) {
  return (
    <div className={cx('min-w-0 px-5 py-4', className)}>
      <p className="label truncate">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className="tnum truncate text-[26px] font-medium leading-none text-bone-50"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {unit && <span className="shrink-0 text-2xs text-ink-500">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta != null && <DeltaPill value={delta} goodWhenNegative={goodWhenNegative} />}
        {hint && <span className="truncate text-2xs text-ink-500">{hint}</span>}
      </div>
    </div>
  );
}

/** A row of Metrics separated by hairlines instead of gaps between cards. */
export function MetricStrip({ children, className }) {
  return (
    <div
      className={cx(
        'panel grid divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-y-0',
        'lg:grid-cols-3 xl:grid-cols-5 [&>*]:border-white/[0.07]',
        'sm:[&>*:not(:first-child)]:border-l',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DeltaPill({ value, goodWhenNegative = false, suffix = '%', className }) {
  if (value == null || Number.isNaN(value)) return null;
  const flat = Math.abs(value) < 0.05;
  const good = goodWhenNegative ? value < 0 : value > 0;
  const tone = flat ? 'text-ink-500' : good ? 'text-flow-free' : 'text-flow-severe';
  return (
    <span className={cx('tnum text-2xs font-medium', tone, className)}>
      {flat ? '±0' : `${value > 0 ? '↑' : '↓'}${num(Math.abs(value), 1)}`}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ badges */

export function StatusBadge({ status, className }) {
  const s = STATUS[status] || STATUS.free;
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-2xs text-bone-300', className)}>
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export function LosBadge({ los, className }) {
  return (
    <span
      className={cx('tnum inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold', className)}
      style={{ background: `${LOS_COLOR[los]}1f`, color: LOS_COLOR[los] }}
      title={`Level of Service ${los}`}
    >
      {los}
    </span>
  );
}

export function AuthorityTag({ code, className, title }) {
  if (!code) return null;
  const color = AUTHORITY_COLOR[code] || '#7d766b';
  return (
    <span
      className={cx('inline-flex items-center gap-1 text-2xs font-medium', className)}
      title={title || code}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-[1px]" style={{ background: color }} />
      <span style={{ color }}>{code}</span>
    </span>
  );
}

/* --------------------------------------------------------------- controls */

export function Segmented({ options, value, onChange, className, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-2xs' : 'px-3 py-1.5 text-xs';
  return (
    <div
      className={cx('inline-flex rounded-md bg-ink-850 p-0.5', className)}
      style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              'rounded-[5px] font-medium transition-colors',
              pad,
              active ? 'bg-bone-100 text-ink-950' : 'text-ink-500 hover:text-bone-200'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 0.1, max = 1, step = 0.05, format }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="tnum text-xs font-medium text-bone-100">
          {format ? format(value) : `${Math.round(value * 100)}%`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
      />
    </label>
  );
}

export function Checkbox({ checked, className }) {
  return (
    <span
      className={cx(
        'grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] transition-colors',
        checked ? 'bg-bone-100' : 'bg-white/[0.06]',
        className
      )}
      style={checked ? undefined : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
    >
      {checked && <Check className="h-2.5 w-2.5 text-ink-950" strokeWidth={3.5} />}
    </span>
  );
}

/* ------------------------------------------------------------ status views */

export function Spinner({ className }) {
  return <Loader2 className={cx('h-3.5 w-3.5 animate-spin', className)} />;
}

export function Loading({ label = 'Loading', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-2.5 py-16 text-xs text-ink-500', className)}>
      <Spinner />
      {label}…
    </div>
  );
}

export function EmptyState({ title, description, action, className }) {
  return (
    <div className={cx('px-6 py-16 text-center', className)}>
      <p className="text-sm font-medium text-bone-200">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, className }) {
  if (!children) return null;
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-md bg-flow-severe/[0.09] px-3.5 py-3 text-xs text-flow-severe',
        className
      )}
      role="alert"
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ toasts */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4400);
  }, []);

  const value = useMemo(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push]
  );

  const ACCENT = { success: '#4ade80', error: '#f87171', info: '#c9c3b9' };
  const ICON = { success: Check, error: AlertTriangle, info: Info };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[1200] flex w-[min(21rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-riseIn items-start gap-2.5 rounded-md bg-ink-800 px-3.5 py-3 text-xs text-bone-100 shadow-lift"
              role="status"
            >
              <Icon className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.25} style={{ color: ACCENT[t.kind] }} />
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                className="shrink-0 text-ink-500 transition-colors hover:text-bone-200"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* ------------------------------------------------------------------- misc */

/**
 * Saturation meter. The track carries a tick at v/c = 1.0 so "over capacity" is
 * visible as a position, not only as a colour change.
 */
export function VcMeter({ vc, className, showValue = true }) {
  const width = Math.min(100, (vc / 1.3) * 100);
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <div className="relative h-[3px] w-full rounded-full bg-white/[0.07]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{ width: `${width}%`, background: vcColor(vc) }}
        />
        <span className="absolute -top-0.5 bottom-[-2px] w-px bg-white/25" style={{ left: `${(1 / 1.3) * 100}%` }} />
      </div>
      {showValue && (
        <span className="tnum w-9 shrink-0 text-right text-2xs text-bone-400">{num(vc, 2)}</span>
      )}
    </div>
  );
}

export function LiveDot({ className }) {
  return (
    <span className={cx('relative flex h-1.5 w-1.5', className)}>
      <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-flow-free" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flow-free" />
    </span>
  );
}

/** Thin inline bar for comparing a value against a row maximum, used in tables. */
export function Bar({ value, max, color, className }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx('h-[3px] w-full rounded-full bg-white/[0.06]', className)}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color || '#7d766b' }} />
    </div>
  );
}

export { pct };
