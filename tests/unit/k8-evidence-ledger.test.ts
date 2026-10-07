/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const reviewPath = "org/reviews/2026-09-codebase-review.md";
const evidencePath = "org/reviews/2026-09-codebase-review-evidence.md";
const ledgerPath = "org/reviews/2026-09-evidence-ledger.jsonl";
const addendumPath = "org/reviews/2026-09-refactor-addendum.md";
const read = (path: string) => readFileSync(join(root, path), "utf8");

type LedgerEntry = {
  kind: "finding" | "gap";
  id: string;
  source: { file: string; line: number };
  text?: string;
  operatorDecision?: boolean;
  decisionRecord?: string;
  freeBandReason?: string;
  status: string;
  evidence?: string;
};

function ledger(): LedgerEntry[] {
  return read(ledgerPath)
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as LedgerEntry);
}

function originalFindings() {
  const index = read(reviewPath);
  const evidence = read(evidencePath);
  const surviving = [...index.matchAll(/^- `([a-z-]+-\d+)`/gm)].map((match) => match[1]);
  const refuted = [...evidence.matchAll(/^- \*\*([a-z-]+-\d+) ·/gm)].map((match) => match[1]);
  return { surviving, refuted };
}

function originalGaps() {
  const lines = read(evidencePath).split("\n");
  const gaps: Array<{ line: number; text: string }> = [];
  let inGapList = false;
  for (const [index, line] of lines.entries()) {
    if (line === "### Not examined") {
      inGapList = true;
    } else if (/^#{1,3} /.test(line)) {
      inGapList = false;
    } else if (inGapList && line.startsWith("- ")) {
      gaps.push({ line: index + 1, text: line.slice(2) });
    }
  }
  return gaps;
}

describe("T-0159 · the evidence register is traceable", () => {
  it("accounts for all 265 preliminary findings by their original identities", () => {
    const { surviving, refuted } = originalFindings();
    expect(surviving).toHaveLength(257);
    expect(refuted).toHaveLength(8);
    const findings = ledger().filter((row) => row.kind === "finding");
    expect(findings).toHaveLength(265);
    expect(findings.map((row) => row.id).sort()).toEqual([...surviving, ...refuted].sort());
    expect(new Set(findings.map((row) => row.id)).size).toBe(265);
    expect(findings.every((row) => row.source.line > 0 && row.evidence)).toBe(true);
  });

  it("maps each original Not examined bullet without calling a compound bullet an atomic investigation", () => {
    const gaps = originalGaps();
    expect(gaps).toHaveLength(107);
    const mapped = ledger().filter((row) => row.kind === "gap");
    expect(mapped).toHaveLength(gaps.length);
    expect(mapped.map((row) => ({ line: row.source.line, text: row.text }))).toEqual(gaps);
    expect(mapped.every((row) => row.source.file === evidencePath && row.status && row.evidence)).toBe(true);
  });

  it("gives every originally operator-owned finding a decision or an explicit free-band correction", () => {
    const operatorIds = [...read(reviewPath).matchAll(/^- `([a-z-]+-\d+)`.*\*\*OP\*\*/gm)].map(
      (match) => match[1],
    );
    expect(operatorIds).toHaveLength(110);
    const byId = new Map(ledger().filter((row) => row.kind === "finding").map((row) => [row.id, row]));
    expect(
      operatorIds.filter((id) => {
        const row = byId.get(id);
        return !row?.operatorDecision || !(row.decisionRecord || row.freeBandReason);
      }),
    ).toEqual([]);
  });

  it("records the ten new operator decisions and the Select and Picker correction", () => {
    const text = read(addendumPath);
    for (let id = 19; id <= 28; id += 1) {
      expect(text).toContain(`Q-${String(id).padStart(3, "0")}`);
    }
    expect(text).toMatch(/16\.3\.6/);
    expect(text).toMatch(/Select and Picker remain separate/);
    expect(text).toMatch(/30-minute inactivity/);
    expect(text).toMatch(/12-hour absolute/);
    expect(text).toMatch(/elapsed run deadlines/);
  });
});
