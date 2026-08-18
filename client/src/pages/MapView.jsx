import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, Polyline, TileLayer, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeftRight,
  Clock,
  Layers3,
  MapPin,
  Route,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useScenario } from '../lib/scenario.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  AuthorityTag,
  ErrorNote,
  Loading,
  LosBadge,
  Panel,
  PanelHead,
  StatusBadge,
  VcMeter,
  cx,
} from '../components/ui.jsx';
import { AUTHORITY_COLOR, CHART_AXIS, CHART_GRID, STATUS, tooltipStyle, strokeWeight, vcColor } from '../lib/theme.js';
import { hourLabel, num } from '../lib/format.js';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Imperatively pans the map when a corridor is selected from a list. */
function MapFocus({ corridor }) {
  const map = useMap();
  useEffect(() => {
    if (!corridor?.path?.length) return;
    const bounds = corridor.path.map(([lat, lng]) => [lat, lng]);
    map.flyToBounds(bounds, { padding: [70, 70], duration: 0.7, maxZoom: 15 });
  }, [corridor, map]);
  return null;
}

export default function MapView() {
  const { corridors, corridorByCode, jurisdictions, center } = useAppData();
  const { setFocusCorridor } = useScenario();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [hour, setHour] = useState(9);
  const [authority, setAuthority] = useState('ALL');
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(params.get('corridor'));
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const abortRef = useRef(null);

  // Network state for the chosen hour (no live jitter here — the map is an
  // analysis surface and should not shimmer while an operator studies it).
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    api
      .state({ hour }, controller.signal)
      .then((res) => {
        setState(res);
        setError(null);
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [hour]);

  // Corridor drill-down
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    api
      .corridor(selected, { hour })
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selected, hour]);

  const resultByCode = useMemo(
    () => Object.fromEntries((state?.results || []).map((r) => [r.code, r])),
    [state]
  );

  const visible = useMemo(
    () => (authority === 'ALL' ? corridors : corridors.filter((c) => c.jurisdiction === authority)),
    [corridors, authority]
  );

  const hotspots = useMemo(
    () =>
      [...(state?.results || [])]
        .filter((r) => (authority === 'ALL' ? true : corridorByCode[r.code]?.jurisdiction === authority))
        .sort((a, b) => b.vc - a.vc)
        .slice(0, 8),
    [state, authority, corridorByCode]
  );

  function select(code) {
    setSelected(code);
    setParams(code ? { corridor: code } : {}, { replace: true });
  }

  const selectedCorridor = selected ? corridorByCode[selected] : null;
  const inPeak = (hour >= 9 && hour < 12) || (hour >= 16 && hour < 19);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        step={2}
        title="Live corridor map"
        subtitle="Pick a time of day and read where Nagpur's network is failing. Click any corridor for its saturation curve and diversion options."
        actions={
          <button
            type="button"
            onClick={() => navigate('/simulate')}
            className="btn-primary !py-2 !text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Take this to simulation
          </button>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      {/* ------------------------------------------------------- time control */}
      <Panel className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <Clock className="h-4 w-4 text-brand-400" strokeWidth={2} />
              <span className="tnum w-14 text-lg font-bold text-white">{hourLabel(hour)}</span>
            </div>
            <div className="relative min-w-0 flex-1">
              {/* Peak window bands behind the slider track */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full">
                <div className="absolute inset-y-0 bg-amber-500/25" style={{ left: `${(9 / 24) * 100}%`, width: `${(3 / 24) * 100}%` }} />
                <div className="absolute inset-y-0 bg-amber-500/25" style={{ left: `${(16 / 24) * 100}%`, width: `${(3 / 24) * 100}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                aria-label="Hour of day"
                className="relative h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-400 [&::-webkit-slider-thumb]:shadow-glow
                  [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand-400"
              />
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
                {['00', '06', '09', '12', '16', '19', '23'].map((t) => (
                  <span key={t}>{t}:00</span>
                ))}
              </div>
            </div>
            <span
              className={cx(
                'chip shrink-0',
                inPeak ? 'bg-amber-500/12 text-amber-300' : 'bg-white/[0.06] text-slate-500'
              )}
            >
              {inPeak ? 'Peak window' : 'Off-peak'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-white/[0.07] lg:border-l lg:pl-4">
            <Layers3 className="mr-0.5 h-3.5 w-3.5 text-slate-500" />
            <FilterChip active={authority === 'ALL'} onClick={() => setAuthority('ALL')} label="All" />
            {Object.keys(jurisdictions).map((code) => (
              <FilterChip
                key={code}
                active={authority === code}
                onClick={() => setAuthority(code)}
                label={code}
                color={AUTHORITY_COLOR[code]}
                title={jurisdictions[code]?.name}
              />
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ------------------------------------------------------------ map */}
        <Panel className="overflow-hidden">
          <div className="relative h-[560px]">
            <MapContainer
              center={center}
              zoom={12}
              scrollWheelZoom
              className="h-full w-full"
              zoomControl
            >
              <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />

              {visible.map((c) => {
                const r = resultByCode[c.code];
                if (!r) return null;
                const isSelected = selected === c.code;
                return (
                  <Polyline
                    key={c.code}
                    positions={c.path}
                    pathOptions={{
                      color: vcColor(r.vc),
                      weight: strokeWeight(c, isSelected),
                      opacity: isSelected ? 1 : 0.82,
                      lineCap: 'round',
                      className: isSelected ? 'corridor-selected' : undefined,
                    }}
                    eventHandlers={{ click: () => select(c.code) }}
                  >
                    <LeafletTooltip sticky>
                      <div className="min-w-[170px]">
                        <p className="text-[12px] font-semibold text-white">{c.shortName}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {c.jurisdiction} · {c.roadClass}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                          <span style={{ color: vcColor(r.vc) }} className="font-semibold">
                            v/c {num(r.vc, 2)}
                          </span>
                          <span className="text-slate-400">{num(r.avgSpeed, 0)} km/h</span>
                          <span className="text-slate-400">LOS {r.los}</span>
                        </div>
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                );
              })}

              <MapFocus corridor={selectedCorridor} />
            </MapContainer>

            {/* Legend overlay */}
            <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-lg border border-white/10 bg-ink-950/85 px-3 py-2.5 backdrop-blur-md">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Saturation
              </p>
              <div className="space-y-1.5">
                {Object.values(STATUS).map((st) => (
                  <div key={st.key} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="h-1 w-5 rounded-full" style={{ background: st.color }} />
                    {st.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute right-4 top-4 z-[400] rounded-lg border border-white/10 bg-ink-950/85 px-3 py-2 text-[11px] backdrop-blur-md">
              <span className="tnum font-semibold text-white">{visible.length}</span>
              <span className="text-slate-500"> corridors · </span>
              <span className="tnum font-semibold text-white">{hourLabel(hour)}</span>
            </div>
          </div>
        </Panel>

        {/* --------------------------------------------------- side panel */}
        <div className="space-y-5">
          {selected ? (
            <CorridorDetail
              detail={detail}
              loading={detailLoading}
              hour={hour}
              onClose={() => select(null)}
              onSimulate={(code) => {
                setFocusCorridor(code);
                navigate('/simulate');
              }}
              onPick={select}
            />
          ) : (
            <Panel>
              <PanelHead title="Congestion hotspots" subtitle={`Worst corridors at ${hourLabel(hour)}`} icon={TriangleAlert} />
              <div className="divide-y divide-white/[0.04]">
                {hotspots.map((r, i) => {
                  const c = corridorByCode[r.code];
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => select(r.code)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="tnum w-4 shrink-0 text-xs text-slate-600">{i + 1}</span>
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: vcColor(r.vc) }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-200">{c?.shortName}</p>
                        <div className="mt-1">
                          <VcMeter vc={r.vc} />
                        </div>
                      </div>
                      <AuthorityTag code={c?.jurisdiction} className="shrink-0" />
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
        active ? 'text-ink-950' : 'text-slate-400 hover:text-slate-200'
      )}
      style={active ? { background: color || '#22d3ee' } : { background: 'rgba(255,255,255,0.05)' }}
    >
      {label}
    </button>
  );
}

function CorridorDetail({ detail, loading, hour, onClose, onSimulate, onPick }) {
  if (loading && !detail) {
    return (
      <Panel>
        <Loading label="Loading corridor" />
      </Panel>
    );
  }
  if (!detail) return null;

  const { corridor: c, current: r, profile, alternates } = detail;

  return (
    <>
      <Panel>
        <PanelHead
          title={c.shortName}
          subtitle={c.name}
          icon={Route}
          actions={
            <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:text-slate-300" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          }
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AuthorityTag code={c.jurisdiction} />
            <StatusBadge status={r.status} />
            <LosBadge los={r.los} />
            <span className="chip bg-white/[0.06] text-slate-400">{c.roadClass}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Saturation" value={num(r.vc, 2)} sub={`${num(r.pcuVolume)} / ${num(r.capacity)} PCU`} />
            <Metric label="Avg speed" value={`${num(r.avgSpeed, 1)}`} sub={`free-flow ${r.freeFlowSpeed} km/h`} />
            <Metric label="Excess delay" value={`${num(r.delayMin, 1)}m`} sub={`${num(r.travelTimeMin, 1)} min end-to-end`} />
            <Metric label="Queue" value={r.queueMetres > 0 ? `${num(r.queueMetres)}m` : 'None'} sub={`${num(r.queueVehicles)} vehicles`} />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Saturation across the day
            </p>
            <div className="h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profile} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_AXIS} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke={CHART_AXIS} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={38} />
                  <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine x={`${String(hour).padStart(2, '0')}:00`} stroke="#22d3ee" strokeWidth={1.5} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [num(v, 2), 'v/c']} />
                  <Area type="monotone" dataKey="vc" stroke="#22d3ee" strokeWidth={1.75} fill="url(#gVc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              Red line marks capacity (v/c = 1.0); cyan line marks the selected hour.
            </p>
          </div>

          {c.landmarks?.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Along this corridor
              </p>
              <div className="flex flex-wrap gap-1.5">
                {c.landmarks.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">
                    <MapPin className="h-2.5 w-2.5" />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={() => onSimulate(c.code)} className="btn-primary w-full !text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Simulate a fix for this corridor
          </button>
        </div>
      </Panel>

      {alternates?.length > 0 && (
        <Panel>
          <PanelHead title="Diversion options" subtitle="Parallel routes and their spare capacity" icon={ArrowLeftRight} />
          <div className="divide-y divide-white/[0.04]">
            {alternates.map((alt) => {
              const spare = Math.max(0, alt.current.capacity - alt.current.pcuVolume);
              return (
                <button
                  key={alt.code}
                  type="button"
                  onClick={() => onPick(alt.code)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: vcColor(alt.current.vc) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-200">{alt.name}</p>
                    <p className="tnum mt-0.5 text-[10px] text-slate-500">
                      v/c {num(alt.current.vc, 2)} · {num(spare)} PCU/hr spare
                    </p>
                  </div>
                  <AuthorityTag code={alt.jurisdiction} className="shrink-0" />
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="tnum mt-1 text-base font-bold text-white">{value}</p>
      <p className="tnum mt-0.5 truncate text-[10px] text-slate-600">{sub}</p>
    </div>
  );
}
