import { cx } from './ui.jsx';

/**
 * Page title block. The step number sits beside the title as a quiet numeral
 * rather than above it as a coloured pill — it's wayfinding, not a headline.
 */
export default function PageHeader({ step, title, subtitle, actions, className }) {
  return (
    <div className={cx('flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between', className)}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          {step != null && <span className="tnum text-xs text-ink-600">{String(step).padStart(2, '0')}</span>}
          <h1 className="text-[22px] font-semibold leading-tight text-bone-50">{title}</h1>
        </div>
        {subtitle && (
          <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-ink-500 lg:pl-8">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
