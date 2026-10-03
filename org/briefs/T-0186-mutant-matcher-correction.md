# T-0186 structured matcher correction

The independently amended `queryByRole("alert")` test at `8647e1dc`
still makes the strict mutation sweep report `ERROR (infrastructure)`. The
committed-tree diagnostic run showed one executed failed test, but
`toBeInTheDocument()` threw on `null` before returning a Jest `matcherResult`.
The recorded detail was `{}`; the failure message said the received value
must be an HTMLElement or SVGElement. The sweep is correct to reject it.

Request an independent R2 reviewer ruling to change only the immediate
presence assertion in `tests/unit/story-reader-error-banner.test.tsx` from
`expect(alert).toBeInTheDocument()` to core Jest
`expect(alert).not.toBeNull()`. Keep the non-throwing `queryByRole`, test
name, fixture, text, header-containment and dismiss assertions unchanged.
No mutation runner, manifest, application source, or other test changes.

A new ORACLE author, distinct from the original frozen test author and the
last amendment author, must make the correction and report old/new SHA-256
and test-name identity. Commit first; then run the clean-tree sweep and full
gate. A kill requires the sweep's own structured assertion evidence and
restoration check. The previous ERROR remains historical evidence.
