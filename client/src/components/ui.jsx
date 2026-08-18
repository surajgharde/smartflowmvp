import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { STATUS, LOS_COLOR, AUTHORITY_COLOR } from '../lib/theme.js';
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

export function PanelHead({ title, subtitle, icon: Icon, actions, className }) {
  return (
    <header className={cx('panel-head', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-brand-400" strokeWidth={2} />}
        <div className="min-w-0">
          <h2 className="panel-title truncate">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------- stats */

/**
 * Headline metric. `delta` is a signed percentage; `goodWhenNegative` flips the
 * colour so "delay down 22%" reads as good and "delay up 22%" reads as bad.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  goodWhenNegative = false,
  icon: Icon,
  hint,
  tone = 'default',
  className,
}) {
  const toneRing = {
    default: 'border-white/[0.07]',
    brand: 'border-brand-500/30 bg-brand-500/[0.04]',
    warn: 'border-amber-500/25 bg-amber-500/[0.04]',
    danger: 'border-rose-500/25 bg-rose-500/[0.04]',
    good: 'border-emerald-500/25 bg-emerald-500/[0.04]',
  }[tone];

  return (
    <div className={cx('rounded-xl border bg-ink-900/70 p-4 shadow-panel', toneRing, className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tnum text-2xl font-semibold tracking-tight text-white">{value}</span>
        {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {delta != null && <DeltaPill value={delta} goodWhenNegative={goodWhenNegative} />}
        {hint && <span className="truncate text-[11px] text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

export function DeltaPill({ value, goodWhenNegative = false, suffix = '%', className }) {
  if (value == null || Number.isNaN(value)) return null;
  const neutral = Math.abs(value) < 0.05;
  const good = goodWhenNegative ? value < 0 : value > 0;
  const tone = neutral
    ? 'bg-white/[0.06] text-slate-400'
    : good
      ? 'bg-emerald-500/12 text-emerald-300'
      : 'bg-rose-500/12 text-rose-300';
  return (
    <span className={cx('chip tnum', tone, className)}>
      {neutral ? '±0' : `${value > 0 ? '+' : ''}${num(value, 1)}`}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ badges */

export function StatusBadge({ status, className }) {
  const s = STATUS[status] || STATUS.free;
  return (
    <span className={cx('chip', s.bg, s.text, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export function LosBadge({ los, className }) {
  return (
    <span
      className={cx('chip tnum', className)}
      style={{ background: `${LOS_COLOR[los]}1f`, color: LOS_COLOR[los] }}
      title={`Level of Service ${los}`}
    >
      LOS {los}
    </span>
  );
}

export function AuthorityTag({ code, className, title }) {
  const color = AUTHORITY_COLOR[code] || '#94a3b8';
  return (
    <span
      className={cx('chip', className)}
      style={{ background: `${color}1a`, color }}
      title={title || code}
    >
      {code}
    </span>
  );
}

/* --------------------------------------------------------------- controls */

export function Segmented({ options, value, onChange, className, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';
  return (
    <div className={cx('inline-flex rounded-lg border border-white/10 bg-ink-950/60 p-0.5', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              'rounded-md font-medium transition-colors',
              pad,
              active ? 'bg-brand-500 text-ink-950' : 'text-slate-400 hover:text-slate-200'
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
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className="tnum text-xs font-semibold text-brand-300">
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-brand-400 [&::-webkit-slider-thumb]:shadow-glow
          [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand-400"
      />
    </label>
  );
}

/* ------------------------------------------------------------ status views */

export function Spinner({ className }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin', className)} />;
}

export function Loading({ label = 'Loading', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-2.5 py-14 text-sm text-slate-500', className)}>
      <Spinner className="text-brand-400" />
      {label}…
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
          <Icon className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
        </div>
      )}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, className }) {
  if (!children) return null;
  return (
    <div
      className={cx(
        'flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200',
        className
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>{children}</span>
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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push]
  );

  const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const TONE = {
    success: 'border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-100',
    error: 'border-rose-500/30 bg-rose-500/[0.12] text-rose-100',
    info: 'border-brand-500/30 bg-brand-500/[0.12] text-brand-50',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[1200] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              className={cx(
                'pointer-events-auto flex animate-riseIn items-start gap-2.5 rounded-lg border px-3.5 py-3 text-xs backdrop-blur-md shadow-panel',
                TONE[t.kind]
              )}
              role="status"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
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

/** Horizontal saturation meter used in corridor tables. */
export function VcMeter({ vc, className }) {
  const width = Math.min(100, (vc / 1.3) * 100);
  const color = vc >= 1 ? STATUS.severe.color : vc >= 0.85 ? STATUS.heavy.color : vc >= 0.7 ? STATUS.moderate.color : STATUS.free.color;
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="tnum w-10 shrink-0 text-right text-[11px] text-slate-400">{num(vc, 2)}</span>
    </div>
  );
}

/** Live pulse dot for the monitoring header. */
export function LiveDot({ className }) {
  return (
    <span className={cx('relative flex h-2 w-2', className)}>
      <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-emerald-400" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

export { pct };
