import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Mark } from '../components/AppShell.jsx';
import { ErrorNote, Spinner, cx } from '../components/ui.jsx';

/** One-click sign-ins, so a live demo never stalls on typing a password. */
const DEMO_ACCOUNTS = [
  {
    email: 'commissioner@nagpur.gov.in',
    password: 'smartflow',
    role: 'Traffic Commissioner',
    authority: 'NMC',
    note: 'Full access, can commit a plan',
  },
  {
    email: 'engineer@nmc.gov.in',
    password: 'smartflow',
    role: 'Executive Engineer',
    authority: 'NIT',
    note: 'Simulate and apply strategies',
  },
  {
    email: 'analyst@nmrda.gov.in',
    password: 'smartflow',
    role: 'Transport Analyst',
    authority: 'NMRDA',
    note: 'Read and model only',
  },
];

/** Numbers pulled from the seeded network — concrete, not marketing adjectives. */
const FACTS = [
  ['20', 'arterial corridors modelled'],
  ['5', 'planning authorities'],
  ['1.9×', 'peak load imbalance, NMC vs NIT'],
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
    <div className="grid min-h-full lg:grid-cols-[1.15fr_minmax(0,25rem)]">
      {/* ------------------------------------------------------- editorial pane */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16"
        style={{ borderRight: '1px solid var(--rule)' }}
      >
        <div className="flex items-center gap-2.5">
          <Mark size={20} className="text-bone-100" />
          <span className="text-sm font-semibold tracking-tight text-bone-50">SmartFlow</span>
        </div>

        <div className="max-w-2xl">
          <p className="label mb-6">Vikasit Nagpur Hackathon 2026 — problem statement</p>

          {/*
            The problem statement, set large. The interesting word gets the accent
            because it is the one the whole product is built around.
          */}
          <h1 className="text-[2.6rem] font-semibold leading-[1.12] tracking-[-0.03em] text-bone-50 xl:text-[3.1rem]">
            Peak-hour traffic falls{' '}
            <span className="relative whitespace-nowrap">
              unevenly
              <svg
                className="absolute -bottom-1 left-0 w-full text-flow-heavy"
                height="7"
                viewBox="0 0 200 7"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M1 4.5c40-3 70 2 110-0.5s60-2 88 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>{' '}
            across Nagpur's planning authorities.
          </h1>

          <p className="mt-8 max-w-[52ch] text-[15px] leading-relaxed text-bone-400">
            SmartFlow measures that imbalance, simulates a management strategy against a calibrated
            traffic model, and reports what actually changes — before a single barricade is moved.
          </p>

          <dl className="mt-12 flex flex-wrap gap-x-14 gap-y-6">
            {FACTS.map(([value, label]) => (
              <div key={label}>
                <dt className="tnum text-[28px] font-medium leading-none text-bone-50">{value}</dt>
                <dd className="mt-2 max-w-[16ch] text-xs leading-relaxed text-ink-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex items-center gap-6 text-2xs text-ink-600">
          <span className="text-ink-500">Team Coders 2.0</span>
          <span>Web Dev track</span>
        </div>
      </div>

      {/* ----------------------------------------------------------- form pane */}
      <div className="flex flex-col justify-center px-6 py-14 sm:px-12">
        <div className="mx-auto w-full max-w-[21rem]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Mark size={20} className="text-bone-100" />
            <span className="text-sm font-semibold tracking-tight text-bone-50">SmartFlow</span>
          </div>

          <h2 className="text-lg font-semibold tracking-tight text-bone-50">Authority sign-in</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            Restricted to Nagpur traffic planning and enforcement staff.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-3.5">
            <label className="block">
              <span className="label mb-2 block">Official email</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="name@nagpur.gov.in"
              />
            </label>

            <label className="block">
              <span className="label mb-2 block">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
              />
            </label>

            <ErrorNote>{error}</ErrorNote>

            <button type="submit" disabled={busy} className="btn-primary !mt-5 w-full">
              {busy ? <Spinner /> : null}
              {busy ? 'Signing in' : 'Enter command centre'}
              {!busy && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
            </button>
          </form>

          <div className="mt-10">
            <p className="label mb-3">Demo accounts</p>
            <div className="divide-y divide-white/[0.06]">
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
                    'group flex w-full items-center gap-3 py-3 text-left transition-opacity',
                    'hover:opacity-100 disabled:opacity-40',
                    'first:pt-0 last:pb-0'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-bone-100">{acc.role}</p>
                    <p className="truncate text-2xs text-ink-500">{acc.note}</p>
                  </div>
                  <span className="shrink-0 text-2xs text-ink-600">{acc.authority}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-bone-300" />
                </button>
              ))}
            </div>
            <p className="mt-5 text-2xs text-ink-600">
              All demo accounts use the password <span className="tnum text-ink-500">smartflow</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
