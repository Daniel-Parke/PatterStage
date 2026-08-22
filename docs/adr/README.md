# Decisions

Architecture decision records for PatterStage. A decision recorded here wins over
anything you infer from the code.

`proposed` means drafted and argued but **not yet approved**. Only Daniel accepts a
decision, and acceptance is recorded by changing `status` to `accepted` in the file
itself. Do not build on a proposed ADR without saying that is what you are doing.

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](0001-patterstage-hosts-work-not-surfaces.md) | PatterStage hosts work, not surfaces | accepted |
| [0002](0002-run-engine-ownership.md) | PatterStage keeps its run engine; the shared asset is the contract | accepted |
| [0003](0003-shared-kit-distribution.md) | One shared repo for agnostic layers; vendor the design kit by copy-in first | accepted |
| [0004](0004-brain-and-body.md) | The LLM is the Brain, the framework is the Body; progression measures the Body | accepted |
| [0005](0005-product-modules.md) | Product surfaces plug in through one ProductModule seam; Rec Room proves it | accepted |
| [0006](0006-dev-is-the-integration-trunk.md) | dev is the integration trunk; done means merged to green dev; main moves via gated release PRs | accepted |
| [0007](0007-adr-home-is-docs-adr.md) | docs/adr/ is the single ADR home; org/decisions/ holds a pointer | superseded |
| [0008](0008-adopt-the-v2-eos.md) | Adopt the v2 EOS by recompile at ORG scale; ADRs move to org/decisions/ | accepted |

## Relationship to the EOS

PatterStage has not run EOS Session 0 yet, so it has no lock-book and no compiled
seed. These ADRs are venture-local and use the EOS's `decision` type and
front-matter schema so they can be carried into the lock-book unchanged when
Session 0 runs.

Two of them reach beyond this repo and will need a decision in
`PatterTech_EOS/org/decisions/` by an entry-mode-2 session, because they change
files in the estate's protected set:

- **0002** supersedes the run-engine line in `estate/repos.yaml`.
- **0003** part 2 moves `@pattertech/ui` out of PatterStudio and cancels the
  planned `PatterTech_WebKit` repo.

Note for Session 0: these files use em-dashes, which the EOS voice law makes a hard
`E004` error. They need a voice pass before any of them lands in a compiled seed.
