// Poll a benchmark run to terminal and print its card. Usage: node poll-run.mjs <runId>
const CH = process.env.CH_URL || "http://127.0.0.1:42070";
const id = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) { const r = await fetch(url); try { return await r.json(); } catch { return null; } }
async function main() {
  for (let i = 0; i < 150; i++) {
    const d = await get(`${CH}/api/benchmarks/runs/${id}`);
    const run = d?.data?.run;
    if (!run) { console.log("no run"); return; }
    if (run.status !== "running" && run.status !== "pending") {
      const su = run.summary || {};
      console.log(`status=${run.status} execMode=${run.execMode} error=${run.error ?? "—"}`);
      console.log(`rating=${su.overallRating} itemsRun=${su.itemsRun} errorRate=${su.errorRate} togglesApplied=${su.togglesApplied}`);
      console.log(`stats=${JSON.stringify(su.stats)}`);
      console.log(`statSamples=${JSON.stringify(su.statSamples)}`);
      return;
    }
    await sleep(2000);
  }
  console.log("timed out");
}
main();
