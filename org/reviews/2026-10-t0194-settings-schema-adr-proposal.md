---
summary: Exact proposed ADR-0018 for the already ruled Settings field-table exception
type: review
tags: [adr, refactor]
---

# Proposed ADR-0018: Settings field-table exception to ADR-0005

Status: accepted as drafted by Daniel Parke, 2026-10-04, through the
interactive operator ruling. Acceptance permits a new protected ADR file
under T-0194's ruled record; ADR-0005 remains unchanged. The protected entry
has not yet been created, and T-0194's implementation dependency remains.

## Context

The client Settings UI consumes the Hermes config.yaml field table in
`src/lib/config/config-schema.ts`. The operator selected a recorded exception
on 2026-09-12 in the decision register's `lib-domains-03` ruling. ADR-0005's
existing provider-list and file-key exceptions do not expressly cover this
field table. This proposal records the selected exception; it does not select
a different product design.

## Decision

Retain the existing Settings field table and its associated section, field
and file-key metadata in `src/lib/config/config-schema.ts` as an explicit
exception to ADR-0005. This exception permits the existing declarative
Settings metadata. It introduces no new module composition point or general
exemption for Hermes protocol or filesystem code.

The separate env-file parser follows the existing ruling to move into the
Hermes module. The `agent_root` ownership ruling also remains Hermes.
Laboratory relocation remains deferred under its existing ruling.

## Consequences and verification

Record this exception in the `hermes-outside-adapter` lint commentary without
weakening its predicate. Reconcile T-0194's Verify text so that it no longer
requires relocation of the retained Settings table.

Preserve Settings fields, config keys, URLs, validation and public exports.
Verify existing Settings/schema contracts and module-boundary checks. Retain
ADR-0005 unchanged. This decision supersedes only its core Hermes-knowledge
boundary claim as specified above.

Authority: [the selected lib-domains-03 ruling](2026-09-decision-register.md),
[ADR-0005](../decisions/ADR-0005-product-modules.md) and
[the constitution's change control](../CONSTITUTION.md).
