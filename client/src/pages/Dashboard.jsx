import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Fuel,
  Gauge,
  IndianRupee,
  Leaf,
  Scale,
  SlidersHorizontal,
  TrafficCone,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useAuth } from '../lib/auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  AuthorityTag,
  ErrorNote,
  Loading,
  LiveDot,
  LosBadge,
  Panel,
  PanelHead,
  Segmented,
  StatTile,
  StatusBadge,
  VcMeter,
  cx,
} from '../components/ui.jsx';
import { AUTHORITY_COLOR, CHART_AXIS, CHART_GRID, STATUS, tooltipStyle, vcColor } from '../lib/theme.js';
import { compact, hourLabel, inr, num } from '../lib/format.js';

const POLL_MS = 5000;

export default function Dashboard() {
  const { corridorByCode, jurisdictions } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();

  // 'now' | 9 | 18. Open on live data when a peak window is actually running;
  // outside those hours the network is quiet, so default to the morning peak —
  // the state this platform exists to manage.
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

  // Live polling. The 'now' mode tracks the wall clock; the fixed peak modes pin
  // the model to 09:00 or 18:00 so a demo is reproducible at any time of day.
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

  const ranked = useMemo(() => {
    if (!state) return [];
    return [...state.results].sort((a, b) => b.vc - a.vc);
  }, [state]);

  const jurisdictionData = useMemo(() => {
    if (!state) return [];
    return state.jurisdiction.rows.map((r) => ({
      ...r,
      name: r.jurisdiction,
      fill: AUTHORITY_COLOR[r.jurisdiction] || '#94a3b8',
    }));
  }, [state]);

  if (loading && !state) return <Loading label="Reading detector network" />;

  const s = state?.summary;
  const jb = state?.jurisdiction;
  const worst = jb?.rows?.[0];
  const best = jb?.rows?.[jb.rows.length - 1];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        step={1}
        title={`Good ${greeting()}, ${user?.name?.split(' ').slice(-1)[0] || 'Officer'}`}
        subtitle="Live saturation across 20 monitored corridors, and how the peak burden is splitting between Nagpur's five planning authorities."
        actions={
          <>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2">
              <LiveDot />
              <span className="text-[11px] font-medium text-slate-400">
                Live · {state ? new Date(state.timestamp).toLocaleTimeString('en-IN') : '—'}
              </span>
            </div>
            <Segmented
              value={hourMode}
              onChange={setHourMode}
              options={[
                { value: 'now', label: 'Now' },
                { value: 9, label: '09:00 AM peak' },
                { value: 18, label: '18:00 PM peak' },
              ]}
            />
          </>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Congestion index"
          value={num(s?.congestionIndex, 1)}
          unit="/ 100"
          icon={Gauge}
          tone={s?.congestionIndex > 40 ? 'danger' : s?.congestionIndex > 22 ? 'warn' : 'good'}
          hint={state?.inPeakWindow ? state.inPeakWindow.label : 'Off-peak'}
        />
        <StatTile label="Network speed" value={num(s?.avgSpeed, 1)} unit="km/h" icon={TrafficCone} hint="Volume-weighted" />
        <StatTile
          label="Corridors congested"
          value={`${s?.congestedCorridors ?? 0}`}
          unit={`of ${s?.corridors ?? 0}`}
          icon={TriangleAlert}
          tone={s?.congestedCorridors > 5 ? 'warn' : 'default'}
          hint={`${s?.statusCount?.severe ?? 0} at LOS F`}
        />
        <StatTile label="Vehicle delay" value={compact(s?.vehicleDelayHours)} unit="veh-hr / hr" icon={Fuel} hint={`${compact(s?.personDelayHours)} person-hr`} />
        <StatTile label="Economic loss" value={inr(s?.economicLossInr)} unit="per hour" icon={IndianRupee} tone="warn" hint="Time + fuel" />
        <StatTile label="CO₂ emitted" value={compact(s?.co2Kg)} unit="kg / hr" icon={Leaf} hint={`${compact(s?.fuelWastedLitres)} L wasted`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ------------------------------------------------- 24-hour profile */}
        <Panel className="xl:col-span-2">
          <PanelHead
            title="24-hour city congestion profile"
            subtitle="Shaded bands are the two managed peak windows"
            icon={Gauge}
            actions={
              <div className="hidden items-center gap-3 text-[10px] text-slate-500 sm:flex">
                <LegendSwatch color="#22d3ee" label="Congestion index" />
                <LegendSwatch color="#a78bfa" label="Avg speed" />
              </div>
            }
          />
          <div className="h-[290px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profile} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIndex" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <ReferenceArea yAxisId="index" x1="09:00" x2="12:00" fill="#f59e0b" fillOpacity={0.07} />
                <ReferenceArea yAxisId="index" x1="16:00" x2="19:00" fill="#f59e0b" fillOpacity={0.07} />
                <XAxis dataKey="label" stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                {/* Index and speed are different units, so each gets its own axis. */}
                <YAxis yAxisId="index" stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                <YAxis
                  yAxisId="speed"
                  orientation="right"
                  stroke="#a78bfa"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) => [
                    name === 'Avg speed' ? `${num(value, 1)} km/h` : num(value, 1),
                    name,
                  ]}
                />
                <Area yAxisId="index" type="monotone" dataKey="congestionIndex" name="Congestion index" stroke="#22d3ee" strokeWidth={2} fill="url(#gIndex)" />
                <Area yAxisId="speed" type="monotone" dataKey="avgSpeed" name="Avg speed" stroke="#a78bfa" strokeWidth={1.75} fill="none" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* -------------------------------------------- jurisdiction balance */}
        <Panel>
          <PanelHead
            title="Jurisdiction load balance"
            subtitle="Vehicle-km carried per lane-km owned"
            icon={Scale}
          />
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Imbalance ratio</p>
                <p className="tnum mt-0.5 text-lg font-bold text-white">
                  {num(jb?.imbalanceRatio, 2)}×
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Gini</p>
                <p className="tnum mt-0.5 text-lg font-bold text-white">{num(jb?.gini, 3)}</p>
              </div>
            </div>

            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jurisdictionData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="name" stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => compact(v)} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v) => [`${num(v)} veh-km / lane-km`, 'Peak load']}
                    labelFormatter={(l) => jurisdictions[l]?.name || l}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="loadPerLaneKm" radius={[4, 4, 0, 0]} maxBarSize={38}>
                    {jurisdictionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {worst && best && (
              <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/90">
                <span className="font-semibold">{worst.jurisdiction}</span> is carrying{' '}
                <span className="tnum font-semibold">{num(jb.imbalanceRatio, 2)}×</span> the per-lane load of{' '}
                <span className="font-semibold">{best.jurisdiction}</span> in this window — the imbalance
                SmartFlow exists to correct.
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* ------------------------------------------------- corridor rankings */}
      <Panel>
        <PanelHead
          title="Corridor saturation ranking"
          subtitle={`Sorted by volume-to-capacity ratio at ${state ? hourLabel(state.hour) : '—'}`}
          icon={TrafficCone}
          actions={
            <Link to="/simulate" className="btn-ghost !py-1.5 !text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Build a strategy
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-4 py-2.5 text-left font-medium">Corridor</th>
                <th className="px-4 py-2.5 text-left font-medium">Authority</th>
                <th className="w-48 px-4 py-2.5 text-left font-medium">Saturation (v/c)</th>
                <th className="px-4 py-2.5 text-right font-medium">Speed</th>
                <th className="px-4 py-2.5 text-right font-medium">Delay</th>
                <th className="px-4 py-2.5 text-right font-medium">Queue</th>
                <th className="px-4 py-2.5 text-center font-medium">LOS</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => {
                const c = corridorByCode[r.code];
                return (
                  <tr
                    key={r.code}
                    onClick={() => navigate(`/map?corridor=${r.code}`)}
                    className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="tnum px-4 py-2.5 text-xs text-slate-600">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: vcColor(r.vc) }} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-200">{c?.shortName || r.code}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {c?.roadClass} · {num(c?.lengthKm, 1)} km · {c?.lanes} lanes
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <AuthorityTag code={c?.jurisdiction} title={jurisdictions[c?.jurisdiction]?.name} />
                    </td>
                    <td className="px-4 py-2.5">
                      <VcMeter vc={r.vc} />
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-300">{num(r.avgSpeed, 1)}</td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-300">{num(r.delayMin, 1)}m</td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-400">
                      {r.queueMetres > 0 ? `${num(r.queueMetres)} m` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <LosBadge los={r.los} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            {Object.values(STATUS).map((st) => (
              <span key={st.key} className="flex items-center gap-1.5">
                <span className={cx('h-1.5 w-1.5 rounded-full', st.dot)} />
                {st.label} ({state?.summary?.statusCount?.[st.key] ?? 0})
              </span>
            ))}
          </div>
          <span className="hidden items-center gap-1 sm:flex">
            Click a row to open it on the map <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </Panel>
    </div>
  );
}

function LegendSwatch({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function inPeakWindowNow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return (h >= 9 && h < 12) || (h >= 16 && h < 19);
}
