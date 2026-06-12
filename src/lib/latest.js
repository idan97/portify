import { parseISO } from "date-fns";

// Given rows that each have a `date` field and a grouping key (e.g. instrument_id),
// return a Map of key → the row with the most recent date for that key.
// Mirrors the latest-holding logic used in Dashboard.jsx.
export function latestByKey(rows = [], keyField) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[keyField];
    if (key == null) return;
    const existing = map.get(key);
    if (!existing || parseISO(row.date) > parseISO(existing.date)) {
      map.set(key, row);
    }
  });
  return map;
}
