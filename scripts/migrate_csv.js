#!/usr/bin/env node
// Migrates the 5 Base44 CSV exports into the Supabase `records` table.
// Uses the REST API directly (no SDK) to avoid the WebSocket dep on Node 20.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.
//
// Usage:
//   node scripts/migrate_csv.js
//   node scripts/migrate_csv.js --dry-run   (parse + print, no inserts)

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const CSV_DIR = resolve(process.env.HOME, 'Downloads');
const DRY_RUN = process.argv.includes('--dry-run');

// Load .env manually
const envFile = readFileSync(join(PROJECT_ROOT, '.env'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]; })
    .filter(([k]) => k)
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const REST = `${SUPABASE_URL}/rest/v1`;
const AUTH_ADMIN = `${SUPABASE_URL}/auth/v1/admin`;
const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function apiGet(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const lines = text.trim().split('\n');
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STRIP = new Set(['id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample']);

function stripMeta(row) {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !STRIP.has(k)));
}

async function insertBatch(entityName, rows) {
  if (rows.length === 0) return [];
  if (DRY_RUN) {
    console.log(`  [dry-run] would insert ${rows.length} rows (entity=${entityName})`);
    rows.slice(0, 3).forEach(r => console.log('   ', JSON.stringify(r)));
    if (rows.length > 3) console.log(`    ... and ${rows.length - 3} more`);
    return rows.map((_, i) => ({ id: `dry-${entityName}-${i}` }));
  }
  return apiPost(`${REST}/records`, rows);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '── DRY RUN (no inserts) ──\n' : '── LIVE RUN ──\n');

  // 1. Build email → user_id map
  const usersResp = await apiGet(`${AUTH_ADMIN}/users?per_page=100`);
  const users = usersResp.users ?? usersResp; // shape varies by SDK version
  const emailToId = Object.fromEntries(users.map(u => [u.email, u.id]));
  console.log(`Found ${users.length} auth users: ${Object.keys(emailToId).join(', ')}\n`);

  // Warn about CSV emails not in auth.users
  const acRows = parseCSV(join(CSV_DIR, 'AssetClass_export.csv'));
  [...new Set(acRows.map(r => r.created_by))].forEach(email => {
    if (!emailToId[email]) console.warn(`WARNING: "${email}" not in auth.users — their rows will be skipped`);
  });

  // 2. AssetClass
  console.log('[1/5] AssetClass');
  const acData = parseCSV(join(CSV_DIR, 'AssetClass_export.csv'));
  const acValid = acData.filter(r => emailToId[r.created_by]);
  const acInserted = await insertBatch('AssetClass', acValid.map(r => ({
    entity: 'AssetClass',
    user_id: emailToId[r.created_by],
    created_date: r.created_date || undefined,
    updated_date: r.updated_date || undefined,
    data: { ...stripMeta(r), created_by: r.created_by },
  })));
  const acIdMap = Object.fromEntries(acValid.map((r, i) => [r.id, acInserted[i]?.id]));
  console.log(`  inserted: ${acInserted.length}, skipped: ${acData.length - acValid.length}\n`);

  // 3. Instrument
  console.log('[2/5] Instrument');
  const instrData = parseCSV(join(CSV_DIR, 'Instrument_export.csv'));
  const instrValid = instrData.filter(r => emailToId[r.created_by]);
  const instrInserted = await insertBatch('Instrument', instrValid.map(r => {
    const clean = stripMeta(r);
    if (clean.asset_class_id) clean.asset_class_id = acIdMap[clean.asset_class_id] ?? clean.asset_class_id;
    return { entity: 'Instrument', user_id: emailToId[r.created_by], created_date: r.created_date || undefined, updated_date: r.updated_date || undefined, data: { ...clean, created_by: r.created_by } };
  }));
  const instrIdMap = Object.fromEntries(instrValid.map((r, i) => [r.id, instrInserted[i]?.id]));
  console.log(`  inserted: ${instrInserted.length}, skipped: ${instrData.length - instrValid.length}\n`);

  // 4. ManualAsset
  console.log('[3/5] ManualAsset');
  const maData = parseCSV(join(CSV_DIR, 'ManualAsset_export.csv'));
  const maValid = maData.filter(r => emailToId[r.created_by]);
  const maInserted = await insertBatch('ManualAsset', maValid.map(r => ({
    entity: 'ManualAsset',
    user_id: emailToId[r.created_by],
    created_date: r.created_date || undefined,
    updated_date: r.updated_date || undefined,
    data: { ...stripMeta(r), created_by: r.created_by },
  })));
  const maIdMap = Object.fromEntries(maValid.map((r, i) => [r.id, maInserted[i]?.id]));
  console.log(`  inserted: ${maInserted.length}, skipped: ${maData.length - maValid.length}\n`);

  // 5. Holding
  console.log('[4/5] Holding');
  const holdingData = parseCSV(join(CSV_DIR, 'Holding_export.csv'));
  const holdingValid = holdingData.filter(r => emailToId[r.created_by]);
  const holdingInserted = await insertBatch('Holding', holdingValid.map(r => {
    const clean = stripMeta(r);
    if (clean.instrument_id) clean.instrument_id = instrIdMap[clean.instrument_id] ?? clean.instrument_id;
    return { entity: 'Holding', user_id: emailToId[r.created_by], created_date: r.created_date || undefined, updated_date: r.updated_date || undefined, data: { ...clean, created_by: r.created_by } };
  }));
  console.log(`  inserted: ${holdingInserted.length}, skipped: ${holdingData.length - holdingValid.length}\n`);

  // 6. ManualAssetValue
  console.log('[5/5] ManualAssetValue');
  const mavData = parseCSV(join(CSV_DIR, 'ManualAssetValue_export.csv'));
  const mavValid = mavData.filter(r => emailToId[r.created_by]);
  const mavInserted = await insertBatch('ManualAssetValue', mavValid.map(r => {
    const clean = stripMeta(r);
    if (clean.manual_asset_id) clean.manual_asset_id = maIdMap[clean.manual_asset_id] ?? clean.manual_asset_id;
    return { entity: 'ManualAssetValue', user_id: emailToId[r.created_by], created_date: r.created_date || undefined, updated_date: r.updated_date || undefined, data: { ...clean, created_by: r.created_by } };
  }));
  console.log(`  inserted: ${mavInserted.length}, skipped: ${mavData.length - mavValid.length}\n`);

  console.log('── Done ──');
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
