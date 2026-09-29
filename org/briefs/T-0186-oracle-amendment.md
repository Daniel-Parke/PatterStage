# T-0186 frozen success-fixture amendment

Independent R2 REVIEWER `01a0ee66-3b69-7041-ad71-a1c57ea8b9e8`
authorised one narrow correction on 2026-09-29. The frozen
`tests/e2e/story-weaver-save-failure.spec.ts` returns an unchanged unread
story for a successful update, while the real handler returns the saved story
with the selected chapter marked read. A distinct ORACLE author may amend
only that success fixture so it reflects the submitted selected chapter.
The HTTP and network failure fixtures, both success test names, every
assertion, worker and retry settings remain unchanged. This brief supersedes
the earlier "do not edit" instruction only for this one correction. The
original red-first commit `6f23bd9b` remains historical evidence.

ORACLE `01a0ee69-17d0-74d1-b624-de37ec9e1477` exclusively owns
`tests/e2e/story-weaver-save-failure.spec.ts` for this amendment. Record old
and new SHA-256 values, exact diff, test-name identity and focused result.
Do not edit source, other tests, records or claims; do not commit or push.
