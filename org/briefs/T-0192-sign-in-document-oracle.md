---
summary: Independent document metadata oracle and bounded promise matcher amendment for T-0192
type: brief
tags: [refactor, oracle]
---

# T-0192 independent oracle follow-up

Galileo owns only `tests/unit/sign-in-document-metadata.test.ts` and `tests/unit/api-fetch-error-envelope.test.ts`. Coordinator owns production. Sartre has stopped writing. No protected or historical record edits.

The owned production walk proved the standalone sign-in document has no language or viewport metadata: a 390px mobile device receives a 980px layout viewport. Author a small behaviour oracle using the actual proxy response, asserting English document language and device-width viewport metadata. Preserve the current 401 HTML refusal, API JSON refusal and absence of session issuance. Do not implement a presentation change for invalid credentials; that operator question remains pending. Run and record the new oracle red before any implementation.

The null-envelope mutation reached the intended `.rejects.toMatchObject` assertion, but the mutation runner correctly refused an unsupported evidence shape. Independently amend that promise assertion to capture fulfilment/rejection explicitly, require rejection with a normal matcher, then apply the unchanged message/status/body comparison. Keep all 16 existing identities, inputs and other assertions. Explicitly reject fulfilment with an error-shaped object. Preserve original and amended green controls and verify the existing mutant produces a recognisable causal assertion. Do not change the mutation runner.

Use isolated validation with pinned Node 24. Do not build or alter production. Keep source/test hashes and identity proof. Any temporary mutation must be restored in finally and checked. Do not commit: coordinator freezes reviewed oracle bytes. Laplace reviews before implementation.

## Current handoff

Galileo completed the new metadata oracle with two causal failures and two passing preservation controls, then stopped. Galileo was the original fetch-oracle author and correctly refused to amend it. Nash now owns only that existing fetch test file; the coordinator owns the new metadata oracle for freezing. The promise-amendment requirements above remain unchanged.
