import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as Icons from 'lucide-react';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  GitCompareArrows,
  IndianRupee,
  Scale,
  Sparkles,
  SlidersHorizontal,
  TrendingDown,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useScenario } from '../lib/scenario.jsx';
import { useAuth } from '../lib/auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  AuthorityTag,
  DeltaPill,
  EmptyState,
  ErrorNote,
  Loading,
  LosBadge,
  Panel,
  PanelHead,
  Segmented,
  Spinner,
  StatTile,
  cx,
  useToast,
} from '../components/ui.jsx';
import { AUTHORITY_COLOR, CHART_AXIS, CHART_GRID, tooltipStyle, vcColor } from '../lib/theme.js';
import { compact, inr, lakh, num } from '../lib/format.js';

export default function Results() {
  const { corridorByCode, jurisdictions } = useAppData();
  const { windowId, setWindowId, result, selections, loadPackage } = useScenario();
  const { canApply } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState(result ? 'compare' : 'ai');
  const [advice, setAdvice] = useState(null);
  const [loadingAdvice, setLoadingAdvice] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setLoadingAdvice(true);
    api
      .recommendations({ windowId, limit: 5 })
      .then(setAdvice)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAdvice(false));
  }, [windowId]);

  /** Save the scenario, freeze a report from it, and open the report. */
  async function publish() {
    if (!result || !selections.length) {
      toast.error('Run a simulation before generating a report');
      return;
    }
    setPublishing(true);
    try {
      const name = `${windowId === 'morning' ? 'Morning' : 'Evening'} peak plan — ${new Date().toLocaleDateString('en-IN')}`;
      const { simulation } = await api.saveSimulation({ name, windowId, selections });
      if (canApply) await api.applySimulation(simulation._id);
      const { report } = await api.createReport({
        simulationId: simulation._id,
        title: `Traffic Management Report — ${name}`,
      });
      toast.success(`Report ${report.refId} generated`);
      navigate(`/reports/${report._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        step={5}
        title="Results & AI recommendations"
        subtitle="What the strategy actually changed, and what the engine would do next — each suggestion ranked by a simulated outcome, not a guess."
        actions={
          <>
            <Segmented
              value={windowId}
              onChange={setWindowId}
              options={[
                { value: 'morning', label: 'Morning 09–12' },
                { value: 'evening', label: 'Evening 16–19' },
              ]}
            />
            <button
              type="button"
              onClick={publish}
              disabled={!result || publishing}
              className="btn-primary !py-2 !text-xs"
            >
              {publishing ? <Spinner /> : <FileText className="h-3.5 w-3.5" />}
              Apply & generate report
            </button>
          </>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'compare', label: 'Before vs After' },
          { value: 'ai', label: 'AI recommendations' },
          { value: 'balance', label: 'Jurisdiction balance' },
        ]}
      />

      {tab === 'compare' &&
        (result ? (
          <Comparison result={result} corridorByCode={corridorByCode} />
        ) : (
          <Panel>
            <EmptyState
              icon={GitCompareArrows}
              title="No simulation run yet"
              description="Compose a strategy in the Simulation Studio and run it — the before/after comparison will appear here."
              action={
                <button type="button" onClick={() => navigate('/simulate')} className="btn-primary !text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Open Simulation Studio
                </button>
              }
            />
          </Panel>
        ))}

      {tab === 'ai' &&
        (loadingAdvice ? (
          <Panel>
            <Loading label="Diagnosing corridors and sweeping strategies" />
          </Panel>
        ) : (
          <Recommendations
            advice={advice}
            onLoadPackage={() => {
              loadPackage(advice.suggestedPackage.selections, windowId);
              toast.success('Recommended package loaded into the studio');
              navigate('/simulate');
            }}
            onApplyOne={(rec) => {
              loadPackage(
                [{ strategyId: rec.strategyId, intensity: rec.intensity, corridorCodes: [rec.corridorCode] }],
                windowId
              );
              toast.success(`${rec.strategyShort} on ${rec.corridorName} loaded`);
              navigate('/simulate');
            }}
          />
        ))}

      {tab === 'balance' &&
        (loadingAdvice ? (
          <Panel>
            <Loading label="Auditing jurisdiction load" />
          </Panel>
        ) : (
          <JurisdictionBalance advisory={advice?.jurisdictionAdvisory} jurisdictions={jurisdictions} result={result} />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------- comparison */

function Comparison({ result, corridorByCode }) {
  const b = result.before.window_totals;
  const a = result.after.window_totals;
  const d = result.delta;

  const chartData = useMemo(
    () =>
      result.comparison
        .filter((c) => Math.abs(c.delta.congestionIndex) > 0.4)
        .sort((x, y) => x.delta.congestionIndex - y.delta.congestionIndex)
        .slice(0, 10)
        .map((c) => ({ name: c.name, delta: c.delta.congestionIndex })),
    [result]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Congestion index" value={num(a.congestionIndex, 1)} unit={`was ${num(b.congestionIndex, 1)}`} delta={d.congestionIndexPct} goodWhenNegative tone="brand" />
        <StatTile label="Network speed" value={num(a.avgSpeed, 1)} unit="km/h" delta={d.avgSpeedPct} />
        <StatTile label="Vehicle delay" value={compact(a.vehicleDelayHours)} unit="veh-hr" delta={d.vehicleDelayPct} goodWhenNegative />
        <StatTile label="CO₂ over window" value={compact(a.co2Kg)} unit="kg" delta={d.co2Pct} goodWhenNegative />
        <StatTile label="Economic loss" value={inr(a.economicLossInr)} unit="per window" delta={d.economicLossPct} goodWhenNegative />
        <StatTile
          label="Corridors improved"
          value={`${result.improvedCount}`}
          unit={result.worsenedCount ? `${result.worsenedCount} worse` : 'none worse'}
          tone={result.worsenedCount ? 'warn' : 'good'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHead title="Corridor-level change" subtitle="Congestion index movement, best first" icon={TrendingDown} />
          <div className="h-[300px] p-3">
            {chartData.length === 0 ? (
              <EmptyState icon={TriangleAlert} title="No corridor moved materially" description="Increase the deployment intensity or target more corridors." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 96, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                  {/* Anchored at zero so bar length stays proportional to the actual change. */}
                  <XAxis
                    type="number"
                    domain={[(min) => Math.min(0, min * 1.1), (max) => Math.max(0, max * 1.1)]}
                    stroke={CHART_AXIS}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis type="category" dataKey="name" stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={92} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [num(v, 1), 'Index change']} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="delta" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.delta < 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Investment case" icon={IndianRupee} />
          <div className="space-y-3 p-4">
            <Money label="Capital cost" value={lakh(result.economics.capexLakh)} />
            <Money label="Saving per window" value={inr(result.economics.savingPerWindowInr)} good />
            <Money label="Annual saving" value={lakh(result.economics.annualSavingLakh)} good />
            <Money
              label="Payback period"
              value={result.economics.paybackMonths != null ? `${num(result.economics.paybackMonths, 1)} months` : 'No net saving'}
            />
            <Money label="Time to deploy" value={`${result.economics.deployDays} days`} />

            <div className="border-t border-white/[0.06] pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Strategies applied</p>
              <div className="space-y-1.5">
                {result.after.applied.map((s) => (
                  <div key={s.strategyId} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-300">{s.name}</span>
                    <span className="tnum shrink-0 text-slate-500">{lakh(s.costLakh)}</span>
                  </div>
                ))}
              </div>
            </div>

            {result.after.skipped.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2.5 text-[10px] leading-relaxed text-amber-100/85">
                <p className="mb-1 font-semibold">Skipped as ineligible</p>
                {result.after.skipped.slice(0, 4).map((s, i) => (
                  <p key={i}>
                    {s.corridor ? `${s.corridor}: ` : ''}
                    {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Corridor detail" subtitle="Every monitored corridor, before and after" icon={GitCompareArrows} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">Corridor</th>
                <th className="px-4 py-2.5 text-left font-medium">Authority</th>
                <th className="px-4 py-2.5 text-right font-medium">v/c before</th>
                <th className="px-4 py-2.5 text-right font-medium">v/c after</th>
                <th className="px-4 py-2.5 text-right font-medium">Speed</th>
                <th className="px-4 py-2.5 text-right font-medium">Delay</th>
                <th className="px-4 py-2.5 text-center font-medium">LOS</th>
                <th className="px-4 py-2.5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {[...result.comparison]
                .sort((x, y) => x.delta.congestionIndex - y.delta.congestionIndex)
                .map((c) => (
                  <tr key={c.code} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: vcColor(c.after.vc) }} />
                        <span className="truncate font-medium text-slate-200">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <AuthorityTag code={c.jurisdiction} />
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-400">{num(c.before.vc, 2)}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-slate-200">{num(c.after.vc, 2)}</td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-300">
                      {num(c.after.avgSpeed, 1)}
                      <span className="ml-1 text-[10px] text-slate-600">km/h</span>
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-300">{num(c.after.delayMin, 1)}m</td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {c.losChanged && (
                          <>
                            <span className="text-[10px] text-slate-600">{c.before.los}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-slate-600" />
                          </>
                        )}
                        <LosBadge los={c.after.los} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DeltaPill value={c.delta.congestionIndex} goodWhenNegative suffix="" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Money({ label, value, good }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cx('tnum font-semibold', good ? 'text-emerald-300' : 'text-slate-200')}>{value}</span>
    </div>
  );
}

/* -------------------------------------------------------- recommendations */

function Recommendations({ advice, onLoadPackage, onApplyOne }) {
  if (!advice) return null;
  const { recommendations, hotspots, suggestedPackage, candidatesEvaluated, computeMs } = advice;

  return (
    <div className="space-y-5">
      <Panel className="border-brand-500/25 bg-gradient-to-br from-brand-500/[0.07] to-transparent">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
              <BrainCircuit className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Recommended package</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {suggestedPackage.labels.join(' · ')}
              </p>
              <p className="tnum mt-1.5 text-[11px] text-slate-500">
                {lakh(suggestedPackage.estimatedCostLakh)} capex · live in {suggestedPackage.maxDeployDays} days ·{' '}
                {candidatesEvaluated} candidate interventions simulated in {computeMs} ms
              </p>
            </div>
          </div>
          <button type="button" onClick={onLoadPackage} className="btn-primary shrink-0 !text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Load into studio
          </button>
        </div>
      </Panel>

      {recommendations.length === 0 ? (
        <Panel>
          <EmptyState icon={CheckCircle2} title="No intervention is warranted" description="No corridor in this window is saturated enough for a strategy to produce a net network benefit." />
        </Panel>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <RecommendationCard key={rec.id} rec={rec} rank={i + 1} onApply={() => onApplyOne(rec)} />
          ))}
        </div>
      )}

      <Panel>
        <PanelHead title="Diagnosed hotspots" subtitle="Why each corridor is failing in this window" icon={TriangleAlert} />
        <div className="divide-y divide-white/[0.04]">
          {hotspots.map((h) => (
            <div key={h.code} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: vcColor(h.vc) }} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-semibold text-slate-200">{h.name}</p>
                    <AuthorityTag code={h.jurisdiction} />
                    <LosBadge los={h.los} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                    {h.evidence.length ? h.evidence.join('; ') : `Running at ${num(h.vc * 100, 0)}% of capacity.`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 pl-4 sm:pl-0">
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">Primary cause</p>
                  <p className="text-[11px] font-semibold text-amber-300">{h.primaryCause}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">Speed</p>
                  <p className="tnum text-[11px] font-semibold text-slate-300">{num(h.avgSpeed, 1)} km/h</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RecommendationCard({ rec, rank, onApply }) {
  const Icon = Icons[rec.icon] || Sparkles;
  const priorityTone = {
    Critical: 'bg-rose-500/12 text-rose-300',
    High: 'bg-orange-500/12 text-orange-300',
    Medium: 'bg-amber-500/12 text-amber-300',
  }[rec.priority];

  return (
    <Panel className="transition-colors hover:border-white/15">
      <div className="flex flex-col gap-4 p-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="tnum grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-400">
              {rank}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-brand-500/25 bg-brand-500/10 text-brand-300">
              <Icon className="h-4 w-4" strokeWidth={2} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{rec.strategyName}</h3>
              <span className="text-xs text-slate-500">on</span>
              <span className="text-sm font-semibold text-brand-300">{rec.corridorName}</span>
              <AuthorityTag code={rec.jurisdiction} />
              <span className={cx('chip', priorityTone)}>{rec.priority}</span>
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{rec.rationale}</p>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px]">
              <Fact label="Network delay" value={`−${num(rec.expected.delayReductionPct, 1)}%`} good />
              <Fact label="Corridor speed" value={`+${num(rec.expected.speedGainPct, 1)}%`} good />
              <Fact label="Capex" value={lakh(rec.expected.costLakh)} />
              <Fact
                label="Payback"
                value={rec.expected.paybackMonths != null ? `${num(rec.expected.paybackMonths, 1)} mo` : '—'}
              />
              <Fact label="Live in" value={`${rec.deployDays} days`} />
              {rec.expected.worsened > 0 && (
                <Fact label="Spillover" value={`${rec.expected.worsened} corridor${rec.expected.worsened > 1 ? 's' : ''}`} bad />
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-4 border-white/[0.06] lg:w-44 lg:flex-col lg:items-stretch lg:border-l lg:pl-4">
          <div className="flex-1 lg:flex-none">
            <div className="flex items-baseline justify-between">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Score</p>
              <p className="tnum text-lg font-bold text-white">{num(rec.score, 1)}</p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${rec.score}%` }} />
            </div>
            <p className="tnum mt-1.5 text-[10px] text-slate-600">
              Confidence {Math.round(rec.confidence * 100)}%
            </p>
          </div>
          <button type="button" onClick={onApply} className="btn-ghost shrink-0 !text-xs lg:w-full">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Simulate this
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Fact({ label, value, good, bad }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-slate-600">{label}</span>
      <span className={cx('tnum font-semibold', good ? 'text-emerald-300' : bad ? 'text-rose-300' : 'text-slate-300')}>
        {value}
      </span>
    </span>
  );
}

