---
summary: Built-app evidence for T-0182 nonce CSP and its bounded error fallback
type: review
tags: [security, csp, evidence]
inspected_revision: c9b84131
---

# T-0182 CSP evidence

ADR-0015 supplies a fresh 128-bit nonce from `src/proxy.ts` for every
proxied request and forwards the same policy to Next. The production
`script-src` has `strict-dynamic` without `unsafe-inline` or
`unsafe-eval`. `script-src-attr 'none'` blocks injected event handlers;
`style-src-attr 'unsafe-inline'` is the accepted, scoped component
exception. HTML is `no-store`. Framing denial remains on page, API and
authentication-refusal responses.

The independently authored unit oracle was 6/6 red before implementation
and passes after it. The original 12-case Chromium oracle was 8/12 red
against the pre-CSP build. Its two `page.evaluate`-created scripts modelled
an already-trusted script under CSP `strict-dynamic`; the operator
authorised a separate author to replace them with parser-inserted HTML
injection. The amended cases pass 2/2 with enforcement; their separate
pre-CSP red run was not observed. A second authorised amendment scoped
the Missions locator to its header action, preserving the empty-state
action and all 12 names. The full CSP browser file passed 12/12 on the
rebuilt app at 1440×900 and 390×844 with an isolated data directory.

`/_global-error` is pre-rendered by Next 16.3.6 without a request nonce.
The independent supplementary oracle was 2/4 red: the 500 response and
no-JavaScript fallback passed, while desktop and phone each saw nine
blocked resources. A Chromium probe identified six same-origin framework
chunk requests (five unique, one webpack request repeated), two inline
scripts and one inline style. The operator accepted ADR-0016's fail-closed
exception. A different author amended that oracle to pin exactly those
nine blocked events and reject others; the focused Webpack run passed 4/4.
The full gate's Turbopack build found a second exact fail-closed pattern:
seven blocked framework chunk requests (six unique, including one
repeated runtime URL), the same two inline scripts and one inline style,
ten events total. The operator accepted both named patterns while retaining
Turbopack. A third independent author amended the oracle without changing
its four names; the focused Turbopack run passed 4/4. The Webpack branch
of the revised oracle has not been rerun. The page retains its useful
heading, HTTP 500 and frame denial. No production
script allowance was added for it.

The first `next build` exposed five pre-existing GET route signatures with
optional `NextRequest` parameters that Next 16 refuses. They were made
required, and the schedules unit invocation was updated without changing
its test name. The isolated `next build --webpack` then passed. The
primary checkout's ignored `tmp/eos-python/attr` caused a Turbopack file
access panic in an earlier attempt; the later full gate's Turbopack build
passed, so the panic was transient. A built Chromium probe located
Composer's `script-src: eval` event in a Zod `Function` feature probe;
setting Zod's supported `jitless` mode in the Composer schema removed it.
The Missions header action was disabled during initial loading to avoid
an inert pre-hydration click. The full gate later found Composer's Build
tab could likewise be clicked before hydration under phone-width load;
its control now stays disabled until client setup completes.

Implementation `c9b84131` passed the full ten-step gate by exit code on
unchanged tree SHA-256 `8baa0c72b84736e5b9d1c40d14976e65f72a70e4dbc434e20d865608168c89b8`:
759 passing Jest suites (7,350 tests passed, eight skipped), 332 Playwright
passes (24 skipped), both censuses and all other checks. The first full-gate
E2E attempt lost its owned Next server mid-run, after which a standalone
full suite at the same worker count passed 332/332; the entire gate then
passed. The failed run remains an infrastructure failure, not a test pass.
The clean-tree sweep against `c9b84131` killed all three T-0182 mutants
through assertion failures and verified source restoration.

An isolated Chromium walk on port 3902 captured Missions dialog, Composer
Build and Help at 1440×900 and 390×844. All six states had an `h1`, zero
horizontal overflow, page errors and CSP violations. The ignored
`.gate/t0182-*.png` captures have SHA-256 hashes, in that route order:

| Width | Missions | Composer | Help |
| --- | --- | --- | --- |
| 1440 | `6408df34564730081ffa2de324858d5d1c366c0e311a5d46c732524607665f51` | `caeae29a5b2fd2b48437ef2d973b51f1c51a5c51796123db8879814d6f1d6c29` | `6a4a5d3281c847cc0d813698758f7e6dc9a30f094ba30ac23a19240a8fd1c3ed` |
| 390 | `679c42520596b2a63cc5786e846ef6493c8885012370bab25d282e11c3488e87` | `a248fc7093d496766d85f3533af5b838832ad3444618108261a5fcfd3b957ada` | `a2fb6272678ec9f2c67a0b2cd8680d69f1e9ba2ec1567886657f0de3968125e7` |

Two document requests had distinct CSP values and `Cache-Control: no-store`.
A referenced JavaScript chunk returned 200 with
`Cache-Control: public, max-age=31536000, immutable`. The Turbopack route
manifest covered 29 routes; its raw/gzip chunk sums were Composer
560,664/147,956 bytes, Missions 293,672/91,560 bytes, root
205,622/69,287 bytes, Help 123,784/42,575 bytes and `_global-error`
14,377/3,661 bytes. These manifest sums are upper bounds on shared chunks,
not measured transferred bytes. Composer increased 85 raw and 31 gzip bytes
from the pre-task snapshot; Missions increased 11 raw and eight gzip bytes.
