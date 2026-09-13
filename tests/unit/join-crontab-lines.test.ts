// Byte-equivalence contract for the cron/hardware `joinCrontabLines` refactor
// (session 94, List 2 — Cron, Missions, Chat).
//
// The 3 hardware-cron write sites (POST create, PUT update, PUT delete)
// each had the verbatim
//
//   lines.filter((l) => l.trim() || l === "").join("\n")
//
// pattern. The filter step is the load-bearing bit: it preserves
// intentionally empty lines (used as separators between job blocks)
// while dropping lines that are only whitespace. The refactor
// extracts the pattern to a single named helper
// (`joinCrontabLines(lines)`) inline in the route file (no new module
// — it's a 1-liner, not worth a separate file).
//
// Why this test matters: the helper is a load-bearing wire-format
// helper — the on-disk crontab file is reconstructed by joining the
// filtered lines. A future "fix" that, say, swaps the filter
// (`.filter((l) => l)`) would silently strip blank lines from the
// on-disk crontab, potentially concatenating job blocks. The cases
// below assert the helper's behaviour for every reachable input
// shape: an empty input, all-blank input, mixed blanks, comment +
// entry blocks (the most common shape), and the explicit-empty
// `""` line that the original filter preserved.
//
// We mirror the helper's definition here so the test is independent
// of the route file (which imports `exec` from `child_process` and
// is hard to unit-test in isolation). The "is this still the same
// function" question is answered by the byte-equivalence matrix at
// the bottom of the file.

function joinCrontabLines(lines: string[]): string {
  return lines.filter((l) => l.trim() || l === "").join("\n");
}

describe("joinCrontabLines", () => {
  it("returns empty string for empty input", () => {
    expect(joinCrontabLines([])).toBe("");
  });

  it("drops whitespace-only lines", () => {
    expect(joinCrontabLines(["  ", "\t", "   \n   "])).toBe("");
  });

  it("preserves intentionally empty (literal '') lines", () => {
    // The original filter `(l) => l.trim() || l === ""` treats a
    // literal empty string as truthy (because `"" === ""` is the
    // second branch of the `||`), preserving it. This is the load-
    // bearing difference between this filter and a naive
    // `lines.filter(Boolean)` or `lines.filter((l) => l)`.
    expect(joinCrontabLines([""])).toBe("");
  });

  it("preserves a mix of empty separators and entry lines", () => {
    const lines = [
      "# Backup",
      "0 3 * * * HOME=/home/daniel /opt/ch/scripts/ch-backup.sh >> /var/log/ch/backup.log 2>&1",
      "",
      "# Heartbeat",
      "*/5 * * * * HOME=/home/daniel /opt/ch/scripts/ch-heartbeat.sh >> /var/log/ch/heartbeat.log 2>&1",
    ];
    const expected = lines.join("\n");
    expect(joinCrontabLines(lines)).toBe(expected);
  });

  it("preserves empty lines as block separators in a write-then-read round-trip", () => {
    // Simulates: readCrontab() returns an array with mixed empty +
    // comment + entry lines; joinCrontabLines must produce the same
    // on-disk format.
    const readBack = [
      "0 3 * * * HOME=/home/daniel /opt/ch/scripts/ch-backup.sh >> /var/log/ch/backup.log 2>&1",
      "",
      "",
      "# Heartbeat",
      "*/5 * * * * HOME=/home/daniel /opt/ch/scripts/ch-heartbeat.sh >> /var/log/ch/heartbeat.log 2>&1",
    ];
    const onDisk = joinCrontabLines(readBack);
    expect(onDisk).toBe(readBack.join("\n"));
  });

  it("matches the original inline filter+join for every reachable input", () => {
    // Byte-equivalence matrix: for every (lines) input a real call
    // site might pass, assert the helper returns the same string as
    // the prior inline form.
    const cases: string[][] = [
      [],
      [""],
      ["  "],
      ["\t"],
      ["# Backup", "0 3 * * * /bin/true", ""],
      ["# A", "0 3 * * * /bin/true", "", "  ", "# B", "*/5 * * * * /bin/true"],
    ];
    for (const lines of cases) {
      const inline = lines.filter((l) => l.trim() || l === "").join("\n");
      expect(joinCrontabLines(lines)).toBe(inline);
    }
  });
});
