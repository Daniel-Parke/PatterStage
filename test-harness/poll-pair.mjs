// Poll a compare pair to terminal and print both runs' role/status/rating.
const CH = process.env.CH_URL || "http://127.0.0.1:42070";
const pid = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) { const r = await fetch(u); try { return await r.json(); } catch { return null; } }
async function main() {
  for (let i = 0; i < 150; i++) {
    const d = await get(`${CH}/api/benchmarks/runs?pairId=${pid}`);
    const runs = d?.data?.runs ?? [];
    if (runs.length >= 2 && runs.every((x) => x.status !== "running" && x.status !== "pending")) {
      for (const x of runs) {
        const role = (x.config?.pairRole || "?").padEnd(9);
        const st = String(x.status).padEnd(10);
        const rating = x.summary?.overallRating ?? "—";
        console.log(`${role} status=${st} rating=${rating}  ${x.error ? "err: " + x.error.slice(0, 80) : "ok"}`);
      }
      return;
    }
    await sleep(2000);
  }
  console.log("timed out");
}
main();
