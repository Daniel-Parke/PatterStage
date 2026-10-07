# T-0187 m2 survivor oracle

Independent ORACLE owns only `tests/unit/legacy-node-bridge-order.test.ts`.
The first clean-tree sweep killed 21/22 mutants; m2 survived. Its mutation
replaces the Node loader's source-aware canonical choice with
`process.env[psKey]`. Test the actual Node loader and selected data directory
when `.env.local` sets an empty `PS_DATA_DIR` **before** a later nonempty
`CH_DATA_DIR`. The bridge fills `process.env.PS_DATA_DIR` from the later CH
line, so the selected directory is legacy-supplied and must warn once. The
mutant suppresses that warning. Include a canonical-wins control and check
that warnings never disclose the path. Reuse the shared loader fixture to
minimise repeated test windows. Do not edit source, other tests, records or
protected paths. Do not commit. Report test names and focused results.
