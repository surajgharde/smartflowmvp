import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useAuth } from '../lib/auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  AuthorityTag,
  Bar,
  ErrorNote,
  Loading,
  LiveDot,
  LosBadge,
  Metric,
  MetricStrip,
  Panel,
  PanelHead,
  Segmented,
  StatusBadge,
  VcMeter,
  cx,
} from '../components/ui.jsx';
import { AUTHORITY_COLOR, CHART_AXIS, CHART_GRID, STATUS, tooltipStyle, vcColor } from '../lib/theme.js';
import { compact, hourLabel, inr, num } from '../lib/format.js';

const POLL_MS = 5000;

/** Plain-language reading of the congestion index, so the number has a meaning. */
function statusWord(index) {
  if (index < 12) return { word: 'Clear', color: STATUS.free.color };
  if (index < 24) return { word: 'Building', color: STATUS.moderate.color };
  if (index < 40) return { word: 'Congested', color: STATUS.heavy.color };
  return { word: 'Gridlocked', color: STATUS.severe.color };
}

export default function Dashboard() {
  const { corridorByCode, jurisdictions } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Open on live data when a peak window is running; outside those hours the
  // network is quiet, so default to the morning peak this platform manages.
  const [hourMode, setHourMode] = useState(() => (inPeakWindowNow() ? 'now' : 9));
  const [state, setState] = useState(null);
  const [profile, setProfile] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(null);

  useEffect(() => {
    api
      .profile()
      .then((res) => setProfile(res.profile))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let stopped = false;

    async function tick() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = hourMode === 'now' ? { live: '1' } : { live: '1', hour: hourMode };
        const res = await api.state(params, controller.signal);
        if (!stopped) {
          setState(res);
          setError(null);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !stopped) setError(err.message);
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    setLoading(true);
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [hourMode]);

  const ranked = useMemo(
    () => (state ? [...state.results].sort((a, b) => b.vc - a.vc) : []),
    [state]
  );

  if (loading && !state) return <Loading label="Reading detector network" />;

  const s = state?.summary;
  const jb = state?.jurisdiction;
  const status = statusWord(s?.congestionIndex ?? 0);
  const maxLoad = Math.max(...(jb?.rows || []).map((r) => r.loadPerLaneKm), 1);
  const currentHourLabel = state ? `${String(Math.floor(state.hour)).padStart(2, '0')}:00` : null;

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        step={1}
        title={`Good ${greeting()}, ${lastName(user?.name)}`}
        subtitle="Saturation across 20 monitored corridors, and how the peak burden is splitting between Nagpur's five planning authorities."
        actions={
          <>
            <span className="inline-flex items-center gap-2 text-2xs text-ink-500">
              <LiveDot />
              <span className="tnum">
                {state ? new Date(state.timestamp).toLocaleTimeString('en-IN', { hour12: false }) : '—'}
              </span>
            </span>
            <Segmented
              value={hourMode}
              onChange={setHourMode}
              size="sm"
              options={[
                { value: 'now', label: 'Now' },
                { value: 9, label: '09:00' },
                { value: 18, label: '18:00' },
              ]}
            />
          </>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      {/* ------------------------------------------------- hero: network state */}
      <Panel className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          <div className="p-6 lg:border-r" style={{ borderColor: 'var(--rule)' }}>
            <p className="label">Network congestion</p>

            <div className="mt-4 flex items-end gap-3">
              <span className="tnum text-[64px] font-medium leading-[0.85] tracking-tight text-bone-50">
                {num(s?.congestionIndex, 1)}
              </span>
              <span className="pb-1 text-xs text-ink-500">/ 100</span>
            </div>

            <p className="mt-4 text-lg font-medium tracking-tight" style={{ color: status.color }}>
              {status.word}
            </p>

            {/* Where this reading sits on the 0–100 scale. */}
            <div className="mt-4 flex h-1 gap-0.5 overflow-hidden rounded-full">
              {[STATUS.free, STATUS.moderate, STATUS.heavy, STATUS.severe].map((band, i) => (
                <span
                  key={band.key}
                  className="h-full flex-1 transition-opacity"
                  style={{
                    background: band.color,
                    opacity: i <= ['Clear', 'Building', 'Congested', 'Gridlocked'].indexOf(status.word) ? 0.9 : 0.14,
                  }}
                />
              ))}
            </div>

            <dl className="mt-7 space-y-3 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Network speed</dt>
                <dd className="tnum font-medium text-bone-100">{num(s?.avgSpeed, 1)} km/h</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Corridors over capacity</dt>
                <dd className="tnum font-medium text-bone-100">
                  {s?.statusCount?.severe ?? 0}
                  <span className="text-ink-500"> of {s?.corridors ?? 0}</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">Reading</dt>
                <dd className="tnum font-medium text-bone-100">
                  {state?.inPeakWindow ? state.inPeakWindow.label : 'Off-peak'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="min-w-0 p-5">
            <div className="mb-1 flex items-baseline justify-between px-1">
              <p className="label">Congestion across the day</p>
              <p className="text-2xs text-ink-600">Shaded — managed peak windows</p>
            </div>
            <div className="h-[228px]">
              <ResponsiveContainer width="100%" height="100%">
                {/* Left margin stays at 0 — a negative one clips the Y axis labels. */}
                <AreaChart data={profile} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIndex" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e2ded7" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#e2ded7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <ReferenceArea yAxisId="index" x1="09:00" x2="12:00" fill="#facc15" fillOpacity={0.055} />
                  <ReferenceArea yAxisId="index" x1="16:00" x2="19:00" fill="#facc15" fillOpacity={0.055} />
                  <XAxis
                    dataKey="label"
                    stroke={CHART_AXIS}
                    tick={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace' }}
                    tickLine={false}
                    axisLine={false}
                    interval={3}
                  />
                  <YAxis
                    yAxisId="index"
                    stroke={CHART_AXIS}
                    tick={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace' }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  {/* Speed is a different unit, so it gets its own axis. */}
                  <YAxis yAxisId="speed" orientation="right" hide />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name) => [
                      name === 'Avg speed' ? `${num(value, 1)} km/h` : num(value, 1),
                      name,
                    ]}
                  />
                  {currentHourLabel && (
                    <ReferenceLine yAxisId="index" x={currentHourLabel} stroke="#e2ded7" strokeWidth={1} strokeDasharray="3 3" />
                  )}
                  <Area
                    yAxisId="index"
                    type="monotone"
                    dataKey="congestionIndex"
                    name="Congestion index"
                    stroke="#e2ded7"
                    strokeWidth={1.75}
                    fill="url(#gIndex)"
                  />
                  <Area
                    yAxisId="speed"
                    type="monotone"
                    dataKey="avgSpeed"
                    name="Avg speed"
                    stroke="#55555e"
                    strokeWidth={1.25}
                    fill="none"
                    strokeDasharray="3 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Panel>

      {/* ------------------------------------------------------ cost of the hour */}
      <MetricStrip>
        <Metric label="Vehicle delay" value={compact(s?.vehicleDelayHours)} unit="veh-hr / hr" hint={`${compact(s?.personDelayHours)} person-hr`} />
        <Metric label="Economic loss" value={inr(s?.economicLossInr)} unit="per hour" hint="Time and fuel" />
        <Metric label="CO₂ emitted" value={compact(s?.co2Kg)} unit="kg / hr" hint={`${compact(s?.fuelWastedLitres)} L wasted`} />
        <Metric label="Queued vehicles" value={compact(s?.queueVehicles)} unit="waiting" hint={`${s?.congestedCorridors ?? 0} corridors congested`} />
        <Metric
          label="Jurisdiction imbalance"
          value={`${num(jb?.imbalanceRatio, 2)}×`}
          unit={`Gini ${num(jb?.gini, 3)}`}
          hint={jb?.rows?.[0] ? `${jb.rows[0].jurisdiction} carries most` : ''}
        />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* --------------------------------------------- corridor ranking */}
        <Panel className="overflow-hidden">
          <PanelHead
            title="Corridor saturation"
            subtitle={`Volume against capacity at ${state ? hourLabel(state.hour) : '—'}`}
            actions={
              <Link to="/simulate" className="btn-quiet">
                Build a strategy
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-left text-2xs text-ink-600" style={{ borderBottom: '1px solid var(--rule)' }}>
                  <th className="py-2.5 pl-5 pr-3 font-medium">Corridor</th>
                  <th className="px-3 py-2.5 font-medium">Authority</th>
                  <th className="w-44 px-3 py-2.5 font-medium">Saturation</th>
                  <th className="px-3 py-2.5 text-right font-medium">Speed</th>
                  <th className="px-3 py-2.5 text-right font-medium">Delay</th>
                  <th className="px-3 py-2.5 text-center font-medium">LOS</th>
                  <th className="py-2.5 pl-3 pr-5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.045]">
                {ranked.map((r) => {
                  const c = corridorByCode[r.code];
                  return (
                    <tr
                      key={r.code}
                      onClick={() => navigate(`/map?corridor=${r.code}`)}
                      className="row-hover cursor-pointer"
                    >
                      <td className="py-2.5 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-7 w-[2px] shrink-0 rounded-full" style={{ background: vcColor(r.vc) }} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-bone-100">{c?.shortName || r.code}</p>
                            <p className="tnum truncate text-2xs text-ink-600">
                              {c?.roadClass} · {num(c?.lengthKm, 1)} km · {c?.lanes} lanes
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <AuthorityTag code={c?.jurisdiction} title={jurisdictions[c?.jurisdiction]?.name} />
                      </td>
                      <td className="px-3 py-2.5">
                        <VcMeter vc={r.vc} />
                      </td>
                      <td className="tnum px-3 py-2.5 text-right text-xs text-bone-200">{num(r.avgSpeed, 1)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-xs text-bone-300">{num(r.delayMin, 1)}m</td>
                      <td className="px-3 py-2.5 text-center">
                        <LosBadge los={r.los} />
                      </td>
                      <td className="py-2.5 pl-3 pr-5">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-2xs text-ink-500"
            style={{ borderTop: '1px solid var(--rule)' }}
          >
            {Object.values(STATUS).map((st) => (
              <span key={st.key} className="flex items-center gap-1.5">
                <span className={cx('h-1.5 w-1.5 rounded-full', st.dot)} />
                {st.label}
                <span className="tnum text-ink-600">{state?.summary?.statusCount?.[st.key] ?? 0}</span>
              </span>
            ))}
            <span className="ml-auto hidden text-ink-600 sm:block">Click a row to open it on the map</span>
          </div>
        </Panel>

        {/* ------------------------------------------- jurisdiction balance */}
        <Panel className="self-start">
          <PanelHead title="Jurisdiction load" subtitle="Vehicle-km carried per lane-km owned" />
          <div className="p-5">
            <div className="space-y-4">
              {(jb?.rows || []).map((r) => (
                <div key={r.jurisdiction}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <AuthorityTag code={r.jurisdiction} title={jurisdictions[r.jurisdiction]?.name} />
                    <span className="tnum text-xs text-bone-200">{num(r.loadPerLaneKm)}</span>
                  </div>
                  <Bar value={r.loadPerLaneKm} max={maxLoad} color={AUTHORITY_COLOR[r.jurisdiction]} />
                  <p className="tnum mt-1.5 text-2xs text-ink-600">
                    {r.corridors} corridors · {num(r.laneKm, 1)} lane-km · avg v/c {num(r.avgVc, 2)}
                  </p>
                </div>
              ))}
            </div>

            {jb?.rows?.length > 1 && (
              <p
                className="mt-5 pt-4 text-xs leading-relaxed text-bone-400"
                style={{ borderTop: '1px solid var(--rule)' }}
              >
                <span className="text-bone-100">{jb.rows[0].jurisdiction}</span> is carrying{' '}
                <span className="tnum text-bone-100">{num(jb.imbalanceRatio, 2)}×</span> the per-lane load of{' '}
                <span className="text-bone-100">{jb.rows[jb.rows.length - 1].jurisdiction}</span> — the
                imbalance this platform exists to correct.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function lastName(name) {
  if (!name) return 'Officer';
  return name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '').split(' ').slice(-1)[0];
}

function inPeakWindowNow() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return (h >= 9 && h < 12) || (h >= 16 && h < 19);
}
