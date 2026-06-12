/**
 * Source-pattern test for the `copy-btn` magic-string consolidation.
 *
 * The chat page's global click handler (the `useEffect` at
 * `src/app/orchestration/chat/page.tsx` line ~320) matches a CSS
 * class name to identify the per-code-block "Copy" buttons that
 * `renderMarkdown` (in `src/lib/chat-utils.ts`) injects via
 * `dangerouslySetInnerHTML`. Before the migration, both files
 * hard-coded the literal string `"copy-btn"` independently — a
 * one-character rename in one file would silently desync from the
 * other (the click handler would just never fire; no compile error).
 *
 * The migration:
 *  - `src/lib/chat-utils.ts` exports a new `COPY_BTN_CLASS`
 *    constant with the value `"copy-btn"`.
 *  - `renderMarkdown` interpolates that constant into the
 *    code-block template (no more inline literal).
 *  - `src/app/orchestration/chat/page.tsx` imports the constant and
 *    uses it in `target.classList.contains(...)` (no more inline
 *    literal).
 *
 * This test pins both halves of the migration so a future revert
 * (or a typo on the constant value) is caught by `npx jest` rather
 * than a manual cross-file diff.
 *
 * Pre-flight recipe (run BEFORE reverting the `copy-btn` literal
 * migration back to inline magic strings):
 *
 *   # 1. Confirm the constant exists and is exported
 *   rg -n "export const COPY_BTN_CLASS" src/lib/chat-utils.ts
 *   # Should show 1 hit: `export const COPY_BTN_CLASS = "copy-btn";`
 *
 *   # 2. Confirm both files import the constant (not just one)
 *   rg -n "COPY_BTN_CLASS" src/lib/chat-utils.ts src/app/orchestration/chat/page.tsx
 *   # Should show 3+ hits: 1 declaration + 1 use-in-renderMarkdown
 *   # + 1 import + 1 use-in-click-handler in the chat page.
 *
 *   # 3. Confirm the inline `"copy-btn"` literal is GONE from both
 *   rg -n '"copy-btn"' src/lib/chat-utils.ts src/app/orchestration/chat/page.tsx
 *   # Should show 0 hits.
 *
 * @see src/lib/chat-utils.ts — `COPY_BTN_CLASS` declaration + `renderMarkdown` use
 * @see src/app/orchestration/chat/page.tsx — click-handler use
 */
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.join(__dirname, "..", "..");
const CHAT_UTILS_PATH = path.join(REPO_ROOT, "src", "lib", "chat-utils.ts");
const CHAT_PAGE_PATH = path.join(
  REPO_ROOT,
  "src", "app", "orchestration", "chat", "page.tsx",
);

