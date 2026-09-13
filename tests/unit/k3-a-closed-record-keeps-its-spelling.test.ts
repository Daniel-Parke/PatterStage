/**
 * @jest-environment node
 *
 * K3-A · A closed record keeps its spelling.
 *
 * The C7 codemod rewrote every mention of the files it moved out of the lib
 * root, and it did not stop at source. It walked the governance corpus too, so
 * records that had been closed for weeks came out naming paths that did not
 * exist on the day they were written. A history that silently re-spells itself
 * stops being evidence: the record of what was decided no longer says when it
 * was decided, and the next reader cannot tell a rewrite from a fact.
 *
 * This gate holds the property, not the incident. It reads the move table the
 * codemod was itself driven from (`scripts/tooling/lib-moves.json`) and each
 * record's own timestamps, so the next move over that table is gated by the
 * same test with no edit to it. It names no file that has to be fixed and
 * counts none of them; the count is the implementation's shape, and pinning it
 * would make the next move a test edit.
 *
 * Two spellings are in scope for every move, because the codemod wrote both:
 * the written path (`src/lib/api/api-auth.ts`) and the alias
 * (`@/lib/api/api-auth`).
 *
 * The mirror invariant matters as much. Some of what the codemod wrote is
 * ratified and stays — the policy's own sensitive-path entries, the ADRs it
 * reached into, the files the move legitimately claimed, and any record that
 * was still live when it ran. So this suite never forbids the new spelling
 * outright. It forbids it only where the timestamps say the text is older than
 * the move, and it separately refuses a revert that would leave the repository
 * pointing at a file that is no longer there.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");

/** Repository-relative, always written with forward slashes, as the corpus does. */
const posix = (...parts: string[]) => parts.join("/");
const abs = (repoPath: string) => join(ROOT, ...repoPath.split("/"));
const read = (repoPath: string) => readFileSync(abs(repoPath), "utf-8");

/**
 * The table the codemod moved by, and the table this test reads: stem -> the
 * path the file was moved to. A move that is not in here is not gated, and a
 * move that is added to it is gated from that moment, which is the point.
 */
const MOVE_MAP = posix("scripts", "tooling", "lib-moves.json");

interface Move {
  /** The bare filename the file had while it sat directly under src/lib. */
  stem: string;
  /** How the move's own commit can be recognised in text it did not write. */
  before: string;
  /** The two spellings the move created, both of which it wrote into prose. */
  after: string[];
  /** The written path, for the revert check. */
  afterPath: string;
}

function readMoves(): Move[] {
  const table = JSON.parse(read(MOVE_MAP)) as Record<string, string>;
  return Object.entries(table).map(([stem, afterPath]) => ({
    stem,
    before: `src/lib/${stem}.ts`,
    afterPath,
    after: [afterPath, `@/lib/${afterPath.replace(/^src\/lib\//, "").replace(/\.ts$/, "")}`],
  }));
}

/** A path the move created, if this text names one. Reported, never counted. */
function anachronism(text: string, moves: Move[]): string | null {
  for (const move of moves) {
    for (const spelling of move.after) if (text.includes(spelling)) return spelling;
  }
  return null;
}

interface TaskRecord {
  file: string;
  raw: string;
  status?: string;
  claims?: string[];
  timestamps?: { opened?: string; updated?: string; closed?: string | null };
}

function readTasks(): TaskRecord[] {
  const dir = join(ROOT, "org", "tasks");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const raw = readFileSync(join(dir, name), "utf-8");
      return { ...(JSON.parse(raw) as Omit<TaskRecord, "file" | "raw">), file: posix("org", "tasks", name), raw };
    });
}

/**
 * The statuses that mean the work stopped. A status this test does not know is
 * treated as live and left alone: an oracle that guesses in the strict
 * direction fails work that is correct, which is the one thing it must not do.
 */
const TERMINAL = new Set(["done", "discarded", "cancelled", "superseded"]);

/**
 * When a record stopped moving, in epoch milliseconds, or null while it is
 * still live.
 *
 * Most records carry `timestamps.closed`. A handful of done ones never got
 * one, and for those the last `updated` is the moment the record stopped being
 * touched, which is the same fact. A record with neither is not datable and
 * cannot be judged, so it is out of scope rather than guessed at.
 */
