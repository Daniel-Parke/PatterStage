/** @jest-environment node */
// ORACLE for T-0021 (WO-0014), part 3 of 4: the gate itself.
//
// checkUnattendedSpend is the ONLY thing in this feature that can prevent work
// from happening, so its default has to be "yes" and its refusal has to be
// narrow. Clauses 2, 4 and 5:
//
//   (2) no figure  -> never blocks, and never even reads the spend;
//   (4) a figure with the stop OFF -> never blocks (that is clause 3's warning);
//   (4) a figure with the stop ON and breached -> blocks, and says why;
//   (5) attended dispatch is never routed through this at all, which the
//       companion file spend-unattended-dispatch.test.ts proves.

import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

const readSpendPolicy = jest.fn();
const readRunUsageSince = jest.fn();
const readResearchUsageSince = jest.fn((_since: string) => [] as unknown[]);

jest.mock("@/lib/spend/spend-repository", () => ({
  readSpendPolicy: () => readSpendPolicy(),
  readRunUsageSince: (since: string) => readRunUsageSince(since),
  // The guard and the console now price the same window through one helper
  // (T-0108, D104), so the guard reaches research too. Empty here: these cases
  // are about the runs figure, and the parity is proven in spend-summary.
  readResearchUsageSince: (since: string) => readResearchUsageSince(since),
  writeSpendPolicy: jest.fn(),
}));

import { checkUnattendedSpend } from "@/lib/spend/spend-guard";

/** 1M in + 1M out on sonnet = 18 USD. */
const EIGHTEEN_DOLLARS = [
  {
    source: "agent" as const,
    model: "anthropic/claude-sonnet-4",
    usage: JSON.stringify({ inputTokens: 1_000_000, outputTokens: 1_000_000 }),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY });
  readRunUsageSince.mockReturnValue([]);
});

describe("checkUnattendedSpend: the default is yes", () => {
  it("allows dispatch on a fresh install and does not even price the window", () => {
    const v = checkUnattendedSpend();
    expect(v.allowed).toBe(true);
    expect(v.reason).toBeNull();
    // Clause 2 is about not being awkward. An install with no figure must not
    // pay for a spend aggregation on every scheduler tick either.
    expect(readRunUsageSince).not.toHaveBeenCalled();
  });

  it("allows dispatch when a figure is set but the stop is off, however far over", () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 1, period: "month" });
    readRunUsageSince.mockReturnValue(EIGHTEEN_DOLLARS);

    const v = checkUnattendedSpend();
    expect(v.allowed).toBe(true);
    expect(v.reason).toBeNull();
    expect(readRunUsageSince).not.toHaveBeenCalled();
  });

  it("allows dispatch when the stop is armed but the figure has not been reached", () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 100, period: "month", hardStop: true });
    readRunUsageSince.mockReturnValue(EIGHTEEN_DOLLARS);
    expect(checkUnattendedSpend().allowed).toBe(true);
  });
});

describe("checkUnattendedSpend: the refusal", () => {
  it("blocks and names the figure, the period and the spend", () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 10, period: "month", hardStop: true });
    readRunUsageSince.mockReturnValue(EIGHTEEN_DOLLARS);

    const v = checkUnattendedSpend();
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("18");
    expect(v.reason).toContain("10");
    expect(v.reason).toMatch(/month/i);
  });
});

describe("checkUnattendedSpend: what happens when the database will not answer", () => {
  // An install with no budget must never be broken by this feature, so a policy
  // read that fails cannot be treated as a stop: there is no evidence a stop
  // was ever armed, and the overwhelmingly common install has none.
  it("allows dispatch when the policy itself cannot be read", () => {
    readSpendPolicy.mockImplementation(() => {
      throw new Error("no such table: spend_policy");
    });
    const v = checkUnattendedSpend();
    expect(v.allowed).toBe(true);
    expect(v.reason).toBeNull();
  });

  // The other direction, and the reason this feature is tier R2. Here the
  // operator HAS armed a ceiling, and the system cannot prove it is under it.
  // Spending money on an unprovable assumption is the failure that costs
  // something; declining to is the failure that costs a delayed run.
  it("blocks when a stop is armed and the spend cannot be measured", () => {
    readSpendPolicy.mockReturnValue({ ...UNSET_SPEND_POLICY, limitUsd: 10, period: "month", hardStop: true });
    readRunUsageSince.mockImplementation(() => {
      throw new Error("disk I/O error");
    });

    const v = checkUnattendedSpend();
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/could not be measured|unable/i);
  });
});
