---
name: code-review
description: Review diffs and code for correctness, security, and clarity.
---

# Code Review

Use when asked to review a diff, PR, or snippet.

1. **Correctness first.** Trace the logic for the intended behaviour and the
   obvious edge cases (empty, null, boundary, concurrency). Find real bugs.
2. **Security.** Look for injection, unvalidated input, secret leakage, unsafe
   deserialisation, and missing authz checks.
3. **Clarity & reuse.** Note duplication, dead code, and simpler equivalents —
   but separate "must fix" from "nice to have".
4. **Be specific.** Cite `file:line`, explain the impact, and propose the fix.
5. **Calibrate.** Report findings with a severity and a confidence; don't pad
   the list with style nits unless asked.