function closedAt(record: TaskRecord): number | null {
  if (!TERMINAL.has(record.status ?? "")) return null;
  const stamp = record.timestamps?.closed ?? record.timestamps?.updated ?? null;
  if (typeof stamp !== "string") return null;
  const at = Date.parse(stamp);
  return Number.isFinite(at) ? at : null;
}

/**
 * When the move happened, taken from the repository rather than from a date in
 * this file: the task that claimed the move table is the task that did the
 * move, and it cannot have moved anything before it opened.
 *
 * If the table is ever extended by a second move, the earliest claimant is
 * still the right boundary. Text older than the first move is older than every
 * path in the table; text written between two moves is out of scope, which is
 * the lenient reading and the safe one.
 */
function moveOpenedAt(tasks: TaskRecord[]): number {
  const claimants = tasks
    .filter((task) => (task.claims ?? []).includes(MOVE_MAP))
    .map((task) => Date.parse(task.timestamps?.opened ?? ""))
    .filter((at) => Number.isFinite(at));
  return Math.min(...claimants);
}

/** Every file under a directory, repository-relative, forward-slashed. */
function filesUnder(repoDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else out.push(next.slice(ROOT.length + 1).split(sep).join("/"));
    }
  };
  walk(abs(repoDir));
  return out.sort();
}

describe("K3-A · a record closed before a move cannot name a path the move created", () => {
  const moves = readMoves();
  const tasks = readTasks();
  const movedAt = moveOpenedAt(tasks);

  it("knows the move table and when the move ran, so nothing below passes vacuously", () => {
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.afterPath.startsWith("src/lib/"))).toBe(true);
    // Read from the claiming record, so this stays true when the table grows.
    expect(Number.isFinite(movedAt)).toBe(true);
  });

  it("leaves no task record that closed before the move naming a path the move created", () => {
    const history = tasks.filter((task) => {
      const at = closedAt(task);
      return at !== null && at < movedAt;
    });
    expect(history.length).toBeGreaterThan(0);

    const rewritten = history
      .map((task) => ({ file: task.file, spelling: anachronism(task.raw, moves) }))
      .filter((hit) => hit.spelling !== null)
      .map((hit) => `${hit.file} names ${hit.spelling}`);
    expect(rewritten).toEqual([]);
  });

  it("leaves no Session 0 artefact naming a path the move created", () => {
    // Session 0 is a single dated event that closed long before any move in
    // the table; everything under its directory is its raw record. The
    // directory is the property, so a fourth artefact is gated on arrival.
    const artefacts = filesUnder(posix("org", "eos-session0"));
    expect(artefacts.length).toBeGreaterThan(0);

    const rewritten = artefacts
      .map((file) => ({ file, spelling: anachronism(read(file), moves) }))
      .filter((hit) => hit.spelling !== null)
      .map((hit) => `${hit.file} names ${hit.spelling}`);
    expect(rewritten).toEqual([]);
  });

  it("leaves no dated feedback entry naming a path created after it was filed", () => {
    // EOS_FEEDBACK.md is append-only and every entry carries its own date, so
    // the same predicate applies one entry at a time rather than to the file.
    const feedback = read(posix("org", "EOS_FEEDBACK.md"));
    const entries: { date: string; at: number; lines: string[] }[] = [];
    for (const line of feedback.split("\n")) {
      const opened = /^- `(\d{4}-\d{2}-\d{2}) · [a-z-]+`/.exec(line);
      if (opened) entries.push({ date: opened[1], at: Date.parse(`${opened[1]}T23:59:59Z`), lines: [line] });
      else entries[entries.length - 1]?.lines.push(line);
    }
    const filedBefore = entries.filter((entry) => entry.at < movedAt);
    expect(filedBefore.length).toBeGreaterThan(0);

    const rewritten = filedBefore
      .map((entry) => ({ entry, spelling: anachronism(entry.lines.join("\n"), moves) }))
      .filter((hit) => hit.spelling !== null)
      .map((hit) => `the ${hit.entry.date} entry names ${hit.spelling}`);
    expect(rewritten).toEqual([]);
  });
});

