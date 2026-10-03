import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // `tmp/` is gitignored scratch space, and agents put git worktrees in it,
    // each with its own `.next` build output. The `.next/**` pattern above is
    // anchored at the repository root, so it does not cover `tmp/<wt>/.next`,
    // and `eslint .` was walking into minified build artefacts and failing the
    // gate on code nobody wrote. Nothing under `tmp/` is repository content,
    // so nothing under `tmp/` is lintable. tsconfig.json excludes it for the
    // same reason and the same incident (T-0034).
    "tmp/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // CardDetailModal legitimately uses useLayoutEffect to sync form state when
      // the selected card changes — this is a controlled modal pattern, not a bug.
      "react-hooks/set-state-in-effect": "off",
      // React Compiler (babel preset) in CI emits this rule for components that
      // use manual useMemo/useCallback, but the rule is incompatible with the
      // strict dependency inference React Compiler performs in v19. The hooks
      // are correct — the rule's analysis is flawed for these patterns.
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
