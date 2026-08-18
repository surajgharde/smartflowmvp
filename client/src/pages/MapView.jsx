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
import { ArrowRight, X } from 'lucide-react';
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

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const LABEL_URL = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function MapFocus({ corridor }) {
  const map = useMap();
  useEffect(() => {
    if (!corridor?.path?.length) return;
    map.flyToBounds(
      corridor.path.map(([lat, lng]) => [lat, lng]),
      { padding: [80, 80], duration: 0.65, maxZoom: 15 }
    );
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

  // No live jitter here — the map is an analysis surface and should hold still
  // while an operator reads it.
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
        .slice(0, 9),
    [state, authority, corridorByCode]
  );

  function select(code) {
    setSelected(code);
    setParams(code ? { corridor: code } : {}, { replace: true });
  }

  const selectedCorridor = selected ? corridorByCode[selected] : null;
  const inPeak = (hour >= 9 && hour < 12) || (hour >= 16 && hour < 19);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        step={2}
        title="Live corridor map"
        subtitle="Pick a time of day and read where the network is failing. Click any corridor for its saturation curve and diversion options."
        actions={
          <button type="button" onClick={() => navigate('/simulate')} className="btn-primary">
            Take this to simulation
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      {/* --------------------------------------------------------- time + filter */}
      <Panel className="px-5 py-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <div className="flex shrink-0 items-baseline gap-2">
              <span className="tnum text-2xl font-medium tracking-tight text-bone-50">{hourLabel(hour)}</span>
              <span className={cx('text-2xs', inPeak ? 'text-flow-moderate' : 'text-ink-600')}>
                {inPeak ? 'peak' : 'off-peak'}
              </span>
            </div>

            <div className="relative min-w-0 flex-1">
              {/* Peak windows drawn into the track so they read as part of the scale. */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-ink-700">
                <div className="absolute inset-y-0 bg-flow-moderate/30" style={{ left: `${(9 / 23) * 100}%`, width: `${(3 / 23) * 100}%` }} />
                <div className="absolute inset-y-0 bg-flow-moderate/30" style={{ left: `${(16 / 23) * 100}%`, width: `${(3 / 23) * 100}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                aria-label="Hour of day"
                className="range relative bg-transparent"
              />
              <div className="tnum mt-2 flex justify-between text-[9px] text-ink-600">
                {['00', '04', '08', '12', '16', '20', '23'].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 lg:border-l lg:pl-5" style={{ borderColor: 'var(--rule)' }}>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Panel className="overflow-hidden">
          <div className="relative h-[580px]">
            <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full" zoomControl>
              {/* Labels ride above the corridors so street names stay readable. */}
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
                      opacity: !selected || isSelected ? 0.92 : 0.35,
                      lineCap: 'round',
                      className: isSelected ? 'corridor-selected' : undefined,
                    }}
                    eventHandlers={{ click: () => select(c.code) }}
                  >
                    <LeafletTooltip sticky>
                      <p className="text-xs font-medium text-bone-50">{c.shortName}</p>
                      <p className="tnum mt-1 text-[10px] text-ink-500">
                        {c.jurisdiction} · {c.roadClass}
                      </p>
                      <p className="tnum mt-1.5 text-[11px]">
                        <span style={{ color: vcColor(r.vc) }}>v/c {num(r.vc, 2)}</span>
                        <span className="text-bone-400"> · {num(r.avgSpeed, 0)} km/h · LOS {r.los}</span>
                      </p>
                    </LeafletTooltip>
                  </Polyline>
                );
              })}

              <TileLayer url={LABEL_URL} maxZoom={19} />
              <MapFocus corridor={selectedCorridor} />
            </MapContainer>

            <div className="pointer-events-none absolute bottom-5 left-4 z-[400] rounded-md bg-ink-950/85 px-3 py-2.5 backdrop-blur-sm">
              <p className="label mb-2">Saturation</p>
              <div className="space-y-1.5">
                {Object.values(STATUS).map((st) => (
                  <div key={st.key} className="flex items-center gap-2 text-2xs text-ink-500">
                    <span className="h-[2px] w-5 rounded-full" style={{ background: st.color }} />
                    {st.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="tnum pointer-events-none absolute right-4 top-4 z-[400] rounded-md bg-ink-950/85 px-3 py-1.5 text-2xs text-bone-300 backdrop-blur-sm">
              {visible.length} corridors · {hourLabel(hour)}
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
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
            <Panel className="self-start">
              <PanelHead title="Congestion hotspots" subtitle={`Worst corridors at ${hourLabel(hour)}`} />
              <div className="divide-y divide-white/[0.045]">
                {hotspots.map((r, i) => {
                  const c = corridorByCode[r.code];
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => select(r.code)}
                      className="row-hover flex w-full items-center gap-3 px-5 py-3 text-left"
                    >
                      <span className="tnum w-3 shrink-0 text-2xs text-ink-600">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-xs text-bone-100">{c?.shortName}</p>
                          <AuthorityTag code={c?.jurisdiction} className="shrink-0" />
                        </div>
                        <div className="mt-1.5">
                          <VcMeter vc={r.vc} />
                        </div>
                      </div>
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
        'rounded px-2 py-1 text-2xs font-medium transition-colors',
        active ? 'bg-white/[0.1] text-bone-50' : 'text-ink-500 hover:text-bone-200'
      )}
    >
      <span className="flex items-center gap-1.5">
        {color && (
          <span
            className="h-1.5 w-1.5 rounded-[1px] transition-opacity"
            style={{ background: color, opacity: active ? 1 : 0.45 }}
          />
        )}
        {label}
      </span>
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
          actions={
            <button type="button" onClick={onClose} className="rounded p-1 text-ink-500 hover:text-bone-200" aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AuthorityTag code={c.jurisdiction} />
            <StatusBadge status={r.status} />
            <LosBadge los={r.los} />
            <span className="text-2xs text-ink-500">{c.roadClass}</span>
          </div>

          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Stat label="Saturation" value={num(r.vc, 2)} sub={`${num(r.pcuVolume)} / ${num(r.capacity)} PCU`} />
            <Stat label="Avg speed" value={`${num(r.avgSpeed, 1)}`} sub={`free-flow ${r.freeFlowSpeed} km/h`} />
            <Stat label="Excess delay" value={`${num(r.delayMin, 1)}m`} sub={`${num(r.travelTimeMin, 1)} min end-to-end`} />
            <Stat label="Queue" value={r.queueMetres > 0 ? `${num(r.queueMetres)}m` : '—'} sub={`${num(r.queueVehicles)} vehicles`} />
          </dl>

          <div>
            <p className="label mb-2">Saturation across the day</p>
            <div className="h-[124px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profile} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e2ded7" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#e2ded7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_AXIS} tick={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis stroke={CHART_AXIS} tick={{ fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }} tickLine={false} axisLine={false} width={26} />
                  <ReferenceLine y={1} stroke="#f87171" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine x={`${String(hour).padStart(2, '0')}:00`} stroke="#e2ded7" strokeWidth={1} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [num(v, 2), 'v/c']} />
                  <Area type="monotone" dataKey="vc" stroke="#e2ded7" strokeWidth={1.5} fill="url(#gVc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-600">
              Red marks capacity (v/c 1.0); the light line marks the selected hour.
            </p>
          </div>

          {c.landmarks?.length > 0 && (
            <div>
              <p className="label mb-2">Along this corridor</p>
              <p className="text-2xs leading-relaxed text-bone-400">{c.landmarks.join(' · ')}</p>
            </div>
          )}

          <button type="button" onClick={() => onSimulate(c.code)} className="btn-primary w-full">
            Simulate a fix for this corridor
          </button>
        </div>
      </Panel>

      {alternates?.length > 0 && (
        <Panel>
          <PanelHead title="Diversion options" subtitle="Parallel routes and their spare capacity" />
          <div className="divide-y divide-white/[0.045]">
            {alternates.map((alt) => {
              const spare = Math.max(0, alt.current.capacity - alt.current.pcuVolume);
              return (
                <button
                  key={alt.code}
                  type="button"
                  onClick={() => onPick(alt.code)}
                  className="row-hover flex w-full items-center gap-3 px-5 py-3 text-left"
                >
                  <span className="h-7 w-[2px] shrink-0 rounded-full" style={{ background: vcColor(alt.current.vc) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-bone-100">{alt.name}</p>
                    <p className="tnum mt-0.5 text-2xs text-ink-600">
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

function Stat({ label, value, sub }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tnum mt-1.5 text-lg font-medium leading-none text-bone-50">{value}</dd>
      <dd className="tnum mt-1.5 truncate text-2xs text-ink-600">{sub}</dd>
    </div>
  );
}
