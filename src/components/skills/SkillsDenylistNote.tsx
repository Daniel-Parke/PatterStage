// ── SkillsDenylistNote — the standing explainer above the skill lists.
// Extracted verbatim from app/operations/skills/page.tsx. Static copy,
// no props, no state.

import ConceptHint from "@/components/help/ConceptHint";

export default function SkillsDenylistNote() {
  return (
    <p className="text-xs text-ps-text-muted font-mono mb-4 max-w-3xl">
      Hermes uses a <strong className="text-ps-text-secondary">denylist</strong> (
      <code className="text-ps-text-muted">skills.disabled</code> in config.yaml). Short names in YAML
      are matched to catalog paths (e.g. <code className="text-ps-text-muted">apple-notes</code> →{" "}
      <code className="text-ps-text-muted">apple/apple-notes</code>). If you edited disk config,
      use <strong className="text-ps-text-secondary">Operations → Agents → Pull</strong> for that profile
      before toggling <ConceptHint id="skill">skills</ConceptHint> here.
    </p>
  );
}
