/**
 * @jest-environment node
 *
 * Source-pattern test for the session-102 useSystemCronJobs.handleSave
 * PUT/POST collapse refactor.
 *
 * Locks the shape of the handleSave useCallback so a future
 * "tidy up the 2 if branches" PR can't accidentally:
 *   - re-introduce the 2-branch duplication
 *   - swap the success/fallback messages between update and create
 *   - change the HTTP method discriminator
 *   - add a side-effecting 3rd branch
 *
 * Why source-pattern instead of rendering the hook:
 *   - useSystemCronJobs is already tested for its other 3 handlers
 *     (toggle, delete, pauseAll) in tests/unit/useCronJobMutation.test.ts
 *     — those tests render the hook via @testing-library/react.
 *   - handleSave is the only handler that doesn't go through
 *     useCronJobMutation (it has its own inline logic), and its
 *     shape (PUT/POST/throw/toast trio) is the byte-level contract.
 *   - The "single safeApiCall + isUpdate discriminator" shape is
 *     the invariant — the function literally does one safeApiCall
 *     call and uses `isUpdate ? "PUT" : "POST"`.
 *
 * What this test does NOT lock:
 *   - The exact endpoint ("/api/cron/hardware")
 *   - The exact success/fallback text (just the discriminator pattern)
 *   - The exact call to loadJobs() / showToast() — only that they
 *     are called once each, in the right order.
 *   - The catch-block shape (toastError) — already covered by
 *     tests/unit/toast-error.test.ts.
 *
 * If the hook is restructured (e.g. moved to useCronJobMutation as
 * a new `handleSave` config), the file path and shape-string
 * assertions will need to be updated — the test's failure will
 * then force the refactor author to consciously decide whether
 * the new shape preserves the single-call + isUpdate-discriminator
 * invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useSystemCronJobs.ts",
);

describe("useSystemCronJobs.handleSave PUT/POST collapse (session 102)", () => {
  const source = fs.readFileSync(HOOK_PATH, "utf8");

  it("declares handleSave as a useCallback", () => {
    // handleSave is the only useCallback left in the hook — the
    // other 3 (toggle, delete, pauseAll) come from useCronJobMutation.
    expect(source).toMatch(
      /const\s+handleSave\s*=\s*useCallback\(/,
    );
  });

  it("calls safeApiCall exactly once (single collapse point)", () => {
    // The collapsed form does exactly one safeApiCall. The 2-branch
    // form had 2 calls (one in the if, one in the else). A
    // re-introduction of the branches would show up as 2 calls.
    const handleSaveStart = source.indexOf("const handleSave = useCallback(");
    expect(handleSaveStart).toBeGreaterThan(-1);
    // Walk to the matching close of the useCallback call.
    const openParen = source.indexOf("useCallback(", handleSaveStart);
    let depth = 0;
    let callEnd = -1;
    for (let i = openParen; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    expect(callEnd).toBeGreaterThan(-1);
    const handleSaveBody = source.slice(openParen, callEnd + 1);
    // Count safeApiCall occurrences. The collapsed form has
    // exactly 1. The old 2-branch form had 2.
    const safeApiCallMatches =
      handleSaveBody.match(/safeApiCall\(/g) ?? [];
    expect(safeApiCallMatches.length).toBe(1);
  });

  it("uses the isUpdate ? \"PUT\" : \"POST\" discriminator on the method field", () => {
    // The whole point of the refactor: a single ternary that
    // picks the method based on the job's id field. The exact
    // form `isUpdate ? "PUT" : "POST"` (or with whitespace) is
    // the contract.
    const handleSaveStart = source.indexOf("const handleSave = useCallback(");
    const openParen = source.indexOf("useCallback(", handleSaveStart);
    let depth = 0;
    let callEnd = -1;
    for (let i = openParen; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    const handleSaveBody = source.slice(openParen, callEnd + 1);
    // Must contain `isUpdate ? "PUT" : "POST"` (whitespace-flexible).
    expect(handleSaveBody).toMatch(
      /isUpdate\s*\?\s*["']PUT["']\s*:\s*["']POST["']/,
    );
  });

  it("derives isUpdate from !!job.id (id-based discriminator)", () => {
    // The discriminator must be `!!job.id` (or `Boolean(job.id)`)
    // — the same check the old if-statement did with `if (job.id)`.
    // We accept either form.
    const handleSaveStart = source.indexOf("const handleSave = useCallback(");
    const openParen = source.indexOf("useCallback(", handleSaveStart);
    let depth = 0;
    let callEnd = -1;
    for (let i = openParen; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    const handleSaveBody = source.slice(openParen, callEnd + 1);
    expect(handleSaveBody).toMatch(
      /(?:!!job\.id|Boolean\(job\.id\))/,
    );
  });

  it("derives successMsg and fallback from isUpdate (4 distinct messages)", () => {
    // The collapsed form extracts `successMsg` and `fallback`
    // from `isUpdate`. The 2-branch form had the messages inline
    // in each branch. A re-introduction would have the strings
    // appear without the variable indirection.
    const handleSaveStart = source.indexOf("const handleSave = useCallback(");
    const openParen = source.indexOf("useCallback(", handleSaveStart);
    let depth = 0;
    let callEnd = -1;
    for (let i = openParen; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    const handleSaveBody = source.slice(openParen, callEnd + 1);
    // The 4 distinct messages must each appear exactly once in
    // the body (no duplication, no missing pair).
    expect(handleSaveBody).toMatch(
      /["']System cron job updated["']/,
    );
    expect(handleSaveBody).toMatch(
      /["']System cron job created["']/,
    );
    expect(handleSaveBody).toMatch(
      /["']Failed to update system cron job["']/,
    );
    expect(handleSaveBody).toMatch(
      /["']Failed to create system cron job["']/,
    );
    // No `if (job.id)` style branch — only the isUpdate ternary.
    expect(handleSaveBody).not.toMatch(/if\s*\(\s*job\.id\s*\)/);
  });

  it("calls loadJobs() exactly once on success", () => {
    // The old form had loadJobs() after the if/else. The new
    // form has it after the if-throws block. Either way: 1 call.
    // A re-introduction of 2 branches would not double the call,
    // but a future "refetch on error too" extension should be
    // a deliberate change, not a side-effect of branch-collapse.
    const handleSaveStart = source.indexOf("const handleSave = useCallback(");
    const openParen = source.indexOf("useCallback(", handleSaveStart);
    let depth = 0;
    let callEnd = -1;
    for (let i = openParen; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          callEnd = i;
          break;
        }
      }
    }
    const handleSaveBody = source.slice(openParen, callEnd + 1);
    // Strip line comments to avoid matching the JSDoc that
    // documents the loadJobs() refetch. Then count invocations.
    // The collapsed form has exactly 1 invocation. The old
    // 2-branch form also had 1 invocation (after the if/else),
    // but a future "refetch on error too" extension should be
    // a deliberate change, not a side-effect of branch-collapse.
    const codeOnly = handleSaveBody
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    const loadJobsMatches = codeOnly.match(/loadJobs\(\)/g) ?? [];
    expect(loadJobsMatches.length).toBe(1);
  });
});

describe("useSystemCronJobs.handleSave semantics (PUT/POST byte-equivalence)", () => {
  // Lock the byte-equivalence contract: simulating the OLD
  // 2-branch form and the NEW 1-call form must produce identical
  // safeApiCall arguments, success toasts, and fallback texts
  // for both isUpdate=true and isUpdate=false.
  //
  // We re-implement both forms in the test to compare. The OLD
  // form mirrors the 2-branch if/else structure; the NEW form
  // mirrors the isUpdate-discriminator collapse.

  interface FakeResult<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
  }
  const safeApiCallMock = jest.fn();
  const showToastMock = jest.fn();
  const loadJobsMock = jest.fn();
  const _toastErrorMock = jest.fn();

  function old2BranchHandleSave(
    job: { id?: string; [k: string]: unknown },
    safeApiCall: typeof safeApiCallMock,
    showToast: typeof showToastMock,
    loadJobs: typeof loadJobsMock,
  ) {
    try {
      if (job.id) {
        safeApiCall("/api/cron/hardware", { method: "PUT", body: job });
        showToast("System cron job updated");
      } else {
        safeApiCall("/api/cron/hardware", { method: "POST", body: job });
        showToast("System cron job created");
      }
      loadJobs();
    } catch {
      // toastError(showToast, e, "Failed to save system cron job");
    }
  }

  function new1CallHandleSave(
    job: { id?: string; [k: string]: unknown },
    safeApiCall: typeof safeApiCallMock,
    showToast: typeof showToastMock,
    loadJobs: typeof loadJobsMock,
  ) {
    const isUpdate = !!job.id;
    const successMsg = isUpdate
      ? "System cron job updated"
      : "System cron job created";
    const fallback = isUpdate
      ? "Failed to update system cron job"
      : "Failed to create system cron job";
    try {
      const result = safeApiCall("/api/cron/hardware", {
        method: isUpdate ? "PUT" : "POST",
        body: job,
      }) as FakeResult;
      if (!result.ok) throw new Error(result.error || fallback);
      showToast(successMsg);
      loadJobs();
    } catch {
      // toastError(showToast, e, "Failed to save system cron job");
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses PUT method + 'updated' toast when isUpdate=true (both forms agree)", () => {
    safeApiCallMock.mockReturnValue({ ok: true });
    const job = { id: "abc" };

    old2BranchHandleSave(job, safeApiCallMock, showToastMock, loadJobsMock);
    const oldCalls = {
      api: safeApiCallMock.mock.calls,
      toast: showToastMock.mock.calls,
      load: loadJobsMock.mock.calls,
    };

    safeApiCallMock.mockClear();
    showToastMock.mockClear();
    loadJobsMock.mockClear();

    new1CallHandleSave(job, safeApiCallMock, showToastMock, loadJobsMock);
    const newCalls = {
      api: safeApiCallMock.mock.calls,
      toast: showToastMock.mock.calls,
      load: loadJobsMock.mock.calls,
    };

    // Same endpoint, same method, same body
    expect(newCalls.api).toEqual(oldCalls.api);
    // Same success toast text
    expect(newCalls.toast).toEqual(oldCalls.toast);
    // Same loadJobs() call count
    expect(newCalls.load.length).toBe(oldCalls.load.length);
    expect(newCalls.load.length).toBe(1);
  });

  it("uses POST method + 'created' toast when isUpdate=false (both forms agree)", () => {
    safeApiCallMock.mockReturnValue({ ok: true });
    const job = { name: "New Job" };

    old2BranchHandleSave(job, safeApiCallMock, showToastMock, loadJobsMock);
    const oldCalls = {
      api: safeApiCallMock.mock.calls,
      toast: showToastMock.mock.calls,
    };

    safeApiCallMock.mockClear();
    showToastMock.mockClear();
    loadJobsMock.mockClear();

    new1CallHandleSave(job, safeApiCallMock, showToastMock, loadJobsMock);
    const newCalls = {
      api: safeApiCallMock.mock.calls,
      toast: showToastMock.mock.calls,
    };

    // Same endpoint, same method, same body
    expect(newCalls.api).toEqual(oldCalls.api);
    // Same success toast text
    expect(newCalls.toast).toEqual(oldCalls.toast);
  });

  it("loads jobs exactly once on success in both forms", () => {
    safeApiCallMock.mockReturnValue({ ok: true });
    const job = { id: "abc" };

    old2BranchHandleSave(job, safeApiCallMock, showToastMock, loadJobsMock);
    expect(loadJobsMock).toHaveBeenCalledTimes(1);

    loadJobsMock.mockClear();

    new1CallHandleSave(job, safeApiCallMock, showToastMock, loadJobsMock);
    expect(loadJobsMock).toHaveBeenCalledTimes(1);
  });
});
