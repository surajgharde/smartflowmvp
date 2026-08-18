import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Trash2 } from 'lucide-react';
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
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        step={6}
        title="Scenarios & reports"
        subtitle="Saved strategies and the signed reports generated from them — each a frozen record of what was simulated and what it was expected to achieve."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            size="sm"
            options={[
              { value: 'reports', label: `Reports ${reports.length}` },
              { value: 'scenarios', label: `Scenarios ${simulations.length}` },
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
        <Panel className="overflow-hidden">
          <PanelHead title="Generated reports" />
          {reports.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Run a simulation, then use ‘Apply & generate report’ on the Results screen to produce a citable document."
            />
          ) : (
            <div className="divide-y divide-white/[0.045]">
              {reports.map((r) => (
                <div key={r._id} className="row-hover flex items-center gap-4 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/reports/${r._id}`)}
                    className="group flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <span className="tnum shrink-0 text-2xs text-ink-600">{r.refId}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-bone-100">{r.title}</p>
                      <p className="tnum mt-0.5 truncate text-2xs text-ink-600">
                        {r.generatedByName} · {dateLabel(r.createdAt)}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-600 transition-colors group-hover:text-bone-200" />
                  </button>
                  <span className="shrink-0 text-2xs text-ink-500">
                    {r.windowId === 'morning' ? 'AM peak' : 'PM peak'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReport(r)}
                    className="shrink-0 rounded p-1.5 text-ink-600 transition-colors hover:text-flow-severe"
                    aria-label="Delete report"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <PanelHead title="Saved scenarios" subtitle="Applied scenarios are the plan committed to the network" />
          {simulations.length === 0 ? (
            <EmptyState
              title="No saved scenarios"
              description="Save a scenario from the Simulation Studio to keep its exact strategy mix and results."
            />
          ) : (
            <div className="divide-y divide-white/[0.045]">
              {simulations.map((s) => (
                <div key={s._id} className="row-hover flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <p className="truncate text-[13px] text-bone-100">{s.name}</p>
                      {s.status === 'applied' && (
                        <span className="inline-flex items-center gap-1.5 text-2xs text-flow-free">
                          <span className="h-1.5 w-1.5 rounded-full bg-flow-free" />
                          Applied
                        </span>
                      )}
                    </div>
                    <p className="tnum mt-1 truncate text-2xs text-ink-600">
                      {s.createdByName} · {dateLabel(s.createdAt)} · {s.selections.length} strateg
                      {s.selections.length === 1 ? 'y' : 'ies'} · {s.windowId === 'morning' ? '09–12' : '16–19'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-2">
                    <Stat label="Delay" delta={s.summary?.vehicleDelayPct} goodWhenNegative />
                    <Stat label="Speed" delta={s.summary?.avgSpeedPct} />
                    <div className="text-right">
                      <p className="label">Capex</p>
                      <p className="tnum mt-1 text-2xs text-bone-200">{lakh(s.summary?.capexLakh)}</p>
                    </div>
                    <div className="text-right">
                      <p className="label">Payback</p>
                      <p className="tnum mt-1 text-2xs text-bone-200">
                        {s.summary?.paybackMonths != null ? `${num(s.summary.paybackMonths, 1)} mo` : '—'}
                      </p>
                    </div>
                    <button type="button" onClick={() => generateFrom(s)} className="btn-quiet">
                      Generate report
                    </button>
                    {canApply && (
                      <button
                        type="button"
                        onClick={() => removeSimulation(s)}
                        className="rounded p-1.5 text-ink-600 transition-colors hover:text-flow-severe"
                        aria-label="Delete scenario"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, delta, goodWhenNegative }) {
  return (
    <div className="text-right">
      <p className="label">{label}</p>
      <div className="mt-1">
        <DeltaPill value={delta} goodWhenNegative={goodWhenNegative} />
      </div>
    </div>
  );
}
