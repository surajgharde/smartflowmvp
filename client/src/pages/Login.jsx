import { useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  FlaskConical,
  Layers3,
  Lock,
  Mail,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { ErrorNote, Spinner, cx } from '../components/ui.jsx';

/** One-click sign-ins so a demo never stalls on typing a password. */
const DEMO_ACCOUNTS = [
  {
    email: 'commissioner@nagpur.gov.in',
    password: 'smartflow',
    name: 'Dr. Anjali Deshmukh',
    role: 'Traffic Commissioner',
    authority: 'NMC',
    icon: ShieldCheck,
    note: 'Full access — can commit plans',
  },
  {
    email: 'engineer@nmc.gov.in',
    password: 'smartflow',
    name: 'Rohit Kalambe',
    role: 'Executive Engineer',
    authority: 'NIT',
    icon: Building2,
    note: 'Can simulate and apply strategies',
  },
  {
    email: 'analyst@nmrda.gov.in',
    password: 'smartflow',
    name: 'Sneha Wankhede',
    role: 'Transport Analyst',
    authority: 'NMRDA',
    icon: FlaskConical,
    note: 'Read and model only',
  },
];

const CAPABILITIES = [
  { icon: Layers3, title: 'Jurisdiction-aware analysis', body: 'Measures how unevenly peak load falls across NMC, NIT, NMRDA, PWD and NHAI.' },
  { icon: FlaskConical, title: 'Simulate before you spend', body: 'Run a strategy against a BPR traffic model and see the outcome before committing budget.' },
  { icon: BrainCircuit, title: 'Recommendations with evidence', body: 'Every suggestion is ranked by a simulated result, cost-effectiveness and deployment time.' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('commissioner@nagpur.gov.in');
  const [password, setPassword] = useState('smartflow');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e, creds) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(creds?.email ?? email, creds?.password ?? password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_minmax(0,26rem)]">
      {/* ---------------------------------------------------------- brand pane */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] p-10 lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 30% 40%, black, transparent)',
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
              <Waves className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-white">
                Smart<span className="text-brand-400">Flow</span>
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Nagpur Traffic Command
              </p>
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Problem statement
          </p>
          <h1 className="text-3xl font-bold leading-[1.2] tracking-tight text-white xl:text-[2.6rem]">
            Peak-hour traffic falls unevenly across Nagpur's planning authorities.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            SmartFlow measures that imbalance across 20 arterial corridors, lets an authority
            simulate a management strategy against a calibrated traffic model, and reports what
            actually changes — before a single barricade is moved.
          </p>

          <div className="mt-9 space-y-4">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="flex gap-3.5">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                  <c.icon className="h-4 w-4 text-brand-400" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{c.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-[11px] text-slate-600">
          <span className="font-medium text-slate-500">Team Coders 2.0</span>
          <span>Vikasit Nagpur Hackathon 2026</span>
          <span>Track · Web Dev</span>
        </div>
      </div>

      {/* ----------------------------------------------------------- form pane */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600">
                <Waves className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-bold text-white">
                Smart<span className="text-brand-400">Flow</span>
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">Authority sign-in</h2>
          <p className="mt-1.5 text-xs text-slate-500">
            Restricted to Nagpur traffic planning and enforcement staff.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Official email
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field pl-9"
                  placeholder="name@nagpur.gov.in"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field pl-9"
                  placeholder="••••••••"
                />
              </div>
            </label>

            <ErrorNote>{error}</ErrorNote>

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Spinner /> : <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
              {busy ? 'Signing in' : 'Enter command centre'}
            </button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              Demo accounts
            </span>
            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>

          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={busy}
                onClick={(e) => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                  submit(e, acc);
                }}
                className={cx(
                  'group flex w-full items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-left',
                  'transition-all hover:border-brand-500/40 hover:bg-brand-500/[0.06] disabled:opacity-50'
                )}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-brand-400 transition-colors group-hover:border-brand-500/30">
                  <acc.icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">{acc.role}</p>
                  <p className="truncate text-[11px] text-slate-500">{acc.note}</p>
                </div>
                <span className="chip shrink-0 bg-white/[0.06] text-slate-400">{acc.authority}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-[10px] text-slate-600">
            All demo accounts use the password <span className="font-mono text-slate-500">smartflow</span>
          </p>
        </div>
      </div>
    </div>
  );
}
