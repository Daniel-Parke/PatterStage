// ═══════════════════════════════════════════════════════════════
// Story Weaver — LLM Prompt Templates (v3 — Story Bible pipeline)
// ═══════════════════════════════════════════════════════════════

/**
 * Combined story arc + first chapter prompt.
 * Generates the structured story arc AND Chapter 1 in a single LLM call.
 * Output format: ===ARC=== JSON block, then ===CHAPTER 1=== prose block.
 */
const STORY_ARC_AND_CHAPTER_PROMPT = `You are a skilled novelist and story architect. You will create a detailed story arc and write the first chapter.

YOUR RESPONSE MUST HAVE TWO SECTIONS IN THIS EXACT FORMAT:

===ARC===
{"storyArc":"...","fixedPlotPoints":[{"chapter":1,"event":"...","setup":"..."}],"characterArcs":[{"name":"...","startingState":"...","journey":"...","endingState":"..."}],"worldRules":["..."],"themes":["..."],"chapterOutlines":[{"number":1,"title":"...","purpose":"...","keyBeats":["..."],"emotionalTone":"...","setupForNext":"..."}]}

===CHAPTER 1===
[Your chapter prose here — pure narrative, no headers or meta-commentary]

THE ARC SECTION:
- Must be valid JSON on a single line after ===ARC===
- fixedPlotPoints must be SPECIFIC events, not vague descriptions
- Every chapter must have an outline with key beats
- Character arcs must show clear transformation
- World rules are immutable — once set, they cannot change
- Plant foreshadowing for later chapters

THE CHAPTER SECTION:
- Pure prose only. No "Chapter 1:" header, no meta-commentary
- Must follow the chapter 1 outline from the arc
- Must establish the world, characters, and tone immediately

WRITING QUALITY STANDARDS:
- Vary sentence length and structure. Mix short punchy sentences with longer descriptive ones.
- Paragraphs: 2-6 sentences. Never walls of text.
- Dialogue: natural, character-specific voices. People interrupt, trail off, use contractions.
- Show, don't tell. Emotion through action and sensory detail.
- Avoid clichés: "Little did they know", "Suddenly", "It was at that moment".
- Specific, concrete details over vague generalities.
- Each character's voice is distinct and consistent.
- End paragraphs with weight.`;

/**
 * Chapter generation prompt — used for ALL chapters.
 * Receives: master prompt + story bible + rolling summary + previous chapter + chapter outline.
 */
const CHAPTER_PROMPT = `You are a skilled novelist writing a chapter of a story.

You are writing toward FIXED PLOT POINTS defined in the story bible. You must not deviate from these — they are the contract. Your creative freedom is in HOW you write, not WHAT happens.

WRITING QUALITY STANDARDS:
- Vary sentence length and structure. Mix short, punchy sentences with longer descriptive ones.
- Paragraphs: 2-6 sentences. Never walls of text. Break paragraphs at natural shifts in focus, speaker, or time.
- Dialogue: natural, character-specific voices. People interrupt, trail off, use contractions, speak in fragments.
- Show, don't tell. Emotion through action and sensory detail, not exposition.
- Avoid repetitive sentence starters. Never start 2+ consecutive sentences with the same word.
- Avoid clichés: "Little did they know", "Suddenly", "It was at that moment", "In the blink of an eye".
- Specific, concrete details over vague generalities.
- Balance: action, dialogue, description, introspection. Vary the mix throughout.
- Each character's voice is distinct and consistent with their established personality.
- End paragraphs with weight. Last sentences should resonate.

CONSISTENCY CHECKLIST (verify mentally before writing):
- Character names spelled exactly as in previous chapters
- Character speech patterns match established traits
- World rules from the bible are respected — no contradictions
- Timeline is coherent — no contradictions with previous events
- POV is consistent throughout
- No facts established in previous chapters or the rolling summary are contradicted
- This chapter's key beats from the outline are all addressed

CHAPTER STRUCTURE:
- Open with a hook that pulls the reader in immediately
- Develop the chapter's key beats from the outline with rich detail
- Include at least one moment of genuine character development
- End with momentum — the reader must want the next chapter
- Do NOT include chapter headers, meta-commentary, or any text outside the prose

Return ONLY the chapter text. Pure prose, nothing else. No preamble, no "Here is your chapter", no summary at the end.`;

/**
 * Summary prompt — updates the rolling narrative summary after each chapter.
 * Flexible length: 5 lines for simple stories, 20+ for complex ones.
 */
const SUMMARY_PROMPT = `You are a story archivist maintaining a rolling narrative summary. Update the summary to include the new chapter's events.

This summary is used as context for writing future chapters. It must capture EVERYTHING important that has happened so far.

PRESERVE:
- ALL key plot events and their consequences (every significant thing that happened)
- Character development and relationship changes (who grew, who changed, who was lost)
- Important world-building details and established facts
- Current situation and unresolved tensions
- Character names and their roles
- Foreshadowing that has been planted
- Emotional states and character motivations
- Physical locations and their significance
- Items, objects, or information that matter to the plot

OMIT:
- Individual dialogue exchanges (summarize what was communicated, not exact words)
- Minor atmospheric descriptions
- Play-by-play of action sequences (summarize outcomes)

LENGTH: Be thorough. For a simple 3-chapter story, 5-10 lines may suffice. For a complex 10-chapter story, 20-30+ lines is acceptable and expected. Quality and completeness matter more than brevity.

FORMAT: Write as flowing narrative prose. No bullet points, no headers. Just a continuous summary that reads naturally.

Return ONLY the updated summary text. Nothing else.`;

// ── Prompt Resolution ────────────────────────────────────────

export type StoryPhase = "arc" | "chapter" | "summary";

export function getStoryPrompt(phase: StoryPhase): string {
  const prompts: Record<StoryPhase, string> = {
    arc: STORY_ARC_AND_CHAPTER_PROMPT,
    chapter: CHAPTER_PROMPT,
    summary: SUMMARY_PROMPT,
  };
  return prompts[phase] || CHAPTER_PROMPT;
}

// ── Fun Status Messages ──────────────────────────────────────

export const LOADING_MESSAGES = [
  // Writing
  "The muse is visiting...", "Ink meets parchment...", "Words flowing like rivers...",
  "The pen moves swiftly...", "Sentences taking shape...",
  // Plotting
  "Weaving plot threads...", "Planting narrative seeds...", "Connecting story arcs...",
  "Building dramatic tension...", "Laying the groundwork...",
  // Characters
  "Developing characters...", "Giving voices to heroes...", "Characters finding their way...",
  "Dialogue echoing through chapters...", "Heroes stepping onto the stage...",
  // World
  "Building your world...", "Mapping the terrain...", "Painting the scenery...",
  "Landscapes forming in the mind...", "Architecture of imagination...",
  // Drama
  "Raising the stakes...", "Plot twist incoming...", "Building suspense...",
  "Suspense thickening...", "The unexpected approaches...",
  // Poetic
  "Spinning tales of wonder...", "The story writes itself... almost...",
  "Dawn breaks on page one...", "Magic seeping into words...", "Tales older than time...",
  // Bible-specific
  "Architecting your story...", "Plot points crystallising...", "World rules taking shape...",
  "Character arcs emerging...", "The story bible forms...",
];
