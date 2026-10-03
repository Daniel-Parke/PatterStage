# T-0186 visible save-error layout oracle

Independent ORACLE `01a0ee69-17d0-74d1-b624-de37ec9e1477` exclusively
owns `tests/e2e/story-weaver-save-layout.spec.ts`. Do not edit any other
file, commit or push. Boot the T-0186 record and ORACLE charter.

The coordinator's isolated 390x844 screenshot
`.gate/t0186-walk/390-save-failed.png` shows `Save unavailable` over the
mobile global header and clipped by the PatterStage brand. The desktop error
banner spans the sidebar. The initial T-0186 oracle only checks DOM visibility.

Write browser behaviour cases at 390x844 and 1440x900. Intercept the story
load and failed read-status save in isolated Playwright data, as the existing
T-0186 suites do. After the failed save, assert that the visible error text
does not geometrically overlap the global navigation/header or the story h1,
and that the error and dismiss control are inside the viewport. Capture the
relevant element boxes in a failure message. Preserve the existing page and
auth routes. Run the new suite against current source and report its exact
intended red result, test names and SHA-256. Do not change retries, workers,
timeouts or existing tests.
