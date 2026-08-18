import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as Icons from 'lucide-react';
import {
  BrainCircuit,
  Check,
  ChevronRight,
  CircleSlash,
  Gauge,
  IndianRupee,
  Layers,
  Play,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useScenario } from '../lib/scenario.jsx';
import PageHeader from '../components/PageHeader.jsx';
import FlowLane from '../components/FlowLane.jsx';
import {
  AuthorityTag,
  DeltaPill,
  EmptyState,
  ErrorNote,
  Panel,
  PanelHead,
  Segmented,
  Slider,
  Spinner,
  StatTile,
  VcMeter,
  cx,
  useToast,
} from '../components/ui.jsx';
import { CHART_AXIS, CHART_GRID, tooltipStyle, vcColor } from '../lib/theme.js';
import { compact, hourLabel, inr, lakh, num } from '../lib/format.js';

/** ~180 ms per 15-minute step: a 3-hour window replays in about two seconds. */
const PLAYBACK_MS = 180;

export default function SimulationStudio() {
  const { strategies, corridors, corridorByCode, eligibility } = useAppData();
  const {
    windowId,
    setWindowId,
    selections,
    setStrategy,
    toggleCorridor,
    removeStrategy,
    clear,
    result,
    setResult,
    focusCorridor,
    setFocusCorridor,
  } = useScenario();
  const toast = useToast();
  const navigate = useNavigate();

  const [baseline, setBaseline] = useState(null);
  const [openPicker, setOpenPicker] = useState(null);
  const [running, setRunning] = useState(false);
  const [playhead, setPlayhead] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const playRef = useRef(null);

  const peakHour = windowId === 'morning' ? 9 : 18;

  // Baseline saturation drives corridor ordering and the "before" flow lanes.
  useEffect(() => {
    api
      .state({ hour: peakHour })
      .then(setBaseline)
      .catch((err) => setError(err.message));
  }, [peakHour]);

  // Arriving from the map with a corridor in hand: pre-target it.
  useEffect(() => {
    if (focusCorridor) setOpenPicker(null);
  }, [focusCorridor]);

  useEffect(() => () => clearInterval(playRef.current), []);

  const baseByCode = useMemo(
    () => Object.fromEntries((baseline?.results || []).map((r) => [r.code, r])),
    [baseline]
  );

  const sortedCorridors = useMemo(
    () => [...corridors].sort((a, b) => (baseByCode[b.code]?.vc || 0) - (baseByCode[a.code]?.vc || 0)),
    [corridors, baseByCode]
  );

  const selectionById = useMemo(
    () => Object.fromEntries(selections.map((s) => [s.strategyId, s])),
    [selections]
  );

  const targetedCodes = useMemo(
    () => [...new Set(selections.flatMap((s) => s.corridorCodes))],
    [selections]
  );

  async function run() {
    if (!selections.length) {
      toast.error('Add at least one strategy before running the simulation');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    setPlayhead(null);
    clearInterval(playRef.current);

    try {
      const res = await api.run({ windowId, selections });
      setResult(res);

      // Play the simulated window back step by step. This is the real timeline
      // the model produced, not a decorative loading bar.
      const total = res.after.timeline.length;
      let i = 0;
      setPlayhead(0);
      playRef.current = setInterval(() => {
        i += 1;
        if (i >= total) {
          clearInterval(playRef.current);
          setPlayhead(total - 1);
          setRunning(false);
          toast.success(
            `Simulation complete — network delay ${res.delta.vehicleDelayPct <= 0 ? 'down' : 'up'} ${Math.abs(res.delta.vehicleDelayPct)}%`
          );
        } else {
          setPlayhead(i);
        }
      }, PLAYBACK_MS);
    } catch (err) {
      setError(err.message);
      setRunning(false);
    }
  }

  async function save() {
    const name = scenarioName.trim();
    if (!name) {
      toast.error('Name the scenario so it can be found later');
      return;
    }
    setSaving(true);
    try {
      await api.saveSimulation({ name, windowId, selections });
      toast.success(`Scenario "${name}" saved`);
      setScenarioName('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const playing = running && playhead != null;
  const frame = result && playhead != null ? result.after.timeline[playhead] : null;
  const frameBefore = result && playhead != null ? result.before.timeline[playhead] : null;

  const timelineData = useMemo(() => {
    if (!result) return [];
    return result.before.timeline.map((b, i) => ({
      label: b.label,
      before: b.congestionIndex,
      after: result.after.timeline[i]?.congestionIndex,
    }));
  }, [result]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        step={3}
        title="Simulation studio"
        subtitle="Compose a traffic management strategy, target the corridors it should apply to, and run it against the model before anything is deployed on the ground."
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
            <button type="button" onClick={clear} disabled={!selections.length} className="btn-ghost !py-2 !text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* ------------------------------------------------- strategy library */}
        <div className="space-y-5">
          <Panel>
            <PanelHead
              title="Strategy library"
              subtitle="Eight interventions a Nagpur authority could actually fund"
              icon={Layers}
              actions={
                <span className="tnum chip bg-white/[0.06] text-slate-400">
                  {selections.length} active
                </span>
              }
            />
            <div className="grid gap-2.5 p-4 sm:grid-cols-2">
              {strategies.map((s) => {
                const active = !!selectionById[s.id];
                const Icon = Icons[s.icon] || Sparkles;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOpenPicker(openPicker === s.id ? null : s.id)}
                    className={cx(
                      'group rounded-xl border p-3.5 text-left transition-all',
                      active
                        ? 'border-brand-500/45 bg-brand-500/[0.08]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cx(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors',
                          active
                            ? 'border-brand-500/40 bg-brand-500/15 text-brand-300'
                            : 'border-white/[0.08] bg-white/[0.04] text-slate-400 group-hover:text-brand-300'
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-100">{s.name}</p>
                          {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-400" strokeWidth={3} />}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{s.tagline}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="chip bg-white/[0.06] text-slate-400">{s.category}</span>
                          <span className="chip bg-white/[0.06] text-slate-500">{s.deployDays}d lead</span>
                          {active && (
                            <span className="tnum chip bg-brand-500/15 text-brand-300">
                              {selectionById[s.id].corridorCodes.length} corridors
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Corridor picker for the strategy being configured */}
          {openPicker && (
            <CorridorPicker
              strategy={strategies.find((s) => s.id === openPicker)}
              selection={selectionById[openPicker]}
              corridors={sortedCorridors}
              baseByCode={baseByCode}
              eligible={eligibility[openPicker] || []}
              focusCorridor={focusCorridor}
              onClearFocus={() => setFocusCorridor(null)}
              onToggle={(code) => toggleCorridor(openPicker, code)}
              onIntensity={(v) => setStrategy(openPicker, { intensity: v })}
              onClose={() => setOpenPicker(null)}
              onRemove={() => {
                removeStrategy(openPicker);
                setOpenPicker(null);
              }}
            />
          )}

          {/* --------------------------------------------- run + playback */}
          {result && (
            <Panel>
              <PanelHead
                title={playing ? 'Playing back simulated window' : 'Simulation result'}
                subtitle={
                  playing
                    ? `${frame?.label} — stepping through ${result.window.label.toLowerCase()}`
                    : `Solved in ${result.computeMs} ms across ${result.after.timeline.length} time steps`
                }
                icon={Gauge}
                actions={
                  <button type="button" onClick={() => navigate('/results')} className="btn-primary !py-1.5 !text-xs">
                    Full comparison
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                }
              />

              <div className="space-y-4 p-4">
                {/* playback scrubber */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="tnum">{result.before.timeline[0]?.label}</span>
                    <span className="tnum font-semibold text-brand-300">{frame?.label}</span>
                    <span className="tnum">{result.before.timeline.at(-1)?.label}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={cx('h-full rounded-full bg-brand-400 transition-[width] duration-150', playing && 'stripe')}
                      style={{
                        width: `${(((playhead ?? 0) + 1) / result.after.timeline.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <StatTile
                    label="Congestion index"
                    value={num(frame?.congestionIndex, 1)}
                    unit={`vs ${num(frameBefore?.congestionIndex, 1)}`}
                    tone="brand"
                  />
                  <StatTile label="Network speed" value={num(frame?.avgSpeed, 1)} unit="km/h" />
                  <StatTile label="Delay this step" value={compact(frame?.delayHours)} unit="veh-hr" />
                  <StatTile label="Corridors congested" value={`${frame?.congestedCorridors ?? 0}`} unit={`of ${corridors.length}`} />
                </div>

                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="label" stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis stroke={CHART_AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                      <Tooltip {...tooltipStyle} formatter={(v, n) => [num(v, 1), n === 'before' ? 'Do nothing' : 'With strategy']} />
                      {frame && <ReferenceLine x={frame.label} stroke="#22d3ee" strokeWidth={1.5} />}
                      <Line type="monotone" dataKey="before" name="before" stroke="#fb7185" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                      <Line type="monotone" dataKey="after" name="after" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-5 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-rose-400" /> Do nothing
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full bg-brand-400" /> With strategy
                  </span>
                </div>

                {/* Traffic flow visualisation on targeted corridors */}
                {targetedCodes.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Traffic flow on targeted corridors — design hour {result.after.designHourLabel}
                    </p>
                    <div className="space-y-3">
                      {targetedCodes.slice(0, 4).map((code) => {
                        const row = result.comparison.find((c) => c.code === code);
                        if (!row) return null;
                        return (
                          <div key={code}>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-200">{row.name}</span>
                              <AuthorityTag code={row.jurisdiction} />
                              <DeltaPill value={row.delta.speedPct} className="ml-auto" />
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <FlowLane result={row.before} label="Do nothing" sublabel={`${num(row.before.delayMin, 1)} min delay`} />
                              <FlowLane result={row.after} label="With strategy" sublabel={`${num(row.after.delayMin, 1)} min delay`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* ----------------------------------------------------- scenario rail */}
        <div className="space-y-5">
          <Panel>
            <PanelHead title="Scenario" subtitle={windowId === 'morning' ? '09:00 – 12:00' : '16:00 – 19:00'} icon={Layers} />
            <div className="p-4">
              {selections.length === 0 ? (
                <EmptyState
                  icon={CircleSlash}
                  title="No strategies selected"
                  description="Pick a strategy from the library and choose which corridors it applies to."
                  className="!py-8"
                />
              ) : (
                <div className="space-y-2">
                  {selections.map((sel) => {
                    const s = strategies.find((x) => x.id === sel.strategyId);
                    const Icon = Icons[s?.icon] || Sparkles;
                    return (
                      <div key={sel.strategyId} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                        <div className="flex items-start gap-2.5">
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" strokeWidth={2} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-200">{s?.name}</p>
                            <p className="tnum mt-0.5 text-[10px] text-slate-500">
                              {Math.round(sel.intensity * 100)}% intensity · {sel.corridorCodes.length} corridor
                              {sel.corridorCodes.length === 1 ? '' : 's'}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {sel.corridorCodes.map((code) => (
                                <span key={code} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-400">
                                  {corridorByCode[code]?.shortName || code}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStrategy(sel.strategyId)}
                            className="shrink-0 rounded p-1 text-slate-600 hover:text-rose-400"
                            aria-label={`Remove ${s?.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={run}
                disabled={running || !selections.length}
                className="btn-primary mt-4 w-full"
              >
                {running ? <Spinner /> : <Play className="h-4 w-4" strokeWidth={2.5} />}
                {running ? 'Simulating…' : 'Run simulation'}
              </button>

              {result && (
                <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Delay" value={`${num(result.delta.vehicleDelayPct, 1)}%`} good={result.delta.vehicleDelayPct < 0} />
                    <MiniStat label="Speed" value={`${num(result.delta.avgSpeedPct, 1)}%`} good={result.delta.avgSpeedPct > 0} />
                    <MiniStat label="CO₂" value={`${num(result.delta.co2Pct, 1)}%`} good={result.delta.co2Pct < 0} />
                    <MiniStat label="Cost" value={lakh(result.economics.capexLakh)} neutral />
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Payback</span>
                      <span className="tnum font-semibold text-slate-200">
                        {result.economics.paybackMonths != null ? `${num(result.economics.paybackMonths, 1)} months` : 'No saving'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span>Annual saving</span>
                      <span className="tnum font-semibold text-emerald-300">{lakh(result.economics.annualSavingLakh)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span>Deployment</span>
                      <span className="tnum font-semibold text-slate-200">{result.economics.deployDays} days</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="Name this scenario…"
                      className="field !py-2 !text-xs"
                    />
                    <button type="button" onClick={save} disabled={saving} className="btn-ghost w-full !text-xs">
                      {saving ? <Spinner /> : <Save className="h-3.5 w-3.5" />}
                      Save scenario
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Not sure where to start?" icon={BrainCircuit} />
            <div className="p-4">
              <p className="text-[11px] leading-relaxed text-slate-500">
                The recommendation engine diagnoses every congested corridor and simulates the
                strategies that treat it, then ranks them by outcome and cost.
              </p>
              <button type="button" onClick={() => navigate('/results')} className="btn-ghost mt-3 w-full !text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Open AI recommendations
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, good, neutral }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cx(
          'tnum mt-1 text-sm font-bold',
          neutral ? 'text-slate-200' : good ? 'text-emerald-300' : 'text-rose-300'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CorridorPicker({
  strategy,
  selection,
  corridors,
  baseByCode,
  eligible,
  focusCorridor,
  onClearFocus,
  onToggle,
  onIntensity,
  onClose,
  onRemove,
}) {
  const [query, setQuery] = useState('');
  const selected = selection?.corridorCodes || [];
  const eligibleSet = useMemo(() => new Set(eligible), [eligible]);

  // A corridor carried over from the map gets auto-targeted once, if eligible.
  useEffect(() => {
    if (focusCorridor && eligibleSet.has(focusCorridor) && !selected.includes(focusCorridor)) {
      onToggle(focusCorridor);
      onClearFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCorridor, eligibleSet]);

  const filtered = corridors.filter((c) =>
    `${c.shortName} ${c.code} ${c.jurisdiction}`.toLowerCase().includes(query.toLowerCase())
  );

  const Icon = Icons[strategy?.icon] || Sparkles;

  return (
    <Panel>
      <PanelHead
        title={`Target corridors — ${strategy?.name}`}
        subtitle={strategy?.description}
        icon={Icon}
        actions={
          <>
            {selected.length > 0 && (
              <button type="button" onClick={onRemove} className="btn-danger !py-1.5 !text-xs">
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:text-slate-300" aria-label="Close picker">
              <X className="h-4 w-4" />
            </button>
          </>
        }
      />

      <div className="space-y-4 p-4">
        {selected.length > 0 && (
          <Slider
            label="Deployment intensity"
            value={selection.intensity}
            onChange={onIntensity}
            min={0.2}
            max={1}
            step={0.05}
          />
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search corridors…"
            className="field !py-2 pl-8 !text-xs"
          />
        </div>

        {strategy?.requirementHint && (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-slate-500">
            Eligibility: {strategy.requirementHint}. Ineligible corridors are dimmed.
          </p>
        )}

        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {filtered.map((c) => {
            const r = baseByCode[c.code];
            const isEligible = eligibleSet.has(c.code);
            const isOn = selected.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                disabled={!isEligible}
                onClick={() => onToggle(c.code)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                  isOn
                    ? 'border-brand-500/45 bg-brand-500/[0.09]'
                    : isEligible
                      ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                      : 'cursor-not-allowed border-white/[0.04] bg-white/[0.01] opacity-35'
                )}
              >
                <span
                  className={cx(
                    'grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors',
                    isOn ? 'border-brand-400 bg-brand-400' : 'border-white/20'
                  )}
                >
                  {isOn && <Check className="h-3 w-3 text-ink-950" strokeWidth={3.5} />}
                </span>
                <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: vcColor(r?.vc || 0) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{c.shortName}</p>
                  <div className="mt-1">{r && <VcMeter vc={r.vc} />}</div>
                </div>
                <AuthorityTag code={c.jurisdiction} className="shrink-0" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-slate-500">
          <span className="tnum">
            {selected.length} selected · {eligible.length} eligible of {corridors.length}
          </span>
          <button type="button" onClick={onClose} className="btn-ghost !py-1.5 !text-xs">
            Done
          </button>
        </div>
      </div>
    </Panel>
  );
}