describe("K3-A · what the move was entitled to rewrite is not reverted with it", () => {
  const moves = readMoves();
  const tasks = readTasks();
  const movedAt = moveOpenedAt(tasks);

  /**
   * The text the move was entitled to write, and which a restore must not
   * reach into: the decisions the operator ratified, the files the move
   * declared as its own claims, and any record that was still open while it
   * ran. None is a hand-written list — each is read out of the repository.
   */
  function sanctioned(): { label: string; text: string }[] {
    const claimed = new Set(tasks.filter((task) => (task.claims ?? []).includes(MOVE_MAP)).flatMap((task) => task.claims ?? []));
    const files = [
      ...filesUnder(posix("org", "decisions")),
      ...[...claimed].filter((claim) => claim.startsWith("org/") && !claim.endsWith("/") && existsSync(abs(claim))),
    ];
    // Open when the move ran: opened before it, and not closed before it. A
    // record opened afterwards is free to quote a pre-move path while telling
    // the story of the move, and is none of this check's business.
    const live = tasks.filter((task) => {
      const opened = Date.parse(task.timestamps?.opened ?? "");
      const at = closedAt(task);
      return Number.isFinite(opened) && opened < movedAt && (at === null || at >= movedAt);
    });
    return [
      ...files.map((file) => ({ label: file, text: read(file) })),
      ...live.map((task) => ({ label: task.file, text: task.raw })),
    ];
  }

  it("keeps the current spelling wherever a pre-move path is still named", () => {
    const targets = sanctioned();
    expect(targets.length).toBeGreaterThan(0);

    // Given a file the move was entitled to rewrite, when it names the path a
    // file had before the move, then it names the path the file has now too,
    // in one spelling or the other. A restore that reached in here would leave
    // the old path alone on the page, pointing at a file that is not there;
    // text that names both is telling the story, which is allowed.
    const dangling: string[] = [];
    for (const target of targets) {
      for (const move of moves) {
        if (target.text.includes(move.before) && !move.after.some((spelling) => target.text.includes(spelling))) {
          dangling.push(`${target.label} names ${move.before}, which no longer exists`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("keeps every literal path in the policy's own path patterns pointing at something", () => {
    // This is why the two auth entries were ratified rather than reverted: the
    // auth-surface risk factor is routed by `paths:sensitive`, and a pattern
    // that matches nothing routes nothing. Behaviour, not wording.
    const policy = JSON.parse(read(posix("org", "policy.json"))) as {
      risk: { path_patterns: Record<string, string[]> };
    };
    const patterns = Object.entries(policy.risk.path_patterns);
    expect(patterns.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const [band, list] of patterns) {
      for (const pattern of list) {
        if (/[*?]/.test(pattern)) continue; // a glob is matched at gate time, not resolved here
        if (!existsSync(abs(pattern))) missing.push(`${band}: ${pattern}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("K3-A · the ADR index is complete", () => {
  it("gives every decision under org/decisions/ a row in the public index", () => {
    // docs/adr/README.md is the front door a reader arrives at; a decision
    // with no row there is a decision nobody finds. ADR-0007 made docs/adr/
    // the home, ADR-0008 moved the home and left this file as the pointer, so
    // the index is the only thing standing between the corpus and a reader.
    const index = read(posix("docs", "adr", "README.md"));
    const filed = filesUnder(posix("org", "decisions"))
      .map((file) => /(ADR-\d{4})/.exec(file)?.[1])
      .filter((id): id is string => Boolean(id));
    expect(filed.length).toBeGreaterThan(0);

    const rows = new Set([...index.matchAll(/^\|\s*\[?(ADR-\d{4})/gm)].map((row) => row[1]));
    expect(filed.filter((id) => !rows.has(id))).toEqual([]);
  });

  it("points every row at a decision that is actually there", () => {
    const index = read(posix("docs", "adr", "README.md"));
    const links = [...index.matchAll(/\]\(\.\.\/\.\.\/(org\/decisions\/[^)]+)\)/g)].map((link) => link[1]);
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((link) => !existsSync(abs(link)))).toEqual([]);
  });
});
