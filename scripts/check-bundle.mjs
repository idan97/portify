// Fails if a known lib helper appears as a bare call in the built bundle,
// which means its import was stripped (the code-clean autofix hook has done
// this repeatedly). Rollup treats a stripped import as an undefined free
// global, so `npm run build` succeeds but the page crashes at runtime.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS = "dist/assets";
const SUSPECTS = [
  "convertManualValues",
  "convertHoldings",
  "instrumentCurrency",
  "useUsdRate",
  "latestByKey",
  "useToast",
];

const files = readdirSync(ASSETS).filter(
  (f) => f.startsWith("index-") && f.endsWith(".js")
);
if (files.length === 0) {
  console.error("check-bundle: no built bundle found in dist/assets");
  process.exit(1);
}

const src = files.map((f) => readFileSync(join(ASSETS, f), "utf8")).join("\n");
const broken = SUSPECTS.filter((name) => src.includes(name + "("));

if (broken.length) {
  console.error(
    `check-bundle: FAIL — bare helper call(s) in bundle (likely a stripped import): ${broken.join(", ")}`
  );
  process.exit(1);
}
console.log("check-bundle: OK — no bare helper references");
