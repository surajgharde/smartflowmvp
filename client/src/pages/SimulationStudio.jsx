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
import { ArrowRight, Play, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAppData } from '../lib/appData.jsx';
import { useScenario } from '../lib/scenario.jsx';
import PageHeader from '../components/PageHeader.jsx';
import FlowLane from '../components/FlowLane.jsx';
import {
  AuthorityTag,
  Checkbox,
  DeltaPill,
  EmptyState,
  ErrorNote,
  Panel,
  PanelHead,
  Segmented,
  Slider,
  Spinner,
  VcMeter,
  cx,
  useToast,
} from '../components/ui.jsx';
import { CHART_AXIS, CHART_GRID, SERIES, tooltipStyle, vcColor } from '../lib/theme.js';
import { compact, lakh, num } from '../lib/format.js';

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

  useEffect(() => {
    api
      .state({ hour: peakHour })
      .then(setBaseline)
      .catch((err) => setError(err.message));
  }, [peakHour]);

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

  // Arriving from the map with a corridor in hand: open a strategy it qualifies for.
  useEffect(() => {
    if (!focusCorridor || !strategies.length) return;
    const match = strategies.find((s) => (eligibility[s.id] || []).includes(focusCorridor));
    if (match) setOpenPicker(match.id);
  }, [focusCorridor, strategies, eligibility]);

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

      // Play back the timeline the model actually produced, step by step.
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
      baseline: b.congestionIndex,
      treatment: result.after.timeline[i]?.congestionIndex,
    }));
  }, [result]);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        step={3}
        title="Simulation studio"
        subtitle="Compose a management strategy, target the corridors it applies to, and run it against the model before anything is deployed on the ground."
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
            <button type="button" onClick={clear} disabled={!selections.length} className="btn-quiet">
              Reset
            </button>
          </>
        }
      />

      <ErrorNote>{error}</ErrorNote>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          {/* ---------------------------------------------- strategy library */}
          <Panel>
            <PanelHead
              title="Strategy library"
              subtitle="Eight interventions a Nagpur authority could actually fund"
              actions={<span className="tnum text-2xs text-ink-500">{selections.length} active</span>}
            />
            {/*
              Cell rules come from responsive utilities rather than index maths, so
              the grid reads correctly at one column as well as two.
            */}
            <div className="grid sm:grid-cols-2">
              {strategies.map((s) => {
                const sel = selectionById[s.id];
                const active = !!sel;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOpenPicker(openPicker === s.id ? null : s.id)}
                    className={cx(
                      'row-hover group relative border-b border-white/[0.07] px-5 py-4 text-left transition-colors',
                      'sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0',
                      'last:border-b-0',
                      active && 'bg-white/[0.035]'
                    )}
                  >
                    {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-bone-100" />}
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={cx('text-[13px]', active ? 'font-medium text-bone-50' : 'text-bone-200')}>
                        {s.name}
                      </p>
                      {active && (
                        <span className="tnum shrink-0 text-2xs text-bone-400">
                          {sel.corridorCodes.length} · {Math.round(sel.intensity * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-2xs leading-relaxed text-ink-500">{s.tagline}</p>
                    <p className="tnum mt-2.5 text-[10px] text-ink-600">
                      {s.category} · {s.deployDays}d lead time
                    </p>
                  </button>
                );
              })}
            </div>
          </Panel>

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

          {/* -------------------------------------------- run + playback */}
          {result && (
            <Panel>
              <PanelHead
                title={playing ? `Replaying ${frame?.label}` : 'Simulation result'}
                subtitle={
                  playing
                    ? `Stepping through ${result.window.label.toLowerCase()} at 15-minute resolution`
                    : `Solved in ${result.computeMs} ms across ${result.after.timeline.length} time steps`
                }
                actions={
                  <button type="button" onClick={() => navigate('/results')} className="btn-primary !py-1.5 !text-xs">
                    Full comparison
                    <ArrowRight className="h-3 w-3" strokeWidth={2.25} />
                  </button>
                }
              />

              <div className="space-y-5 p-5">
                <div>
                  <div className="tnum mb-2 flex items-baseline justify-between text-2xs text-ink-600">
                    <span>{result.before.timeline[0]?.label}</span>
                    <span className="text-bone-100">{frame?.label}</span>
                    <span>{result.before.timeline.at(-1)?.label}</span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-bone-100 transition-[width] duration-150"
                      style={{ width: `${(((playhead ?? 0) + 1) / result.after.timeline.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <PlaybackStat label="Congestion index" value={num(frame?.congestionIndex, 1)} was={num(frameBefore?.congestionIndex, 1)} />
                  <PlaybackStat label="Network speed" value={`${num(frame?.avgSpeed, 1)}`} was={`${num(frameBefore?.avgSpeed, 1)}`} unit="km/h" />
                  <PlaybackStat label="Delay this step" value={compact(frame?.delayHours)} was={compact(frameBefore?.delayHours)} unit="veh-hr" />
                  <PlaybackStat label="Congested" value={`${frame?.congestedCorridors ?? 0}`} was={`${frameBefore?.congestedCorridors ?? 0}`} unit={`of ${corridors.length}`} />
                </div>

                <div className="h-[172px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="label" stroke={CHART_AXIS} tick={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace' }} tickLine={false} axisLine={false} />
                      <YAxis stroke={CHART_AXIS} tick={{ fontSize: 9, fontFamily: '"IBM Plex Mono", monospace' }} tickLine={false} axisLine={false} width={30} />
                      <Tooltip {...tooltipStyle} formatter={(v, n) => [num(v, 1), n === 'baseline' ? 'Do nothing' : 'With strategy']} />
                      {frame && <ReferenceLine x={frame.label} stroke="#e2ded7" strokeWidth={1} strokeDasharray="3 3" />}
                      <Line type="monotone" dataKey="baseline" name="baseline" stroke={SERIES.baseline} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                      <Line type="monotone" dataKey="treatment" name="treatment" stroke={SERIES.treatment} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 text-2xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-4" style={{ background: SERIES.baseline }} /> Do nothing
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2px] w-4" style={{ background: SERIES.treatment }} /> With strategy
                  </span>
                </div>

                {targetedCodes.length > 0 && (
                  <div className="pt-1">
                    <p className="label mb-3">
                      Traffic flow on targeted corridors — design hour {result.after.designHourLabel}
                    </p>
                    <div className="space-y-4">
                      {targetedCodes.slice(0, 4).map((code) => {
                        const row = result.comparison.find((c) => c.code === code);
                        if (!row) return null;
                        return (
                          <div key={code}>
                            <div className="mb-2 flex items-baseline gap-2.5">
                              <span className="text-xs font-medium text-bone-100">{row.name}</span>
                              <AuthorityTag code={row.jurisdiction} />
                              <DeltaPill value={row.delta.speedPct} className="ml-auto" />
                            </div>
                            <div className="grid gap-2.5 sm:grid-cols-2">
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

        {/* ---------------------------------------------------- scenario rail */}
        <div className="space-y-6">
          <Panel className="self-start">
            <PanelHead title="Scenario" subtitle={windowId === 'morning' ? '09:00 – 12:00' : '16:00 – 19:00'} />
            <div className="p-5">
              {selections.length === 0 ? (
                <EmptyState
                  title="No strategies selected"
                  description="Pick one from the library and choose which corridors it applies to."
                  className="!py-10 !px-0"
                />
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {selections.map((sel) => {
                    const s = strategies.find((x) => x.id === sel.strategyId);
                    return (
                      <div key={sel.strategyId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-bone-100">{s?.name}</p>
                          <p className="tnum mt-1 text-2xs text-ink-500">
                            {Math.round(sel.intensity * 100)}% intensity
                          </p>
                          <p className="mt-1.5 text-2xs leading-relaxed text-ink-600">
                            {sel.corridorCodes.map((c) => corridorByCode[c]?.shortName || c).join(' · ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStrategy(sel.strategyId)}
                          className="shrink-0 rounded p-1 text-ink-600 hover:text-flow-severe"
                          aria-label={`Remove ${s?.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="button" onClick={run} disabled={running || !selections.length} className="btn-primary mt-5 w-full">
                {running ? <Spinner /> : <Play className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {running ? 'Simulating…' : 'Run simulation'}
              </button>

              {result && (
                <div className="mt-5 space-y-4 pt-5" style={{ borderTop: '1px solid var(--rule)' }}>
                  <dl className="space-y-2.5 text-xs">
                    <Line2 label="Vehicle delay" value={`${num(result.delta.vehicleDelayPct, 1)}%`} good={result.delta.vehicleDelayPct < 0} />
                    <Line2 label="Network speed" value={`${num(result.delta.avgSpeedPct, 1)}%`} good={result.delta.avgSpeedPct > 0} />
                    <Line2 label="CO₂" value={`${num(result.delta.co2Pct, 1)}%`} good={result.delta.co2Pct < 0} />
                  </dl>
                  <dl className="space-y-2.5 pt-4 text-xs" style={{ borderTop: '1px solid var(--rule)' }}>
                    <Line2 label="Capital cost" value={lakh(result.economics.capexLakh)} />
                    <Line2
                      label="Payback"
                      value={result.economics.paybackMonths != null ? `${num(result.economics.paybackMonths, 1)} months` : 'No saving'}
                    />
                    <Line2 label="Deployment" value={`${result.economics.deployDays} days`} />
                  </dl>

                  <div className="space-y-2 pt-1">
                    <input
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="Name this scenario…"
                      className="field !py-2 !text-xs"
                    />
                    <button type="button" onClick={save} disabled={saving} className="btn-ghost w-full !text-xs">
                      {saving ? <Spinner /> : null}
                      Save scenario
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="self-start p-5">
            <p className="text-xs font-medium text-bone-100">Not sure where to start?</p>
            <p className="mt-2 text-2xs leading-relaxed text-ink-500">
              The recommendation engine diagnoses every congested corridor, simulates the strategies
              that treat it, and ranks them by outcome and cost.
            </p>
            <button type="button" onClick={() => navigate('/results')} className="btn-ghost mt-4 w-full !text-xs">
              Open recommendations
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PlaybackStat({ label, value, was, unit }) {
  return (
    <div>
      <p className="label truncate">{label}</p>
      <p className="tnum mt-1.5 text-xl font-medium leading-none text-bone-50">{value}</p>
      <p className="tnum mt-1.5 text-2xs text-ink-600">
        {unit ? `${unit} · ` : ''}was {was}
      </p>
    </div>
  );
}

function Line2({ label, value, good }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={cx('tnum font-medium', good == null ? 'text-bone-100' : good ? 'text-flow-free' : 'text-flow-severe')}>
        {value}
      </dd>
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

  // A corridor carried over from the map gets targeted once, if it qualifies.
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

  return (
    <Panel>
      <PanelHead
        title={`Target corridors — ${strategy?.name}`}
        actions={
          <>
            {selected.length > 0 && (
              <button type="button" onClick={onRemove} className="btn-quiet !text-flow-severe">
                Remove
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded p-1 text-ink-500 hover:text-bone-200" aria-label="Close picker">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        }
      />

      <div className="space-y-5 p-5">
        <p className="max-w-[70ch] text-xs leading-relaxed text-ink-500">{strategy?.description}</p>

        {selected.length > 0 && (
          <Slider label="Deployment intensity" value={selection.intensity} onChange={onIntensity} min={0.2} max={1} step={0.05} />
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search corridors…"
            className="field !py-2 pl-9 !text-xs"
          />
        </div>

        {strategy?.requirementHint && (
          <p className="text-2xs text-ink-600">
            Eligibility — {strategy.requirementHint}. Ineligible corridors are dimmed.
          </p>
        )}

        <div className="max-h-[330px] divide-y divide-white/[0.045] overflow-y-auto">
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
                  'flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors',
                  isEligible ? 'hover:bg-white/[0.03]' : 'cursor-not-allowed opacity-30'
                )}
              >
                <Checkbox checked={isOn} />
                <span className="h-6 w-[2px] shrink-0 rounded-full" style={{ background: vcColor(r?.vc || 0) }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cx('truncate text-xs', isOn ? 'text-bone-50' : 'text-bone-200')}>{c.shortName}</p>
                    <AuthorityTag code={c.jurisdiction} className="shrink-0" />
                  </div>
                  <div className="mt-1.5">{r && <VcMeter vc={r.vc} />}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="tnum flex items-center justify-between pt-1 text-2xs text-ink-600">
          <span>
            {selected.length} selected · {eligible.length} eligible of {corridors.length}
          </span>
          <button type="button" onClick={onClose} className="btn-quiet">
            Done
          </button>
        </div>
      </div>
    </Panel>
  );
}
