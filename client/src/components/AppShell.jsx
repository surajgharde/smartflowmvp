import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ChevronLeft,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Radio,
  SlidersHorizontal,
  Waves,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useAppData } from '../lib/appData.jsx';
import { cx, LiveDot } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, step: 1 },
  { to: '/map', label: 'Live Map', icon: MapIcon, step: 2 },
  { to: '/simulate', label: 'Simulation', icon: SlidersHorizontal, step: 3 },
  { to: '/results', label: 'Results & AI', icon: GitCompareArrows, step: 5 },
  { to: '/reports', label: 'Reports', icon: FileText, step: 6 },
];

/** Wordmark — a flow glyph plus the product name. */
export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
        <Waves className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="text-sm font-bold tracking-tight text-white">
            Smart<span className="text-brand-400">Flow</span>
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Nagpur Traffic Command
          </p>
        </div>
      )}
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours() + now.getMinutes() / 60;
  const inPeak = (hour >= 9 && hour < 12) || (hour >= 16 && hour < 19);

  return (
    <div className="hidden items-center gap-3 md:flex">
      <div
        className={cx(
          'chip',
          inPeak ? 'bg-amber-500/12 text-amber-300' : 'bg-white/[0.06] text-slate-400'
        )}
      >
        <Radio className="h-3 w-3" strokeWidth={2.5} />
        {inPeak ? 'Peak window active' : 'Off-peak'}
      </div>
      <span className="tnum text-xs text-slate-400">
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

function UserChip() {
  const { user, roleLabel, logout } = useAuth();
  if (!user) return null;
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold leading-tight text-slate-200">{user.name}</p>
        <p className="text-[10px] leading-tight text-slate-500">
          {user.designation || roleLabel} · {user.authority}
        </p>
      </div>
      <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[11px] font-bold text-brand-300">
        {initials}
      </div>
      <button
        type="button"
        onClick={logout}
        className="rounded-lg border border-white/10 p-2 text-slate-500 transition-colors hover:border-rose-500/30 hover:text-rose-300"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { corridors } = useAppData();
  const location = useLocation();

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="flex h-full">
      {/* Backdrop for the mobile drawer */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/95 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0 lg:bg-ink-900/50',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-slate-500 lg:hidden"
            aria-label="Close navigation"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-3">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Operations
          </p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-500/[0.13] text-brand-200 shadow-[inset_2px_0_0_0_theme(colors.brand.400)]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              <span className="tnum text-[10px] font-semibold text-slate-600 group-hover:text-slate-500">
                {item.step}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <LiveDot />
            <span className="tnum">{corridors.length} corridors monitored</span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
            Team Coders 2.0 · Vikasit Nagpur Hackathon 2026
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-slate-400 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <Activity className="h-3.5 w-3.5 text-brand-400" strokeWidth={2} />
              <span>Nagpur Metropolitan Area</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Clock />
            <UserChip />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
