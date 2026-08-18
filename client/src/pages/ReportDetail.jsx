import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Download, Printer, Waves } from 'lucide-react';
import { api } from '../lib/api.js';
import { ErrorNote, Loading, Panel, Spinner, cx, useToast } from '../components/ui.jsx';
import { dayLabel, dateLabel, inr, lakh, num } from '../lib/format.js';
import { LOS_COLOR } from '../lib/theme.js';

/**
 * The report renders as an ink-on-paper A4 sheet inside the dark console, so what
 * an officer sees on screen is exactly what prints or exports to PDF.
 */
export default function ReportDetail() {
  const { id } = useParams();
  const toast = useToast();
  const paperRef = useRef(null);

  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api
      .report(id)
      .then((res) => setReport(res.report))
      .catch((err) => setError(err.message));
  }, [id]);

  async function downloadPdf() {
    setExporting(true);
    try {
      // Loaded on demand — html2pdf pulls in html2canvas and jsPDF, which are
      // heavy and only needed when someone actually exports.
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf()
        .set({
          margin: [10, 10, 12, 10],
          filename: `${report.refId.replace(/\//g, '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.97 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(paperRef.current)
        .save();
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(`Could not export PDF: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="p-6">
        <Panel>
          <Loading label="Loading report" />
        </Panel>
      </div>
    );
  }

  const p = report.payload;
  const r = p.result;
  const b = r.before.window_totals;
  const a = r.after.window_totals;
  const d = r.delta;

  return (
    <div className="p-4 sm:p-6">
      {/* ------------------------------------------------------ toolbar */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/reports" className="btn-ghost !py-2 !text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          All reports
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="btn-ghost !py-2 !text-xs">
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button type="button" onClick={downloadPdf} disabled={exporting} className="btn-primary !py-2 !text-xs">
            {exporting ? <Spinner /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? 'Building PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------- paper */}
      <div className="mx-auto max-w-[860px]">
        <div ref={paperRef} className="rounded-lg bg-white p-8 text-slate-900 shadow-2xl sm:p-12">
          {/* letterhead */}
          <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
            <div className="flex items-start gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-900">
                <Waves className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-900">SmartFlow</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Nagpur Traffic Command · {report.authority}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-600">
                  Traffic Management Simulation & Impact Assessment
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <QRCodeSVG
                value={`${window.location.origin}/reports/${report._id}`}
                size={64}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
              <p className="mt-1.5 text-[8px] uppercase tracking-wider text-slate-400">Scan to verify</p>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] sm:grid-cols-4">
            <Meta label="Reference" value={report.refId} mono />
            <Meta label="Issued" value={dayLabel(report.createdAt)} />
            <Meta label="Peak window" value={r.window.label + ` (${String(r.window.startHour).padStart(2, '0')}:00–${String(r.window.endHour).padStart(2, '0')}:00)`} />
            <Meta label="Prepared by" value={p.preparedBy?.name} />
          </div>

          <h1 className="mt-7 text-xl font-bold leading-tight tracking-tight text-slate-900">
            {report.title}
          </h1>

          {/* ------------------------------------------- executive summary */}
          <Section title="1. Executive summary">
            <p className="text-[12px] leading-relaxed text-slate-700">
              A simulation of the <strong>{r.window.label.toLowerCase()}</strong> ({String(r.window.startHour).padStart(2, '0')}:00–
              {String(r.window.endHour).padStart(2, '0')}:00) was run across {r.comparison.length} monitored corridors of the Nagpur
              network under scenario <strong>“{p.scenarioName}”</strong>. Against a do-nothing baseline the proposed
              package changes network vehicle-delay by <strong>{num(d.vehicleDelayPct, 1)}%</strong>, average network
              speed by <strong>{num(d.avgSpeedPct, 1)}%</strong> and CO₂ emitted during the window by{' '}
              <strong>{num(d.co2Pct, 1)}%</strong>. {r.improvedCount} corridor{r.improvedCount === 1 ? '' : 's'} improved
              {r.worsenedCount > 0 ? `, while ${r.worsenedCount} absorbed displaced traffic` : ' with no corridor made worse'}.
              Capital cost is estimated at <strong>{lakh(r.economics.capexLakh)}</strong>
              {r.economics.paybackMonths != null
                ? `, recovering in approximately ${num(r.economics.paybackMonths, 1)} months against the value of time and fuel saved`
                : ''}
              , deployable within <strong>{r.economics.deployDays} days</strong>.
            </p>
          </Section>

          {/* --------------------------------------------- impact summary */}
          <Section title="2. Measured impact">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 font-semibold">Indicator</th>
                  <th className="py-2 text-right font-semibold">Baseline</th>
                  <th className="py-2 text-right font-semibold">With strategy</th>
                  <th className="py-2 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Congestion index (0–100)" before={num(b.congestionIndex, 1)} after={num(a.congestionIndex, 1)} delta={d.congestionIndexPct} goodWhenNegative />
                <Row label="Average network speed (km/h)" before={num(b.avgSpeed, 1)} after={num(a.avgSpeed, 1)} delta={d.avgSpeedPct} />
                <Row label="Vehicle-hours of delay" before={num(b.vehicleDelayHours, 0)} after={num(a.vehicleDelayHours, 0)} delta={d.vehicleDelayPct} goodWhenNegative />
                <Row label="Person-hours of delay" before={num(b.personDelayHours, 0)} after={num(a.personDelayHours, 0)} delta={d.vehicleDelayPct} goodWhenNegative />
                <Row label="CO₂ emitted (kg)" before={num(b.co2Kg, 0)} after={num(a.co2Kg, 0)} delta={d.co2Pct} goodWhenNegative />
                <Row label="Fuel wasted (litres)" before={num(b.fuelWastedLitres, 0)} after={num(a.fuelWastedLitres, 0)} delta={null} goodWhenNegative />
                <Row label="Economic loss (₹)" before={inr(b.economicLossInr)} after={inr(a.economicLossInr)} delta={d.economicLossPct} goodWhenNegative />
              </tbody>
            </table>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
              Totals are integrated across the full peak window at 15-minute resolution. Link performance uses the
              Bureau of Public Roads volume-delay function (α = 0.15, β = 4) with a saturation-dependent signal delay
              term; heavy vehicles are converted at 3.0 PCU.
            </p>
          </Section>

          {/* ---------------------------------------------- interventions */}
          <Section title="3. Interventions applied">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 font-semibold">Strategy</th>
                  <th className="py-2 font-semibold">Corridors</th>
                  <th className="py-2 text-right font-semibold">Intensity</th>
                  <th className="py-2 text-right font-semibold">Capex</th>
                  <th className="py-2 text-right font-semibold">Lead time</th>
                </tr>
              </thead>
              <tbody>
                {r.after.applied.map((s) => (
                  <tr key={s.strategyId} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{s.name}</td>
                    <td className="py-2 text-slate-600">{s.corridorCodes.join(', ')}</td>
                    <td className="py-2 text-right text-slate-700">{Math.round(s.intensity * 100)}%</td>
                    <td className="py-2 text-right text-slate-700">{lakh(s.costLakh)}</td>
                    <td className="py-2 text-right text-slate-700">{s.deployDays} d</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-slate-900 font-semibold">
                  <td className="py-2 text-slate-900" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2 text-right text-slate-900">{lakh(r.economics.capexLakh)}</td>
                  <td className="py-2 text-right text-slate-900">{r.economics.deployDays} d</td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ------------------------------------------------- corridors */}
          <Section title="4. Corridor-level results" breakBefore>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-slate-300 text-left text-[9px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 font-semibold">Corridor</th>
                  <th className="py-1.5 font-semibold">Authority</th>
                  <th className="py-1.5 text-right font-semibold">v/c before</th>
                  <th className="py-1.5 text-right font-semibold">v/c after</th>
                  <th className="py-1.5 text-right font-semibold">Speed before</th>
                  <th className="py-1.5 text-right font-semibold">Speed after</th>
                  <th className="py-1.5 text-center font-semibold">LOS</th>
                </tr>
              </thead>
              <tbody>
                {[...r.comparison]
                  .sort((x, y) => x.delta.congestionIndex - y.delta.congestionIndex)
                  .map((c) => (
                    <tr key={c.code} className="border-b border-slate-100">
                      <td className="py-1.5 font-medium text-slate-800">{c.name}</td>
                      <td className="py-1.5 text-slate-600">{c.jurisdiction}</td>
                      <td className="py-1.5 text-right text-slate-600">{num(c.before.vc, 2)}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-900">{num(c.after.vc, 2)}</td>
                      <td className="py-1.5 text-right text-slate-600">{num(c.before.avgSpeed, 1)}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-900">{num(c.after.avgSpeed, 1)}</td>
                      <td className="py-1.5 text-center">
                        <span className="inline-flex items-center gap-1">
                          {c.losChanged && <span className="text-slate-400">{c.before.los} →</span>}
                          <span
                            className="rounded px-1 py-0.5 font-bold text-white"
                            style={{ background: LOS_COLOR[c.after.los] }}
                          >
                            {c.after.los}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Section>

          {/* ------------------------------------------- recommendations */}
          {p.recommendations?.length > 0 && (
            <Section title="5. Further recommendations" breakBefore>
              <div className="space-y-3">
                {p.recommendations.slice(0, 4).map((rec, i) => (
                  <div key={rec.id} className="border-l-2 border-slate-900 pl-3">
                    <p className="text-[12px] font-semibold text-slate-900">
                      {i + 1}. {rec.strategyName} — {rec.corridorName} ({rec.jurisdiction})
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-700">{rec.rationale}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Priority {rec.priority} · score {num(rec.score, 1)}/100 · confidence{' '}
                      {Math.round(rec.confidence * 100)}% · capex {lakh(rec.expected.costLakh)} · live in{' '}
                      {rec.deployDays} days
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* -------------------------------------- jurisdiction advisory */}
          {p.jurisdictionAdvisory && (
            <Section title="6. Jurisdiction load advisory">
              <p className="text-[12px] font-semibold text-slate-900">{p.jurisdictionAdvisory.headline}</p>
              <ul className="mt-2 space-y-1">
                {p.jurisdictionAdvisory.notes.map((n, i) => (
                  <li key={i} className="text-[11px] leading-relaxed text-slate-700">
                    • {n}
                  </li>
                ))}
              </ul>

              <table className="mt-3 w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-[9px] uppercase tracking-wider text-slate-500">
                    <th className="py-1.5 font-semibold">Authority</th>
                    <th className="py-1.5 text-right font-semibold">Corridors</th>
                    <th className="py-1.5 text-right font-semibold">Lane-km</th>
                    <th className="py-1.5 text-right font-semibold">Avg v/c</th>
                    <th className="py-1.5 text-right font-semibold">Load / lane-km</th>
                  </tr>
                </thead>
                <tbody>
                  {p.jurisdictionAdvisory.rows.map((row) => (
                    <tr key={row.jurisdiction} className="border-b border-slate-100">
                      <td className="py-1.5 font-medium text-slate-800">{row.jurisdiction}</td>
                      <td className="py-1.5 text-right text-slate-600">{row.corridors}</td>
                      <td className="py-1.5 text-right text-slate-600">{num(row.laneKm, 1)}</td>
                      <td className="py-1.5 text-right text-slate-600">{num(row.avgVc, 2)}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-900">{num(row.loadPerLaneKm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ------------------------------------------------- signature */}
          <div className="mt-10 flex items-end justify-between gap-8 border-t border-slate-300 pt-5">
            <div className="text-[10px] leading-relaxed text-slate-500">
              <p>Generated by SmartFlow simulation platform on {dateLabel(report.createdAt)}.</p>
              <p>Reference {report.refId}. Figures are model outputs and should be validated against field counts before tender.</p>
              <p className="mt-1">Team Coders 2.0 · Vikasit Nagpur Hackathon 2026</p>
            </div>
            <div className="shrink-0 text-center">
              <div className="mb-1 h-10 w-44 border-b border-slate-400" />
              <p className="text-[11px] font-semibold text-slate-900">{p.preparedBy?.name}</p>
              <p className="text-[10px] text-slate-500">
                {p.preparedBy?.designation || p.preparedBy?.role}
              </p>
              <p className="text-[10px] text-slate-500">{p.preparedBy?.authority}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, breakBefore }) {
  return (
    <section className={cx('mt-7', breakBefore && 'break-before-page')} style={breakBefore ? { pageBreakBefore: 'always' } : undefined}>
      <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cx('mt-0.5 font-medium text-slate-800', mono && 'font-mono text-[10px]')}>{value}</p>
    </div>
  );
}

function Row({ label, before, after, delta, goodWhenNegative }) {
  const good = delta == null ? null : goodWhenNegative ? delta < 0 : delta > 0;
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 text-slate-700">{label}</td>
      <td className="py-2 text-right text-slate-600">{before}</td>
      <td className="py-2 text-right font-semibold text-slate-900">{after}</td>
      <td className={cx('py-2 text-right font-semibold', good == null ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-rose-700')}>
        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${num(delta, 1)}%`}
      </td>
    </tr>
  );
}
