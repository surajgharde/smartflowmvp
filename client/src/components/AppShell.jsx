import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useAppData } from '../lib/appData.jsx';
import { cx, LiveDot } from './ui.jsx';

/**
 * Navigation is numbered to match the six operational steps, so the sidebar
 * doubles as the workflow.
 */
const NAV = [
  { to: '/', label: 'Dashboard', end: true, step: '01' },
  { to: '/map', label: 'Live map', step: '02' },
  { to: '/simulate', label: 'Simulation', step: '03' },
  { to: '/results', label: 'Results', step: '05' },
  { to: '/reports', label: 'Reports', step: '06' },
];

/**
 * The mark: three lanes of traffic, the middle one running free while the outer
 * two are broken. Drawn rather than borrowed from an icon set — a generic glyph
 * in a gradient square is the first thing that dates an interface.
 */
export function Mark({ size = 22, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1">
        <path d="M3 6h6" opacity="0.45" />
        <path d="M12.5 6H21" opacity="0.45" />
        <path d="M3 12h18" />
        <path d="M3 18h4" opacity="0.45" />
        <path d="M10.5 18H21" opacity="0.45" />
      </g>
    </svg>
  );
}

export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark className="shrink-0 text-bone-100" />
      {!compact && (
        <div className="leading-none">
          <p className="text-[15px] font-semibold tracking-tight text-bone-50">SmartFlow</p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-ink-500">
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
  const peak =
    hour >= 9 && hour < 12 ? 'Morning peak' : hour >= 16 && hour < 19 ? 'Evening peak' : null;

  return (
    <div className="hidden items-center gap-3 sm:flex">
      {peak ? (
        <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-flow-moderate">
          <span className="h-1.5 w-1.5 rounded-full bg-flow-moderate" />
          {peak}
        </span>
      ) : (
        <span className="text-2xs text-ink-500">Off-peak</span>
      )}
      <span className="tnum text-xs text-bone-300">
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </span>
    </div>
  );
}

function UserChip() {
  const { user, roleLabel, logout } = useAuth();
  if (!user) return null;
  const initials = user.name
    .replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <p className="text-xs font-medium leading-tight text-bone-100">{user.name}</p>
        <p className="text-2xs leading-tight text-ink-500">
          {user.designation || roleLabel} · {user.authority}
        </p>
      </div>
      <div className="tnum grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-[10px] font-semibold text-bone-200">
        {initials}
      </div>
      <button
        type="button"
        onClick={logout}
        className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-white/[0.05] hover:text-bone-200"
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

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="flex h-full">
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink-950/75 lg:hidden"
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[228px] shrink-0 flex-col bg-ink-900 transition-transform duration-200',
          'lg:static lg:translate-x-0 lg:bg-transparent',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ borderRight: '1px solid var(--rule)' }}
      >
        <div className="flex h-14 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-ink-500 lg:hidden"
            aria-label="Close navigation"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 pt-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-baseline gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
                  isActive ? 'text-bone-50' : 'text-ink-500 hover:text-bone-200'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-bone-100" />
                  )}
                  <span
                    className={cx(
                      'tnum text-[10px] tabular-nums transition-colors',
                      isActive ? 'text-bone-400' : 'text-ink-600 group-hover:text-ink-500'
                    )}
                  >
                    {item.step}
                  </span>
                  <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-5" style={{ borderTop: '1px solid var(--rule)' }}>
          <div className="flex items-center gap-2 text-2xs text-ink-500">
            <LiveDot />
            <span className="tnum">{corridors.length} corridors monitored</span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-600">
            Team Coders 2.0
            <br />
            Vikasit Nagpur Hackathon 2026
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 bg-ink-950/85 px-4 backdrop-blur-md sm:px-7"
          style={{ borderBottom: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md p-1.5 text-ink-500 hover:text-bone-200 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="hidden text-2xs text-ink-500 sm:block">Nagpur Metropolitan Area</span>
          </div>
          <div className="flex items-center gap-5">
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
