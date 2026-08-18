import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

/**
 * Reference data loaded once after sign-in: corridor geometry, jurisdictions,
 * peak windows and the strategy catalogue. Every screen reads from here rather
 * than refetching the network on each mount.
 */
const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [corridors, setCorridors] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([api.meta(), api.corridors()])
      .then(([metaRes, corridorRes]) => {
        if (cancelled) return;
        setMeta(metaRes);
        setCorridors(corridorRes.corridors);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo(() => {
    const byCode = Object.fromEntries(corridors.map((c) => [c.code, c]));
    return {
      meta,
      corridors,
      corridorByCode: byCode,
      strategies: meta?.strategies || [],
      strategyById: Object.fromEntries((meta?.strategies || []).map((s) => [s.id, s])),
      eligibility: meta?.eligibility || {},
      jurisdictions: meta?.jurisdictions || {},
      peakWindows: meta?.peakWindows || [],
      center: meta?.center || [21.1458, 79.0882],
      loading,
      error,
    };
  }, [meta, corridors, loading, error]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
