import { cx } from './ui.jsx';

/** Consistent page title block: step chip, title, subtitle and right-aligned controls. */
export default function PageHeader({ step, title, subtitle, actions, className }) {
  return (
    <div className={cx('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {step != null && (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-400">
            Step {step}
          </p>
        )}
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
