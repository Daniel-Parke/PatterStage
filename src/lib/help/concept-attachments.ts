// ═══════════════════════════════════════════════════════════════
// concept-attachments.ts — which words are explained on which screen
//
// The popovers themselves live in the nine screens' own components, where the
// word is met. This table is the same list as data, so the docs check and the
// oracle can read one file instead of grepping nine directories and hoping the
// grep and the intent still agree.
//
// Pure data: no React, no fs. It is read by a plain-node script as well as by
// a test.
// ═══════════════════════════════════════════════════════════════

export interface ConceptAttachment {
  /** A registry route, spelled exactly as src/lib/modules/registry.ts spells it. */
  screen: string;
  /** The concepts.json ids that screen explains, in reading order. */
  conceptIds: string[];
}

/**
 * Nine screens, seventeen terms.
 *
 * The list is the plan's B16 bullet: the words an operator meets first and
 * cannot get on with the product without. It is deliberately not every concept
 * in the corpus — a screen that explained twenty words would explain none.
 */
export const CONCEPT_ATTACHMENTS: readonly ConceptAttachment[] = [
  { screen: "/work/chat", conceptIds: ["agent", "prompt"] },
  { screen: "/work/missions", conceptIds: ["mission", "run", "schedule"] },
  { screen: "/agent/profiles", conceptIds: ["profile", "personality"] },
  { screen: "/agent/skills", conceptIds: ["skill"] },
  { screen: "/agent/tools", conceptIds: ["tool", "toolset"] },
  { screen: "/agent/memory", conceptIds: ["memory"] },
  { screen: "/agent/models", conceptIds: ["model", "provider", "api-key"] },
  { screen: "/work/composer", conceptIds: ["workflow", "gate"] },
  { screen: "/work/research", conceptIds: ["artifact"] },
];
