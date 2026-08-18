import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Beaker,
  FileText,
  Layers,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
  DeltaPill,
  EmptyState,
  ErrorNote,
  Loading,
  Panel,
  PanelHead,
  Segmented,
  cx,
  useToast,
} from '../components/ui.jsx';
import { dateLabel, lakh, num } from '../lib/format.js';

export default function Reports() {
  const { canApply } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([api.reports(), api.simulations()]);
      setReports(r.reports);
      setSimulations(s.simulations);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generateFrom(sim) {
    try {
      const { report } = await api.createReport({
        simulationId: sim._id,
        title: `Traffic Management Report — ${sim.name}`,
      });
      toast.success(`Report ${report.refId} generated`);
      navigate(`/reports/${report._id}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function removeSimulation(sim) {
    try {
      await api.deleteSimulation(sim._id);
      toast.success('Scenario deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function removeReport(report) {
    try {
      await api.deleteReport(report._id);
      toast.success('Report deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        step={6}
        title="Scenarios & reports"
        subtitle="Saved strategies and the signed reports generated from them — each one a frozen record of what was simulated and what it was expected to achieve."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'reports', label: `Reports (${reports.length})` },
              { value: 'scenarios', label: `Scenarios (${simulations.length})` },
            ]}
          />
        }
      />

      <ErrorNote>{error}</ErrorNote>

      {loading ? (
        <Panel>
          <Loading label="Loading records" />
        </Panel>
      ) : tab === 'reports' ? (
        <Panel>
          <PanelHead title="Generated reports" icon={FileText} />
          {reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Run a simulation, then use 'Apply & generate report' on the Results screen to produce a citable document."
            />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {reports.map((r) => (
                <div key={r._id} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => navigate(`/reports/${r._id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-500/25 bg-brand-500/10 text-brand-300">
                      <FileText className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{r.title}</p>
                      <p className="tnum mt-0.5 truncate text-[11px] text-slate-500">
                        {r.refId} · {r.generatedByName} · {dateLabel(r.createdAt)}
                      </p>
                    </div>
                  </button>
                  <span className="chip shrink-0 bg-white/[0.06] text-slate-400">
                    {r.windowId === 'morning' ? 'AM peak' : 'PM peak'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReport(r)}
                    className="shrink-0 rounded p-1.5 text-slate-600 transition-colors hover:text-rose-400"
                    aria-label="Delete report"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <PanelHead title="Saved scenarios" icon={Layers} />
          {simulations.length === 0 ? (
            <EmptyState
              icon={Beaker}
              title="No saved scenarios"
              description="Save a scenario from the Simulation Studio to keep its exact strategy mix and results."
            />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {simulations.map((s) => (
                <div key={s._id} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div
                      className={cx(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
                        s.status === 'applied'
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/[0.08] bg-white/[0.04] text-slate-400'
                      )}
                    >
                      {s.status === 'applied' ? <BadgeCheck className="h-4 w-4" /> : <Beaker className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-200">{s.name}</p>
                        {s.status === 'applied' && (
                          <span className="chip bg-emerald-500/12 text-emerald-300">Applied</span>
                        )}
                      </div>
                      <p className="tnum mt-0.5 truncate text-[11px] text-slate-500">
                        {s.createdByName} · {dateLabel(s.createdAt)} · {s.selections.length} strateg
                        {s.selections.length === 1 ? 'y' : 'ies'} · {s.windowId === 'morning' ? '09–12' : '16–19'}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-4 pl-12 lg:pl-0">
                    <Metric label="Delay" delta={s.summary?.vehicleDelayPct} goodWhenNegative />
                    <Metric label="Speed" delta={s.summary?.avgSpeedPct} />
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wider text-slate-600">Capex</p>
                      <p className="tnum text-[11px] font-semibold text-slate-300">{lakh(s.summary?.capexLakh)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wider text-slate-600">Payback</p>
                      <p className="tnum text-[11px] font-semibold text-slate-300">
                        {s.summary?.paybackMonths != null ? `${num(s.summary.paybackMonths, 1)} mo` : '—'}
                      </p>
                    </div>
                    <button type="button" onClick={() => generateFrom(s)} className="btn-ghost !py-1.5 !text-xs">
                      <FileText className="h-3.5 w-3.5" />
                      Report
                    </button>
                    {canApply && (
                      <button
                        type="button"
                        onClick={() => removeSimulation(s)}
                        className="rounded p-1.5 text-slate-600 transition-colors hover:text-rose-400"
                        aria-label="Delete scenario"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {!loading && tab === 'scenarios' && simulations.length > 0 && (
        <p className="flex items-center gap-2 px-1 text-[11px] text-slate-600">
          <TriangleAlert className="h-3 w-3" />
          Applied scenarios represent the plan currently committed to the network.
        </p>
      )}
    </div>
  );
}

function Metric({ label, delta, goodWhenNegative }) {
  return (
    <div className="text-right">
      <p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p>
      <DeltaPill value={delta} goodWhenNegative={goodWhenNegative} />
    </div>
  );
}
