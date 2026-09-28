---
summary: Built-app evidence for T-0182 nonce CSP and its bounded error fallback
type: review
tags: [security, csp, evidence]
inspected_revision: 62a15e2f
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
Turbopack. Independent oracle amendment and its verification are pending.
The
page retains its useful heading, HTTP 500 and frame denial. No production
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
an inert pre-hydration click. The full gate, mutation sweep, route-cache
and bundle measurements remain pending at this evidence revision.
