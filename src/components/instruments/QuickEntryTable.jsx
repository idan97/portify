import React, { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PiggyBank, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";

// One editable row per asset, pre-filled with its last known value.
// "manual:<id>" / "instrument:<id>" keys distinguish the two record types.
const manualKey = (id) => `manual:${id}`;
const instrumentKey = (id) => `instrument:${id}`;

const formatHint = (n) => `₪${Math.round(n).toLocaleString()}`;

export default function QuickEntryTable({
  instruments = [],
  assetClasses = [],
  manualAssets = [],
  latestHoldingByInstrument, // Map: instrument_id -> holding
  latestValueByManualAsset, // Map: manual_asset_id -> value
  onSave,
}) {
  // Seed each row with its last value (as a string for the input).
  const seeded = useMemo(() => {
    const values = {};
    manualAssets.forEach((a) => {
      const last = latestValueByManualAsset.get(a.id);
      values[manualKey(a.id)] = last != null ? String(last.value_ils) : "";
    });
    instruments.forEach((i) => {
      const last = latestHoldingByInstrument.get(i.id);
      values[instrumentKey(i.id)] =
        last != null ? String(last.total_value_ils) : "";
    });
    return values;
  }, [
    instruments,
    manualAssets,
    latestHoldingByInstrument,
    latestValueByManualAsset,
  ]);

  const [values, setValues] = useState(seeded);
  const [isSaving, setIsSaving] = useState(false);
  const inputRefs = useRef([]);

  const setValue = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));

  // Move focus to the next input on Enter for fast keyboard entry.
  const handleKeyDown = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = inputRefs.current[index + 1];
      if (next) next.focus();
    }
  };

  const groupedInstruments = useMemo(
    () =>
      instruments.reduce((acc, i) => {
        (acc[i.asset_class_id] ||= []).push(i);
        return acc;
      }, {}),
    [instruments],
  );

  // Build the ordered list of rows (manual assets first, then by asset class).
  let inputIndex = -1;
  const rows = [];
  if (manualAssets.length > 0) {
    rows.push({
      type: "header",
      label: "Manual Assets",
      icon: true,
      key: "h-manual",
    });
    manualAssets.forEach((a) => {
      inputIndex += 1;
      const last = latestValueByManualAsset.get(a.id);
      rows.push({
        type: "row",
        key: manualKey(a.id),
        name: a.name,
        symbol: null,
        last: last ? last.value_ils : null,
        lastDate: last?.date,
        index: inputIndex,
      });
    });
  }
  assetClasses.forEach((ac) => {
    const list = groupedInstruments[ac.id] || [];
    if (list.length === 0) return;
    rows.push({
      type: "header",
      label: ac.name,
      icon: false,
      key: `h-${ac.id}`,
    });
    list.forEach((i) => {
      inputIndex += 1;
      const last = latestHoldingByInstrument.get(i.id);
      rows.push({
        type: "row",
        key: instrumentKey(i.id),
        name: i.name,
        symbol: i.symbol,
        last: last ? last.total_value_ils : null,
        lastDate: last?.date,
        index: inputIndex,
      });
    });
  });

  // Live stats: how many changed vs seeded, and the projected new total.
  const changedCount = Object.keys(values).filter(
    (k) => (values[k] ?? "") !== (seeded[k] ?? ""),
  ).length;
  const newTotal = Object.values(values).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  );
  const totalRows = manualAssets.length + instruments.length;

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const holdingRows = [];
      const mavRows = [];
      for (const [key, raw] of Object.entries(values)) {
        if (raw === "" || raw == null) continue; // skip blanks
        const num = parseFloat(raw);
        if (Number.isNaN(num)) continue;
        const [kind, id] = key.split(":");
        if (kind === "instrument") {
          holdingRows.push({
            instrument_id: id,
            date: today,
            total_value_ils: num,
          });
        } else {
          mavRows.push({ manual_asset_id: id, date: today, value_ils: num });
        }
      }
      await onSave({ holdingRows, mavRows });
    } finally {
      setIsSaving(false);
    }
  };

  if (totalRows === 0) return null;

  return (
    <Card className="bg-white shadow-sm border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div>
          <p className="font-semibold text-slate-900">Record today's values</p>
          <p className="text-sm text-slate-500">
            {format(new Date(), "EEEE, MMM d, yyyy")} · pre-filled with last
            value · edit only what changed
          </p>
        </div>
        <Button
          onClick={handleSaveClick}
          disabled={isSaving}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save all
        </Button>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((row) =>
          row.type === "header" ? (
            <div
              key={row.key}
              className="flex items-center gap-2 px-5 py-2 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wide"
            >
              {row.icon && <PiggyBank className="w-4 h-4" />} {row.label}
            </div>
          ) : (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_140px] items-center gap-3 px-5 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-900 truncate">{row.name}</span>
                {row.symbol && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {row.symbol}
                  </Badge>
                )}
              </div>
              <div className="text-right text-xs text-slate-400 whitespace-nowrap">
                {row.last != null ? (
                  <>
                    was {formatHint(row.last)}
                    {row.lastDate && (
                      <span className="block">
                        {format(new Date(row.lastDate), "MMM d")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="italic">no prior value</span>
                )}
              </div>
              <Input
                ref={(el) => (inputRefs.current[row.index] = el)}
                type="number"
                step="0.01"
                inputMode="decimal"
                value={values[row.key] ?? ""}
                onChange={(e) => setValue(row.key, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, row.index)}
                onFocus={(e) => e.target.select()}
                className={`text-right ${(values[row.key] ?? "") !== (seeded[row.key] ?? "") ? "text-slate-900 font-medium" : "text-slate-400"}`}
                placeholder="0"
              />
            </div>
          ),
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 text-sm">
        <span className="text-slate-500">
          {changedCount} of {totalRows} changed · blanks are skipped
        </span>
        <span className="font-medium text-slate-900">
          New total ≈ {formatHint(newTotal)}
        </span>
      </div>
    </Card>
  );
}
