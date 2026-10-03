# T-0191 independent mutation-attribution amendment

Author Galileo; original unit author Sartre; implementer coordinator; reviewer Laplace.
Own only tmp/t0191-green-validation/tests/unit/components-progress-feedback.test.tsx. Do not edit primary, production, manifest, runner or other tests.

Committed85ed87b2 sweep:18KILLED,1ERROR(m11),134controls before/after, exactrestoration. Actualcall11JSON/log are under tmp/t0191-sweep-85ed87b2. Four expanded cases throw TestingLibrary query exceptions rather than structured matcher failures. These occupy three source assertion sites.

Laplace authorises: unrelated persistent error getByText/InDocument becomes queryAllByText/toHaveLength(1); newer cancellation getAllByText becomes queryAllByText with existing length1 assertion; timer persistent-error count assertion is added BEFORE its existing toBeVisible assertion, which must remain unchanged. Preserve every case name, fixture, interaction, timer and other assertion. No weakening or suppression.

Record before/after hashes, exact diff, expanded identities and green focused controls. Do not mutate production for private diagnostics; coordinator commits reviewed candidate then reruns the actual clean-tree sweep for causal proof. Original ERROR receipt remains. Freeze, report and stop writes. Types/lint as appropriate. No application servers or external providers.
