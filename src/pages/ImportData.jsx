import React, { useState } from "react";
import { AssetClass, Instrument, Holding, ManualAsset, ManualAssetValue } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DownloadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const ENTITIES = {
  AssetClass: AssetClass,
  Instrument: Instrument,
  ManualAsset: ManualAsset,
  Holding: Holding,
  ManualAssetValue: ManualAssetValue,
};

// Base44 metadata that must not be copied into the new records
const METADATA_FIELDS = new Set([
  "id", "created_date", "updated_date", "created_by", "created_by_id",
  "updated_by", "is_sample", "app_id", "entity_name",
]);

const stripMetadata = (record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !METADATA_FIELDS.has(key)));

async function fetchBase44Entity(appId, apiKey, entity) {
  const res = await fetch(`/api/base44?appId=${encodeURIComponent(appId)}&entity=${entity}`, {
    headers: { api_key: apiKey },
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* non-JSON error body */ }
    throw new Error(`Failed to fetch ${entity} (HTTP ${res.status}) ${detail}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Unexpected response for ${entity}`);
  return data;
}

// Insert records in bulk and return a map from their old Base44 ids to the new
// Supabase ids (insert order matches input order).
async function importEntity(entityClient, records, remap = {}) {
  if (records.length === 0) return {};
  const payloads = records.map((record) => {
    const clean = stripMetadata(record);
    for (const [field, idMap] of Object.entries(remap)) {
      if (clean[field] != null) clean[field] = idMap[clean[field]] ?? clean[field];
    }
    return clean;
  });
  const created = await entityClient.bulkCreate(payloads);
  const idMap = {};
  records.forEach((record, i) => { idMap[record.id] = created[i].id; });
  return idMap;
}

export default function ImportData() {
  const [appId, setAppId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | fetching | preview | importing | done
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(null); // { entityName: records[] }
  const [existingCounts, setExistingCounts] = useState(null);
  const [progress, setProgress] = useState([]);

  const handleFetchPreview = async (e) => {
    e.preventDefault();
    setError(null);
    setFetched(null);
    setExistingCounts(null);
    setPhase("fetching");
    try {
      const entries = await Promise.all(
        Object.keys(ENTITIES).map(async (name) => [name, await fetchBase44Entity(appId.trim(), apiKey.trim(), name)])
      );
      const existing = await Promise.all(
        Object.entries(ENTITIES).map(async ([name, entityClient]) => [name, (await entityClient.list()).length])
      );
      setFetched(Object.fromEntries(entries));
      setExistingCounts(Object.fromEntries(existing));
      setPhase("preview");
    } catch (err) {
      setError(err.message);
      setPhase("idle");
    }
  };

  const handleImport = async () => {
    setError(null);
    setPhase("importing");
    setProgress([]);
    const log = (msg) => setProgress((prev) => [...prev, msg]);
    try {
      // Insert in dependency order, remapping cross-entity references to the
      // freshly generated ids.
      const assetClassIds = await importEntity(ENTITIES.AssetClass, fetched.AssetClass);
      log(`Imported ${fetched.AssetClass.length} asset classes`);

      const instrumentIds = await importEntity(ENTITIES.Instrument, fetched.Instrument, {
        asset_class_id: assetClassIds,
      });
      log(`Imported ${fetched.Instrument.length} instruments`);

      await importEntity(ENTITIES.Holding, fetched.Holding, { instrument_id: instrumentIds });
      log(`Imported ${fetched.Holding.length} holdings`);

      const manualAssetIds = await importEntity(ENTITIES.ManualAsset, fetched.ManualAsset);
      log(`Imported ${fetched.ManualAsset.length} manual assets`);

      await importEntity(ENTITIES.ManualAssetValue, fetched.ManualAssetValue, {
        manual_asset_id: manualAssetIds,
      });
      log(`Imported ${fetched.ManualAssetValue.length} manual asset values`);

      setPhase("done");
    } catch (err) {
      setError(`Import failed: ${err.message}. Some records may have been created — review your data before retrying.`);
      setPhase("preview");
    }
  };

  const hasExistingData = existingCounts && Object.values(existingCounts).some((n) => n > 0);
  const totalFetched = fetched ? Object.values(fetched).reduce((sum, rows) => sum + rows.length, 0) : 0;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Data</h1>
        <p className="text-slate-500 mt-1">
          Copy your portfolio from the original Base44-hosted Portify into this app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DownloadCloud className="w-5 h-5" /> Connect to Base44
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFetchPreview} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appId">Base44 App ID</Label>
              <Input
                id="appId"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. 68a1b2c3d4e5f6a7b8c9d0e1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your Base44 API key"
                required
              />
              <p className="text-xs text-slate-500">
                Find both in your Base44 dashboard: open the app, then Settings (or Workspace → API Keys).
                Credentials are only used for this import and never stored.
              </p>
            </div>
            <Button type="submit" disabled={phase !== "idle"}>
              {phase === "fetching" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching…</>
              ) : (
                "Fetch preview"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(phase === "preview" || phase === "importing" || phase === "done") && fetched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Records on Base44</TableHead>
                  <TableHead className="text-right">Already here</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(ENTITIES).map((name) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{fetched[name].length}</TableCell>
                    <TableCell className="text-right">{existingCounts?.[name] ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasExistingData && phase === "preview" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This account already has data. Importing will add the Base44 records on top of it,
                  which can create duplicates.
                </AlertDescription>
              </Alert>
            )}

            {phase === "preview" && (
              <Button onClick={handleImport} disabled={totalFetched === 0} className="w-full">
                Import {totalFetched} records
              </Button>
            )}

            {(phase === "importing" || phase === "done") && (
              <div className="space-y-1 text-sm text-slate-600">
                {progress.map((line) => (
                  <div key={line} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {line}
                  </div>
                ))}
                {phase === "importing" && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                  </div>
                )}
              </div>
            )}

            {phase === "done" && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Import complete! Head to the Dashboard to see your portfolio.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
