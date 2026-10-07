# T-0208: keep empty Chat warnings visible

The finished T-0206 runtime-alignment candidate failed the unchanged design census: `routesWithSplitBlocks` rose from 1 to 2. The new offender was Chat. This is a real layout defect, not a reason to change the census.

## Reproduction and scope

Inspected source: `f9c95d56e03430a113ca0ff31666da097e068c64`. Failed complete gate: `tmp/t0195-full-gate-1791371608715/gate/summary.json`. Its first eight steps passed; design census failed and line census was not reached. The earlier successful gate remains separate evidence.

The independently controlled reproduction in `tmp/t0195-census-proof/proof.json` shows a natural scroll offset of 126 px. The gateway warning spans y=-30..64; its clipping pane begins at y=80. None of the 94 px warning is visible. The empty placeholder consumes a full transcript height in addition to the warning, and the existing message effect scrolls to the bottom even when the transcript is empty.

Browser-only removal of that excess height restores the complete warning. Substitution in the preserved route corpus changes only the split-route count, 2 to 1; the other 23 measures are identical. A genuinely visible 24 px inset still fails the existing 1 px rule. This diagnostic is not fresh integrated census acceptance.

## Frozen oracle and authority

Separate ORACLE author: Kierkegaard, `01a11643-6925-76f2-abe8-c540bf12de8d`. File: `tests/e2e/chat-empty-banner-visibility.spec.ts`. LF SHA-256: `1a16faa97a728bebe7dfc1b5f7a9a3a3b741b587721e69eaaf29cd5348abc374`.

The executed pre-repair oracle has eight ordinary geometric reds and two green controls, with no retries or final infrastructure failures. It covers offline, missing authentication, missing model, simultaneous checking/missing model, and ready conditions at 1440x900 and 390x844. It checks intersection through every clipping ancestor, painted hit targets, Message reachability, one h1, horizontal containment, disabled empty Send and an unsent draft where input is enabled. Geometry is measured before interaction can scroll a warning into view. No messages or provider runs are sent.

Retained evidence: `tmp/t0208-chat-oracle/receipt.md`, `proof.json`, browser reports, images, identity and cleanup receipts. Twenty owned application process receipts report no remaining process or cleanup error; refusal-listener requests are zero. Earlier draft and four infrastructure attempts remain recorded separately. Lint and test typing exit 0.

Provenance limit: fixture discovery exposed an earlier DOM-only diagnostic candidate. No source repair existed or was read. This is a separate-author, source-informed R2 behaviour oracle; strict clean-context independence and R3 clearance are not claimed.

Independent R2 reviewer Gauss adopted this exact oracle and authorised the first repair in `tmp/t0208-chat-oracle/reviewer-adoption.json` on 7 October 2026. Retain `h-full` on the empty placeholder only when there are no banners. Preserve every other class, content, branch and interaction. Leave `useChatSend` unchanged. No collector, census test, tolerance or design baseline change is authorised.

## Acceptance still required

All ten unchanged cases must pass on a rebuilt artifact. Verify relevant existing Chat controls, causal reversal and restoration, a fresh unchanged census, and the complete gate. Hosted acceptance is bound to the actual pushed head. Nonempty scrolling, streaming, paid-provider behaviour and the other T-0208 hypotheses are not established by these ten empty-state cases. T-0208 remains active.

## Verified implementation and committed causal proof, 7 October

Red oracle: `5751f01e`. Page-only implementation: `ba85d4c5`. The frozen ten cases pass unchanged on the rebuilt application, with complete warning/title/action intersections at both viewports. Coordinator inspected desktop offline and phone simultaneous-warning PNGs in `tmp/t0208-chat-green-proof`; the hook is unchanged. Independent bounded source adoption is recorded beside that proof.

The complete combined gate `1791376312504` passes all ten steps: 9,075 unit tests, 523 browser tests, two build-purity controls and both censuses. Nine unit and 24 browser skips remain historical. Before/after tree stamp is `4ec3a994db1cfd0d9543aa2163813be78d72e824eda3dda1662be9d9d58e9d31`. Main committed head `ba85d4c5` and owned checkpoint `d8a467e` have the identical Git tree `46ae635b5d1a7f832f48aab7dfe6a8a1ad5ca07b`. Later task/claim records are closure metadata, not a claim that the old fingerprint recomputes after metadata commits.

The fresh full-route census has 22 identical metrics. Split routes fall from 2 to the existing baseline of 1. Decorative borders rise from 366 to 387, all 21 additional elements matching the unchanged shared update Badge. The existing ceiling is 714; it was not changed. The exact update response/origin mechanism was not retained at capture and remains an inference. Do not attribute the 21 global borders to Chat or claim all other 23 fresh values are identical. The earlier controlled Chat-only substitution still correctly holds its other 23 values.

Dedicated committed-copy browser sweep: `tmp/t0208-chat-causal-proof/proof.json`. Three builds succeed; controls are 10 green, original-height reversal produces 8 intended geometry reds and 2 green, and exact byte/mode restoration followed by rebuild returns 10 green. All 30 owned processes stop, with zero final retries, skipped cases or infrastructure failures. This is one manual Playwright mutant KILLED under the accepted T-0192 procedure, not a production Jest kill. Preserve the initial prebuild environment-guard ERROR separately; it did not mutate source. The debug log was reversibly archived inside the owned proof root. `correction.md` attributes that verification to the coordinator, not a fresh human ruling.

Independent R2 adoption of the full gate, census qualification and causal proof is in `tmp/t0195-combined-gate-adoption-20261007.json`. Hosted jobs at the final pushed head remain required. T-0208 remains active for its other findings.

Line-census reason correction: the producer's new entry mistakenly says this oracle adds 149 lines. Its actual contribution to APP_CODE is 122 lines (121 physical lines plus the terminal split entry), taking testLines from 155185 to 155307. Preserve the written historical entry and this correction. No rule, target or design baseline has moved.
