import { useState, useEffect } from "react";

// Fetches today's USD->ILS rate once via the /api/usd-rate proxy.
// Falls back to DEFAULT_RATE (with a surfaced error) so the app never blanks
// out if the provider is unreachable.
const DEFAULT_RATE = 3.7;

export function useUsdRate() {
  const [state, setState] = useState({
    rate: DEFAULT_RATE,
    date: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usd-rate");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        // Prod (api/usd-rate.js) returns { rate }; the dev proxy passes
        // Frankfurter's raw { rates: { ILS } }. Accept either.
        const rate = data.rate ?? data?.rates?.ILS;
        if (typeof rate !== "number") throw new Error("no rate in response");
        setState({
          rate,
          date: data.date,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          rate: DEFAULT_RATE,
          date: null,
          isLoading: false,
          error: `Couldn't load live rate (using ${DEFAULT_RATE}): ${err.message}`,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