/* ------------------------------------------------------ jurisdiction view */

function JurisdictionBalance({ advisory, jurisdictions, result }) {
  if (!advisory) return null;

  const data = advisory.rows.map((r) => ({
    ...r,
    name: r.jurisdiction,
    fill: AUTHORITY_COLOR[r.jurisdiction] || '#94a3b8',
  }));

  const severityTone = {
    high: 'border-rose-500/25 bg-rose-500/[0.07] text-rose-100',
    moderate: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-100',
    low: 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-100',
  }[advisory.severity];

  return (
    <div className="space-y-5">
      <div className={cx('rounded-xl border p-4', severityTone)}>
        <div className="flex items-start gap-3.5">
          <Scale className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
          <div>
            <p className="text-sm font-semibold">{advisory.headline}</p>
            <ul className="mt-2 space-y-1.5">
              {advisory.notes.map((n, i) => (
                <li key={i} className="text-[12px] leading-relaxed opacity-90">
                  • {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Load per lane-km owned" subtitle="The fairness metric" icon={Scale} />
          <div className="h-[280px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="name" stroke={CHART_AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52} tickFormatter={compact} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`${num(v)} veh-km / lane-km`, 'Peak load']}
                  labelFormatter={(l) => jurisdictions[l]?.name || l}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="loadPerLaneKm" radius={[5, 5, 0, 0]} maxBarSize={54}>
                  {data.map((e) => (
                    <Cell key={e.name} fill={e.fill} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Authority breakdown" icon={Scale} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 text-left font-medium">Authority</th>
                  <th className="px-4 py-2.5 text-right font-medium">Corridors</th>
                  <th className="px-4 py-2.5 text-right font-medium">Lane-km</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg v/c</th>
                  <th className="px-4 py-2.5 text-right font-medium">Load / lane-km</th>
                </tr>
              </thead>
              <tbody>
                {advisory.rows.map((r) => (
                  <tr key={r.jurisdiction} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <AuthorityTag code={r.jurisdiction} />
                        <span className="hidden truncate text-[11px] text-slate-500 sm:inline">
                          {jurisdictions[r.jurisdiction]?.name}
                        </span>
                      </div>
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-300">
                      {r.corridors}
                      {r.severeCorridors > 0 && (
                        <span className="ml-1 text-[10px] text-rose-400">({r.severeCorridors} LOS F)</span>
                      )}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-400">{num(r.laneKm, 1)}</td>
                    <td className="tnum px-4 py-2.5 text-right text-slate-300">{num(r.avgVc, 2)}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-slate-100">{num(r.loadPerLaneKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
