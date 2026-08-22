// ── SkillsDenylistNote — the standing explainer above the skill lists.
// Extracted verbatim from app/operations/skills/page.tsx. Static copy,
// no props, no state.

export default function SkillsDenylistNote() {
  return (
    <p className="text-xs text-white/40 font-mono mb-4 max-w-3xl">
      Hermes uses a <strong className="text-white/60">denylist</strong> (
      <code className="text-white/50">skills.disabled</code> in config.yaml). Short names in YAML
      are matched to catalog paths (e.g. <code className="text-white/50">apple-notes</code> →{" "}
      <code className="text-white/50">apple/apple-notes</code>). If you edited disk config,
      use <strong className="text-white/60">Operations → Agents → Pull</strong> for that profile
      before toggling skills here.
    </p>
  );
}
