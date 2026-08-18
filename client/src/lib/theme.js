/**
 * One source of truth for what colour means in this product.
 *
 * The interface itself is achromatic — surfaces are near-black, interaction is
 * bone. Colour is spent only on the four congestion bands and the five planning
 * authorities, so anything coloured on screen is carrying information.
 */

export const STATUS = {
  free: {
    key: 'free',
    label: 'Free flow',
    color: '#4ade80',
    text: 'text-flow-free',
    bg: 'bg-flow-free/[0.12]',
    dot: 'bg-flow-free',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    color: '#facc15',
    text: 'text-flow-moderate',
    bg: 'bg-flow-moderate/[0.12]',
    dot: 'bg-flow-moderate',
  },
  heavy: {
    key: 'heavy',
    label: 'Heavy',
    color: '#fb923c',
    text: 'text-flow-heavy',
    bg: 'bg-flow-heavy/[0.12]',
    dot: 'bg-flow-heavy',
  },
  severe: {
    key: 'severe',
    label: 'Severe',
    color: '#f87171',
    text: 'text-flow-severe',
    bg: 'bg-flow-severe/[0.12]',
    dot: 'bg-flow-severe',
  },
};

export const STATUS_ORDER = ['free', 'moderate', 'heavy', 'severe'];

export function statusOf(key) {
  return STATUS[key] || STATUS.free;
}

/** Level of Service band colours (HCM A–F), ramped through the same hues. */
export const LOS_COLOR = {
  A: '#4ade80',
  B: '#86efac',
  C: '#facc15',
  D: '#fbbf24',
  E: '#fb923c',
  F: '#f87171',
};

/**
 * Planning authorities. Deliberately drawn from a different, cooler family than
 * the congestion ramp so an authority tag can never be mistaken for a severity.
 */
export const AUTHORITY_COLOR = {
  NMC: '#7dd3fc',
  NIT: '#c4b5fd',
  NMRDA: '#5eead4',
  PWD: '#d8b4fe',
  NHAI: '#93c5fd',
};

/** Neutral chart ink for non-semantic series. */
export const INK = {
  primary: '#e2ded7',
  secondary: '#7d766b',
  faint: '#3a3a41',
};

export const CHART_GRID = 'rgba(255, 255, 255, 0.055)';
export const CHART_AXIS = '#55555e';

/** Baseline vs treatment: the one comparison that recurs across every screen. */
export const SERIES = {
  baseline: '#7d766b',
  treatment: '#e2ded7',
};

export const tooltipStyle = {
  contentStyle: {
    background: '#141416',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    boxShadow: '0 24px 48px -28px rgba(0,0,0,0.95)',
    padding: '7px 10px',
  },
  labelStyle: { color: '#7d766b', marginBottom: 3, fontSize: 10 },
  itemStyle: { padding: '1px 0' },
  cursor: { fill: 'rgba(255,255,255,0.035)' },
};

/** Colour a corridor by saturation — map stroke, meters and legends. */
export function vcColor(vc) {
  if (vc >= 1.0) return STATUS.severe.color;
  if (vc >= 0.85) return STATUS.heavy.color;
  if (vc >= 0.7) return STATUS.moderate.color;
  return STATUS.free.color;
}

export function statusKey(vc) {
  if (vc >= 1.0) return 'severe';
  if (vc >= 0.85) return 'heavy';
  if (vc >= 0.7) return 'moderate';
  return 'free';
}

/** Busier road classes draw thicker, so the map encodes scale as well as delay. */
export function strokeWeight(corridor, selected) {
  const base = { Highway: 5.5, Arterial: 5, SubArterial: 4, Collector: 3.5, CBD: 4.5 };
  return (base[corridor?.roadClass] || 4.5) + (selected ? 3 : 0);
}
