/** Indian-locale formatting helpers shared by every screen and the printed report. */

export const nf = new Intl.NumberFormat('en-IN');

export function num(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Rupees in Indian scale: crore above 1e7, lakh above 1e5. */
export function inr(value, { compact = true } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (!compact) return `₹${num(Math.round(value))}`;
  if (abs >= 1e7) return `${sign}₹${num(abs / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${num(abs / 1e5, 2)} L`;
  if (abs >= 1e3) return `${sign}₹${num(abs / 1e3, 1)} K`;
  return `${sign}₹${num(abs)}`;
}

export function lakh(value) {
  if (value == null) return '—';
  if (value >= 100) return `₹${num(value / 100, 2)} Cr`;
  return `₹${num(value, 1)} L`;
}

/** Signed percentage, e.g. "-22.3%". */
export function pct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  const s = value > 0 ? '+' : '';
  return `${s}${num(value, digits)}%`;
}

export function compact(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${num(value / 1e7, 1)}Cr`;
  if (abs >= 1e5) return `${num(value / 1e5, 1)}L`;
  if (abs >= 1e3) return `${num(value / 1e3, 1)}k`;
  return num(value);
}

export function hourLabel(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minutesLabel(mins) {
  if (mins == null) return '—';
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  return `${num(mins, 1)} min`;
}

export function dateLabel(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dayLabel(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
