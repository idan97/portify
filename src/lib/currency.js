// Currency conversion helpers.
//
// A USD instrument's holdings store the RAW dollar amount in `total_value_ils`
// (the field is reinterpreted, not renamed). We convert to shekels at display
// time using today's rate so the shekel value tracks the live rate.

export const instrumentCurrency = (instrument) =>
  instrument?.currency === "USD" ? "USD" : "ILS";

// Convert a single raw value given a currency + rate.
export const toIls = (rawValue, currency, usdRate) =>
  currency === "USD" ? (rawValue || 0) * (usdRate || 1) : rawValue || 0;

// Return a copy of `holdings` where each `total_value_ils` is real shekels,
// resolving each holding's currency via its instrument. Used right after load
// so every downstream sum/chart/timeline works on a single ILS number.
export function convertHoldings(holdings = [], instruments = [], usdRate = 1) {
  const currencyByInstrument = new Map(
    instruments.map((i) => [i.id, instrumentCurrency(i)]),
  );
  return holdings.map((h) => {
    const currency = currencyByInstrument.get(h.instrument_id) || "ILS";
    return currency === "USD"
      ? { ...h, total_value_ils: (h.total_value_ils || 0) * (usdRate || 1) }
      : h;
  });
}

export const formatIls = (n) => `₪${Math.round(n || 0).toLocaleString()}`;
export const formatUsd = (n) => `$${Math.round(n || 0).toLocaleString()}`;
