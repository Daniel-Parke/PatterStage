---
summary: Independently adapted retained Search fixtures for the pinned transport
type: review
tags: [testing, security]
---

# Retained Search fixture adaptation

Banach independently adapted `search-module.test.ts` and
`search-url-guard.test.ts` to the accepted Undici transport. Their mocks route
the existing fetch fixtures through Undici and supply an owned public DNS
answer. The dispatcher fixture has a no-op destruction method.

All 40 existing test names and 28 assertion expressions remain exact. The
focused run passed 40/40; test TypeScript and scoped lint exited zero. Exact
before/after identity, bytes and actual results are in
`tmp/t0207-search-fixture/freeze.json`. Parfit independently reviewed the
adaptation and identity proof. These retained mocked tests do not establish
native transport or TLS behaviour. The separate 19-case owned transport oracle
supplies that bounded regression evidence.

No timeout, assertion or test name changed. The full unchanged gate and
committed sweep remain required.
