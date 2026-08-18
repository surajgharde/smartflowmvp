import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useScenario } from '../lib/scenario.jsx';
import { useAuth } from '../lib/auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  AuthorityTag,
  Bar as MiniBar,
  DeltaPill,
  EmptyState,
  ErrorNote,
  Loading,
  LosBadge,
  Metric,
  MetricStrip,
  Panel,
  PanelHead,
  Segmented,
  Spinner,
  cx,
  useToast,
} from '../components/ui.jsx';
import { AUTHORITY_COLOR, CHART_AXIS, CHART_GRID, STATUS, tooltipStyle, vcColor } from '../lib/theme.js';
import { compact, inr, lakh, num } from '../lib/format.js';

export default function Results() {
  const { jurisdictions } = useAppData();
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
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        step={5}
        title="Results & recommendations"
        subtitle="What the strategy actually changed, and what the engine would do next — every suggestion ranked by a simulated outcome, not a guess."
        actions={
          <>
            <Segmented
              value={windowId}
              onChange={setWindowId}
              size="sm"
              options={[
                { value: 'morning', label: 'Morning 09–12' },
                { value: 'evening', label: 'Evening 16–19' },
              ]}
            />
            <button type="button" onClick={publish} disabled={!result || publishing} className="btn-primary">
              {publishing ? <Spinner /> : null}
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
          { value: 'compare', label: 'Before vs after' },
          { value: 'ai', label: 'Recommendations' },
          { value: 'balance', label: 'Jurisdiction balance' },
        ]}
      />

      {tab === 'compare' &&
        (result ? (
          <Comparison result={result} />
        ) : (
          <Panel>
            <EmptyState
              title="No simulation run yet"
              description="Compose a strategy in the Simulation Studio and run it — the before/after comparison will appear here."
              action={
                <button type="button" onClick={() => navigate('/simulate')} className="btn-primary">
                  Open Simulation Studio
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
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
          <JurisdictionBalance advisory={advice?.jurisdictionAdvisory} jurisdictions={jurisdictions} />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------- comparison */

function Comparison({ result }) {
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
    <div className="space-y-6">
      <MetricStrip>
        <Metric label="Congestion index" value={num(a.congestionIndex, 1)} unit={`was ${num(b.congestionIndex, 1)}`} delta={d.congestionIndexPct} goodWhenNegative />
        <Metric label="Network speed" value={num(a.avgSpeed, 1)} unit="km/h" delta={d.avgSpeedPct} />
        <Metric label="Vehicle delay" value={compact(a.vehicleDelayHours)} unit="veh-hr" delta={d.vehicleDelayPct} goodWhenNegative />
        <Metric label="CO₂ over window" value={compact(a.co2Kg)} unit="kg" delta={d.co2Pct} goodWhenNegative />
        <Metric label="Economic loss" value={inr(a.economicLossInr)} unit="per window" delta={d.economicLossPct} goodWhenNegative />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel>
          <PanelHead title="Corridor-level change" subtitle="Congestion index movement, biggest improvement first" />
          <div className="h-[300px] p-4">
            {chartData.length === 0 ? (
              <EmptyState title="No corridor moved materially" description="Increase the deployment intensity or target more corridors." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 100, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                  {/* Anchored at zero so bar length stays proportional to the real change. */}
                  {/* Anchored at zero and rounded to whole units so bar length stays
                      proportional and the ticks read as round numbers. */}
                  <XAxis
                    type="number"
                    domain={[(min) => Math.floor(Math.min(0, min * 1.08)), (max) => Math.ceil(Math.max(0, max * 1.08))]}
                    allowDecimals={false}
                    tickCount={5}
                    stroke={CHART_AXIS}
                    tick={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={CHART_AXIS}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={96}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v) => [num(v, 1), 'Index change']} />
                  <Bar dataKey="delta" radius={[0, 2, 2, 0]} maxBarSize={14}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.delta < 0 ? STATUS.free.color : STATUS.severe.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel className="self-start">
          <PanelHead title="Investment case" />
          <div className="p-5">
            <dl className="space-y-3 text-xs">
              <Row label="Capital cost" value={lakh(result.economics.capexLakh)} />
              <Row label="Saving per window" value={inr(result.economics.savingPerWindowInr)} good />
              <Row label="Annual saving" value={lakh(result.economics.annualSavingLakh)} good />
              <Row
                label="Payback period"
                value={result.economics.paybackMonths != null ? `${num(result.economics.paybackMonths, 1)} months` : 'No net saving'}
              />
              <Row label="Time to deploy" value={`${result.economics.deployDays} days`} />
              <Row
                label="Corridors improved"
                value={`${result.improvedCount}${result.worsenedCount ? ` · ${result.worsenedCount} worse` : ''}`}
              />
            </dl>

            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
              <p className="label mb-3">Strategies applied</p>
              <dl className="space-y-2.5 text-xs">
                {result.after.applied.map((s) => (
                  <div key={s.strategyId} className="flex items-baseline justify-between gap-3">
                    <dt className="truncate text-bone-300">{s.name}</dt>
                    <dd className="tnum shrink-0 text-ink-500">{lakh(s.costLakh)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {result.after.skipped.length > 0 && (
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
                <p className="label mb-2 !text-flow-moderate">Skipped as ineligible</p>
                {result.after.skipped.slice(0, 4).map((s, i) => (
                  <p key={i} className="text-2xs leading-relaxed text-ink-500">
                    {s.corridor ? `${s.corridor} — ` : ''}
                    {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead title="Corridor detail" subtitle="Every monitored corridor, before and after" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-left text-2xs text-ink-600" style={{ borderBottom: '1px solid var(--rule)' }}>
                <th className="py-2.5 pl-5 pr-3 font-medium">Corridor</th>
                <th className="px-3 py-2.5 font-medium">Authority</th>
                <th className="px-3 py-2.5 text-right font-medium">v/c before</th>
                <th className="px-3 py-2.5 text-right font-medium">v/c after</th>
                <th className="px-3 py-2.5 text-right font-medium">Speed</th>
                <th className="px-3 py-2.5 text-right font-medium">Delay</th>
                <th className="px-3 py-2.5 text-center font-medium">LOS</th>
                <th className="py-2.5 pl-3 pr-5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.045]">
              {[...result.comparison]
                .sort((x, y) => x.delta.congestionIndex - y.delta.congestionIndex)
                .map((c) => (
                  <tr key={c.code} className="row-hover">
                    <td className="py-2.5 pl-5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-6 w-[2px] shrink-0 rounded-full" style={{ background: vcColor(c.after.vc) }} />
                        <span className="truncate text-[13px] text-bone-100">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <AuthorityTag code={c.jurisdiction} />
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-xs text-ink-500">{num(c.before.vc, 2)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-xs font-medium text-bone-50">{num(c.after.vc, 2)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-xs text-bone-200">{num(c.after.avgSpeed, 1)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-xs text-bone-300">{num(c.after.delayMin, 1)}m</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {c.losChanged && (
                          <>
                            <span className="tnum text-2xs text-ink-600">{c.before.los}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-ink-600" />
                          </>
                        )}
                        <LosBadge los={c.after.los} />
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right">
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

function Row({ label, value, good }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={cx('tnum font-medium', good ? 'text-flow-free' : 'text-bone-100')}>{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------- recommendations */

function Recommendations({ advice, onLoadPackage, onApplyOne }) {
  if (!advice) return null;
  const { recommendations, hotspots, suggestedPackage, candidatesEvaluated, computeMs } = advice;

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-bone-50">Recommended package</p>
            <p className="mt-1.5 text-xs leading-relaxed text-bone-400">{suggestedPackage.labels.join(' · ')}</p>
            <p className="tnum mt-2 text-2xs text-ink-600">
              {lakh(suggestedPackage.estimatedCostLakh)} capex · live in {suggestedPackage.maxDeployDays} days ·{' '}
              {candidatesEvaluated} candidate interventions simulated in {computeMs} ms
            </p>
          </div>
          <button type="button" onClick={onLoadPackage} className="btn-primary shrink-0">
            Load into studio
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </Panel>

      {recommendations.length === 0 ? (
        <Panel>
          <EmptyState
            title="No intervention is warranted"
            description="No corridor in this window is saturated enough for a strategy to produce a net network benefit."
          />
        </Panel>
      ) : (
        <Panel className="divide-y divide-white/[0.06]">
          {recommendations.map((rec, i) => (
            <RecommendationRow key={rec.id} rec={rec} rank={i + 1} onApply={() => onApplyOne(rec)} />
          ))}
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <PanelHead title="Diagnosed hotspots" subtitle="Why each corridor is failing in this window" />
        <div className="divide-y divide-white/[0.045]">
          {hotspots.map((h) => (
            <div key={h.code} className="flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 h-8 w-[2px] shrink-0 rounded-full" style={{ background: vcColor(h.vc) }} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <p className="truncate text-xs font-medium text-bone-100">{h.name}</p>
                    <AuthorityTag code={h.jurisdiction} />
                    <LosBadge los={h.los} />
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-ink-500">
                    {h.evidence.length ? h.evidence.join('; ') : `Running at ${num(h.vc * 100, 0)}% of capacity.`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-6 pl-5 lg:pl-0">
                <div className="text-right">
                  <p className="label">Primary cause</p>
                  <p className="mt-1 text-2xs font-medium text-flow-heavy">{h.primaryCause}</p>
                </div>
                <div className="text-right">
                  <p className="label">Speed</p>
                  <p className="tnum mt-1 text-2xs font-medium text-bone-200">{num(h.avgSpeed, 1)} km/h</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RecommendationRow({ rec, rank, onApply }) {
  const priorityColor = {
    Critical: STATUS.severe.color,
    High: STATUS.heavy.color,
    Medium: STATUS.moderate.color,
  }[rec.priority];

  return (
    <div className="row-hover flex flex-col gap-5 p-5 lg:flex-row">
      <span className="tnum hidden w-6 shrink-0 pt-0.5 text-sm text-ink-600 lg:block">
        {String(rank).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-sm font-medium text-bone-50">{rec.strategyName}</h3>
          <span className="text-2xs text-ink-600">on</span>
          <span className="text-sm text-bone-200">{rec.corridorName}</span>
          <AuthorityTag code={rec.jurisdiction} />
          <span className="text-2xs font-medium" style={{ color: priorityColor }}>
            {rec.priority}
          </span>
        </div>

        <p className="mt-2.5 max-w-[92ch] text-xs leading-relaxed text-bone-400">{rec.rationale}</p>

        <dl className="mt-3.5 flex flex-wrap gap-x-7 gap-y-2 text-2xs">
          <Fact label="Network delay" value={`−${num(rec.expected.delayReductionPct, 1)}%`} good />
          <Fact label="Corridor speed" value={`+${num(rec.expected.speedGainPct, 1)}%`} good />
          <Fact label="Capex" value={lakh(rec.expected.costLakh)} />
          <Fact label="Payback" value={rec.expected.paybackMonths != null ? `${num(rec.expected.paybackMonths, 1)} mo` : '—'} />
          <Fact label="Live in" value={`${rec.deployDays} days`} />
          {rec.expected.worsened > 0 && (
            <Fact label="Spillover" value={`${rec.expected.worsened} corridor${rec.expected.worsened > 1 ? 's' : ''}`} bad />
          )}
        </dl>
      </div>

      <div className="flex shrink-0 items-end gap-5 lg:w-40 lg:flex-col lg:items-stretch lg:justify-between">
        <div className="flex-1 lg:flex-none">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label">Score</span>
            <span className="tnum text-lg font-medium leading-none text-bone-50">{num(rec.score, 1)}</span>
          </div>
          <MiniBar value={rec.score} max={100} color="#e2ded7" className="mt-2" />
          <p className="tnum mt-2 text-[10px] text-ink-600">Confidence {Math.round(rec.confidence * 100)}%</p>
        </div>
        <button type="button" onClick={onApply} className="btn-ghost shrink-0 !text-xs lg:w-full">
          Simulate this
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value, good, bad }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-ink-600">{label}</dt>
      <dd className={cx('tnum font-medium', good ? 'text-flow-free' : bad ? 'text-flow-severe' : 'text-bone-200')}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------ jurisdiction view */

function JurisdictionBalance({ advisory, jurisdictions }) {
  if (!advisory) return null;

  const severityColor = {
    high: STATUS.severe.color,
    moderate: STATUS.heavy.color,
    low: STATUS.free.color,
  }[advisory.severity];

  const maxLoad = Math.max(...advisory.rows.map((r) => r.loadPerLaneKm), 1);

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="flex items-baseline gap-3">
          <span className="h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full" style={{ background: severityColor }} />
          <div>
            <p className="text-sm font-medium text-bone-50">{advisory.headline}</p>
            <ul className="mt-3 space-y-2">
              {advisory.notes.map((n, i) => (
                <li key={i} className="max-w-[100ch] text-xs leading-relaxed text-bone-400">
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHead title="Authority breakdown" subtitle="Vehicle-km carried per lane-km of road owned" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-left text-2xs text-ink-600" style={{ borderBottom: '1px solid var(--rule)' }}>
                <th className="py-2.5 pl-5 pr-3 font-medium">Authority</th>
                <th className="w-52 px-3 py-2.5 font-medium">Load per lane-km</th>
                <th className="px-3 py-2.5 text-right font-medium">Corridors</th>
                <th className="px-3 py-2.5 text-right font-medium">Lane-km</th>
                <th className="py-2.5 pl-3 pr-5 text-right font-medium">Avg v/c</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.045]">
              {advisory.rows.map((r) => (
                <tr key={r.jurisdiction} className="row-hover">
                  <td className="py-3 pl-5 pr-3">
                    <div className="flex items-baseline gap-2.5">
                      <AuthorityTag code={r.jurisdiction} />
                      <span className="hidden truncate text-2xs text-ink-500 sm:inline">
                        {jurisdictions[r.jurisdiction]?.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <MiniBar value={r.loadPerLaneKm} max={maxLoad} color={AUTHORITY_COLOR[r.jurisdiction]} />
                      <span className="tnum w-12 shrink-0 text-right text-xs text-bone-100">{num(r.loadPerLaneKm)}</span>
                    </div>
                  </td>
                  <td className="tnum px-3 py-3 text-right text-xs text-bone-300">
                    {r.corridors}
                    {r.severeCorridors > 0 && (
                      <span className="ml-1.5 text-2xs text-flow-severe">{r.severeCorridors} LOS F</span>
                    )}
                  </td>
                  <td className="tnum px-3 py-3 text-right text-xs text-bone-300">{num(r.laneKm, 1)}</td>
                  <td className="tnum py-3 pl-3 pr-5 text-right text-xs text-bone-100">{num(r.avgVc, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
