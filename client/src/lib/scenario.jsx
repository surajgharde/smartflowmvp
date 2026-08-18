import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * The scenario being composed in the Simulation Studio, and the result of the
 * last run. Held above the router so step 4 (run) and step 5 (compare) are the
 * same working session rather than two disconnected pages.
 */
const ScenarioContext = createContext(null);

export function ScenarioProvider({ children }) {
  const [windowId, setWindowId] = useState('morning');
  const [selections, setSelections] = useState([]);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [focusCorridor, setFocusCorridor] = useState(null);

  /** Add or update one strategy's targeting. Removing all corridors drops it. */
  const setStrategy = useCallback((strategyId, patch) => {
    setSelections((prev) => {
      const idx = prev.findIndex((s) => s.strategyId === strategyId);
      if (idx === -1) {
        return [...prev, { strategyId, intensity: 0.7, corridorCodes: [], ...patch }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      if (!next[idx].corridorCodes.length) next.splice(idx, 1);
      return next;
    });
  }, []);

  const toggleCorridor = useCallback((strategyId, code) => {
    setSelections((prev) => {
      const idx = prev.findIndex((s) => s.strategyId === strategyId);
      if (idx === -1) {
        return [...prev, { strategyId, intensity: 0.7, corridorCodes: [code] }];
      }
      const current = prev[idx];
      const has = current.corridorCodes.includes(code);
      const codes = has
        ? current.corridorCodes.filter((c) => c !== code)
        : [...current.corridorCodes, code];
      const next = [...prev];
      if (!codes.length) next.splice(idx, 1);
      else next[idx] = { ...current, corridorCodes: codes };
      return next;
    });
  }, []);

  const removeStrategy = useCallback((strategyId) => {
    setSelections((prev) => prev.filter((s) => s.strategyId !== strategyId));
  }, []);

  const clear = useCallback(() => {
    setSelections([]);
    setResult(null);
  }, []);

  /** Load a recommendation package straight into the composer. */
  const loadPackage = useCallback((pkgSelections, targetWindow) => {
    if (targetWindow) setWindowId(targetWindow);
    setSelections(
      pkgSelections.map((s) => ({
        strategyId: s.strategyId,
        intensity: s.intensity ?? 0.8,
        corridorCodes: [...s.corridorCodes],
      }))
    );
    setResult(null);
  }, []);

  const value = useMemo(
    () => ({
      windowId,
      setWindowId,
      selections,
      setSelections,
      setStrategy,
      toggleCorridor,
      removeStrategy,
      clear,
      loadPackage,
      result,
      setResult,
      running,
      setRunning,
      focusCorridor,
      setFocusCorridor,
      targetedCodes: [...new Set(selections.flatMap((s) => s.corridorCodes))],
    }),
    [
      windowId,
      selections,
      result,
      running,
      focusCorridor,
      setStrategy,
      toggleCorridor,
      removeStrategy,
      clear,
      loadPackage,
    ]
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used inside ScenarioProvider');
  return ctx;
}