function readFile(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("copy-btn magic-string migration — source pattern", () => {
  const chatUtilsSource = readFile(CHAT_UTILS_PATH);
  const chatPageSource = readFile(CHAT_PAGE_PATH);

  it("chat-utils source file is readable", () => {
    expect(chatUtilsSource.length).toBeGreaterThan(0);
  });

  it("chat page source file is readable", () => {
    expect(chatPageSource.length).toBeGreaterThan(0);
  });

  describe("chat-utils side — constant declaration + renderMarkdown use", () => {
    it("declares and exports `COPY_BTN_CLASS` with the value `\"copy-btn\"`", () => {
      // The contract: an exported const with the exact string value.
      // The renderMarkdown helper then interpolates this constant.
      expect(chatUtilsSource).toMatch(
        /export\s+const\s+COPY_BTN_CLASS\s*=\s*"copy-btn"\s*;/,
      );
    });

    it("renderMarkdown interpolates `${COPY_BTN_CLASS}` (no inline literal)", () => {
      // The interpolation must use the constant name, not the literal
      // string. The template literal is the only place renderMarkdown
      // produces a code-block button, so this is the canonical use.
      expect(chatUtilsSource).toMatch(/\$\{COPY_BTN_CLASS\}/);
    });

    it("does NOT contain the inline `\"copy-btn\"` literal outside the constant declaration", () => {
      // Anti-pattern lock: the inline literal must not appear anywhere
      // other than the constant's own declaration line. Strip the
      // declaration line (and any JSDoc above it) before checking, so
      // the constant itself is allowed to contain the string. The only
      // way to write the class name in `renderMarkdown` is via the
      // constant interpolation.
      const withoutDeclaration = chatUtilsSource
        .replace(
          /\/\*\*[\s\S]*?\*\/\s*export\s+const\s+COPY_BTN_CLASS\s*=\s*"copy-btn"\s*;/,
          "",
        );
      expect(withoutDeclaration).not.toMatch(/"copy-btn"/);
    });

    it("declares and exports `COPY_BTN_DATA_ATTR` with the value `\"data-code\"`", () => {
      // Sister constant to COPY_BTN_CLASS — the click handler reads
      // this attribute to recover the raw code-block text. The
      // literal `data-code` is the second magic string shared
      // between the producer (renderMarkdown) and the consumer
      // (the click handler). Same export pattern.
      expect(chatUtilsSource).toMatch(
        /export\s+const\s+COPY_BTN_DATA_ATTR\s*=\s*"data-code"\s*;/,
      );
    });

    it("renderMarkdown interpolates `${COPY_BTN_DATA_ATTR}` (no inline literal)", () => {
      expect(chatUtilsSource).toMatch(/\$\{COPY_BTN_DATA_ATTR\}/);
    });

    it("does NOT contain the inline `\"data-code\"` literal outside the constant declaration", () => {
      // Same anti-pattern lock as COPY_BTN_CLASS. Strip the data-attr
      // declaration so the constant's own value is allowed.
      const withoutDeclaration = chatUtilsSource
        .replace(
          /\/\*\*[\s\S]*?\*\/\s*export\s+const\s+COPY_BTN_DATA_ATTR\s*=\s*"data-code"\s*;/,
          "",
        );
      expect(withoutDeclaration).not.toMatch(/"data-code"/);
    });
  });

  describe("chat page side — import + click-handler use", () => {
    it("imports `COPY_BTN_CLASS` from `@/lib/chat-utils`", () => {
      // The import is part of the chat-utils import block at the
      // top of the file. Adding it to the existing block keeps the
      // site count to 1 (no second `import` statement).
      expect(chatPageSource).toMatch(
        /import\s*\{[^}]*\bCOPY_BTN_CLASS\b[^}]*\}\s*from\s*"@\/lib\/chat-utils"/,
      );
    });

    it("the click handler uses `COPY_BTN_CLASS` (not the inline literal)", () => {
      // The `useEffect` at line ~320 has `if (target.classList.contains(...))`.
      // After the migration, the argument is the constant reference, not the
      // literal string. This pattern locks the click-handler side.
      expect(chatPageSource).toMatch(
        /target\.classList\.contains\(\s*COPY_BTN_CLASS\s*\)/,
      );
    });

    it("does NOT contain the inline `\"copy-btn\"` literal anywhere in the chat page", () => {
      // Anti-pattern lock: the inline literal must not appear in
      // the chat page at all. The only legal source of the class
      // name is the imported constant.
      expect(chatPageSource).not.toMatch(/"copy-btn"/);
    });

    it("imports `COPY_BTN_DATA_ATTR` from `@/lib/chat-utils`", () => {
      expect(chatPageSource).toMatch(
        /import\s*\{[^}]*\bCOPY_BTN_DATA_ATTR\b[^}]*\}\s*from\s*"@\/lib\/chat-utils"/,
      );
    });

    it("the click handler uses `COPY_BTN_DATA_ATTR` (not the inline literal)", () => {
      // Same pattern as the class check, but for the data attribute
      // that carries the code-block text. The handler reads it via
      // `target.getAttribute(...)`.
      expect(chatPageSource).toMatch(
        /target\.getAttribute\(\s*COPY_BTN_DATA_ATTR\s*\)/,
      );
    });

    it("does NOT contain the inline `\"data-code\"` literal anywhere in the chat page", () => {
      expect(chatPageSource).not.toMatch(/"data-code"/);
    });
  });
});
