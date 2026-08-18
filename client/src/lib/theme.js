/**
 * One source of truth for congestion semantics. The map, the charts, the badges
 * and the printed report all colour from this table, so a corridor that is orange
 * on the map is orange everywhere else too.
 */

export const STATUS = {
  free: {
    key: 'free',
    label: 'Free flow',
    color: '#22c55e',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/12',
    ring: 'ring-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    color: '#eab308',
    text: 'text-amber-300',
    bg: 'bg-amber-500/12',
    ring: 'ring-amber-500/25',
    dot: 'bg-amber-400',
  },
  heavy: {
    key: 'heavy',
    label: 'Heavy',
    color: '#f97316',
    text: 'text-orange-300',
    bg: 'bg-orange-500/12',
    ring: 'ring-orange-500/25',
    dot: 'bg-orange-400',
  },
  severe: {
    key: 'severe',
    label: 'Severe',
    color: '#ef4444',
    text: 'text-rose-300',
    bg: 'bg-rose-500/12',
    ring: 'ring-rose-500/25',
    dot: 'bg-rose-400',
  },
};

export const STATUS_ORDER = ['free', 'moderate', 'heavy', 'severe'];

export function statusOf(key) {
  return STATUS[key] || STATUS.free;
}

/** Level of Service band colours (HCM A–F). */
export const LOS_COLOR = {
  A: '#22c55e',
  B: '#4ade80',
  C: '#eab308',
  D: '#f59e0b',
  E: '#f97316',
  F: '#ef4444',
};

/** Planning-authority accent colours, mirrored from the server dataset. */
export const AUTHORITY_COLOR = {
  NMC: '#38bdf8',
  NIT: '#a78bfa',
  NMRDA: '#34d399',
  PWD: '#fbbf24',
  NHAI: '#fb7185',
};

/** Chart palette — ordered for maximum separation on a dark surface. */
export const SERIES = ['#22d3ee', '#a78bfa', '#f59e0b', '#34d399', '#fb7185', '#60a5fa'];

export const CHART_GRID = 'rgba(148, 163, 184, 0.12)';
export const CHART_AXIS = '#64748b';

/** Shared Recharts tooltip styling. */
export const tooltipStyle = {
  contentStyle: {
    background: '#0f1729',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    fontSize: 12,
    boxShadow: '0 18px 40px -20px rgba(0,0,0,0.95)',
  },
  labelStyle: { color: '#94a3b8', marginBottom: 4, fontSize: 11 },
  itemStyle: { padding: '1px 0' },
};

/** Colour a corridor by how saturated it is — used for map stroke + legends. */
export function vcColor(vc) {
  if (vc >= 1.0) return STATUS.severe.color;
  if (vc >= 0.85) return STATUS.heavy.color;
  if (vc >= 0.7) return STATUS.moderate.color;
  return STATUS.free.color;
}

/** Thicker stroke for busier roads so the map encodes volume as well as delay. */
export function strokeWeight(corridor, selected) {
  const base = { Highway: 6, Arterial: 5.5, SubArterial: 4.5, Collector: 4, CBD: 5 };
  return (base[corridor?.roadClass] || 5) + (selected ? 3 : 0);
}
