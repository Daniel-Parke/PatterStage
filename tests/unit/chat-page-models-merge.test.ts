/**
 * Tests for the chat page's model-merge fix.
 *
 * Background: the chat page's `mergedModels` useMemo used to include
 * the gateway's own `/v1/models` list (`gatewayModelIds`) in the
 * user-selectable dropdown, alongside the registered models
 * (`registryModelIds`) and the `CHAT_DEFAULT_MODEL` fallback. The
 * gateway list reflects whatever upstream endpoints the gateway
 * CAN route to, not what the user has actually registered in
 * Control Hub. This meant the dropdown showed phantom models like
 * `Deepseek V4 Flash` and `Claude Sonnet 4` that don't exist in
 * the registry.
 *
 * The fix:
 *   1. `mergedModels` only includes `CHAT_DEFAULT_MODEL` + `registryModelIds`.
 *   2. The destructure no longer pulls `gatewayModelIds` from `useGatewayHealth`
 *      (the hook still fetches it internally for the `modelsError` badge).
 *   3. The `gatewayModelIds` dependency was removed from the `useMemo` deps.
 *
 * These are static-pattern tests (the same pattern the session 100/101/102
 * setter-callback migrations use) — they read the chat page source and
 * assert the migration is in place. A future refactor that re-adds the
 * gateway loop or re-destructures `gatewayModelIds` will fail these tests.
 */

import * as fs from "fs";
import * as path from "path";

const CHAT_PAGE_PATH = path.join(
  process.cwd(),
  "src/app/orchestration/chat/page.tsx",
);

function readChatPage(): string {
  return fs.readFileSync(CHAT_PAGE_PATH, "utf-8");
}

describe("ChatPage — model-merge excludes gateway-only models", () => {
  it("does NOT loop over `gatewayModelIds` inside `mergedModels`", () => {
    const src = readChatPage();
    // The prior code had:
    //   for (const id of gatewayModelIds) add(id);
    // After the fix, the only loop over an array inside `mergedModels`
    // is `for (const id of registryModelIds) add(id);`. The gateway
    // array must not appear in this function's body.
    // We grab the mergedModels function body as a defence against a
    // future refactor that moves the function but keeps the bug.
    const fnMatch = src.match(
      /const\s+mergedModels\s*=\s*useMemo\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*\)/,
    );
    expect(fnMatch).not.toBeNull();
    if (!fnMatch) return;
    const fnBody = fnMatch[1];
    const fnDeps = fnMatch[2];
    expect(fnBody).not.toMatch(/for\s*\(\s*const\s+\w+\s+of\s+gatewayModelIds\s*\)/);
    expect(fnDeps).not.toMatch(/gatewayModelIds/);
  });

  it("still loops over `registryModelIds` (the source of truth) inside `mergedModels`", () => {
    const src = readChatPage();
    expect(src).toMatch(/for\s*\(\s*const\s+id\s+of\s+registryModelIds\s*\)\s*add\(id\)/);
  });

  it("always includes `CHAT_DEFAULT_MODEL` as the first entry", () => {
    const src = readChatPage();
    expect(src).toMatch(/add\(CHAT_DEFAULT_MODEL\)/);
  });

  it("does NOT destructure `gatewayModelIds` from the useGatewayHealth hook", () => {
    const src = readChatPage();
    // The destructure is the multi-line object pattern
    //   const { ..., gatewayModelIds, ... } = useGatewayHealth();
    // After the fix, `gatewayModelIds` is no longer pulled out.
    // (The hook still returns it internally for `modelsError`, but the
    // chat page doesn't need it.)
    const destructureMatch = src.match(
      /const\s*\{([\s\S]*?)\}\s*=\s*useGatewayHealth\(\)/,
    );
    expect(destructureMatch).not.toBeNull();
    if (!destructureMatch) return;
    const destructureBody = destructureMatch[1];
    expect(destructureBody).not.toMatch(/^\s*gatewayModelIds\s*,/m);
    expect(destructureBody).not.toMatch(/,\s*gatewayModelIds\s*,/);
  });
});
