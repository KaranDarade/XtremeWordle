#!/usr/bin/env node
/**
 * Lightweight load probe for the arena's hot endpoints.
 *
 * Uses only Node's built-in fetch, so there is nothing to install:
 *   node scripts/loadtest.mjs --concurrency 50 --duration 15
 *
 * Run it against `npm run build && npm run start` (not `next dev`) for numbers
 * that reflect production.
 */

const args = process.argv.slice(2);

function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const BASE = flag("url", "http://localhost:3000").replace(/\/$/, "");
const CONCURRENCY = Number(flag("concurrency", 25));
const DURATION_MS = Number(flag("duration", 10)) * 1000;

/** A mix of a dynamic page, a light page and the two hot API reads. */
const ENDPOINTS = ["/", "/games", "/api/health", "/api/presence"];

const latencies = [];
let ok = 0;
let failed = 0;
let stop = false;

async function worker(workerId) {
  let index = workerId;

  while (!stop) {
    const path = ENDPOINTS[index % ENDPOINTS.length];
    index += 1;

    const started = performance.now();
    try {
      const response = await fetch(BASE + path, {
        headers: { "user-agent": "wordle-arena-loadtest" },
      });
      await response.arrayBuffer();
      if (response.ok) ok += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
    latencies.push(performance.now() - started);
  }
}

console.log(`Probing ${BASE} with ${CONCURRENCY} workers for ${DURATION_MS / 1000}s…`);

const startedAt = Date.now();
const timer = setTimeout(() => {
  stop = true;
}, DURATION_MS);

await Promise.all(Array.from({ length: CONCURRENCY }, (_, id) => worker(id)));
clearTimeout(timer);

const elapsedSeconds = (Date.now() - startedAt) / 1000;
latencies.sort((a, b) => a - b);

const percentile = (p) => {
  if (latencies.length === 0) return 0;
  return latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
};

const total = ok + failed;

console.log("");
console.log("──────────────────────────────────────────");
console.log(`  requests      ${total} (${ok} ok, ${failed} failed)`);
console.log(`  throughput    ${(total / elapsedSeconds).toFixed(0)} req/s`);
console.log(`  latency p50   ${percentile(0.5).toFixed(1)} ms`);
console.log(`  latency p90   ${percentile(0.9).toFixed(1)} ms`);
console.log(`  latency p99   ${percentile(0.99).toFixed(1)} ms`);
console.log(`  latency max   ${(latencies[latencies.length - 1] ?? 0).toFixed(1)} ms`);
console.log("──────────────────────────────────────────");
console.log("");
console.log("Rough capacity guide (2 players per duel, ~8 polls/min each):");
console.log("  comfortable  ~100-300 concurrent players on a local machine");
console.log("  tuned        ~500-800 with `next start` and a larger pg pool");
console.log("  VPS          ~1,000-3,000 behind PgBouncer");
console.log("Watch the database connection pool first — it saturates before the CPU.");
