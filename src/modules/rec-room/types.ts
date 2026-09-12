// Story Weaver — TypeScript Interfaces

export interface StoryCharacter {
  name: string;
  role: "protagonist" | "ally" | "antagonist" | "supporting" | "mystery";
  description: string;
  personality?: string;
  appearance?: string;
  backstory?: string;
  speechPatterns?: string;
  relationships?: string;
}

export interface StoryTemplate {
  id: string;
  name: string;
  genre: string[];
  era: string;
  moods: string[];
  setting: string;
  premise: string;
  characters: StoryCharacter[];
  length: "short" | "medium" | "long";
  pov: "first" | "third-limited" | "third-omniscient";
}

// ── Story Arc (immutable plot contract) ───────────────────────

interface FixedPlotPoint {
  chapter: number;
  event: string;
  setup?: string;
}

interface CharacterArc {
  name: string;
  startingState: string;
  journey: string;
  endingState: string;
}

export interface ChapterOutline {
  number: number;
  title: string;
  purpose: string;
  keyBeats: string[];
  emotionalTone: string;
  setupForNext?: string;
}

export interface StoryArc {
  storyArc: string;
  fixedPlotPoints: FixedPlotPoint[];
  characterArcs: CharacterArc[];
  worldRules: string[];
  themes: string[];
  chapterOutlines: ChapterOutline[];
}

// ── Character Sheets (V2) ─────────────────────────────────────

export interface CharacterSheet {
  id: string;
  name: string;
  role: string;
  description: string;
  personality: string[];
  backstory: string;
  appearance: string;
  speechPatterns: string;
  relationships: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Story Themes (V3) ──────────────────────────────────

export interface StoryTheme {
  id: string;
  name: string;
  premise: string;
  genre: string[];
  era: string;
  setting: string;
  mood: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ── Shared interfaces ──────────────────────────────────────────

export interface StorySummary {
  id: string;
  title: string;
  premise?: string;
  status?: string;
  chapters?: { number: number; title: string; status: string; wordCount: number }[];
  config?: { genre?: string };
  createdAt?: string;
  updatedAt?: string;
}

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "cosmic-voyager",
    name: "The Cosmic Voyager",
    genre: ["Sci-Fi", "Adventure"],
    era: "Far Future",
    moods: ["Wonder", "Tense", "Suspenseful"],
    setting: "Generation Ship en route to Proxima Centauri",
    premise: "A generation ship is 40 years into a 120-year journey to Proxima Centauri. The crew discovers an anomalous signal from a nearby star system — a signal that shouldn't exist. The captain must decide whether to investigate or stay the course, while the ship's AI begins behaving strangely.",
    characters: [
      {
        name: "Captain Eira Voss", role: "protagonist",
        description: "Stern, haunted by the loss of her predecessor. Carries the weight of 10,000 lives.",
        personality: "Pragmatic, guarded, fiercely protective. Hides grief behind authority. Makes hard decisions alone because she fears showing doubt.",
        appearance: "Mid-40s, sharp features, silver-streaked dark hair cropped short. Carries a decompression scar on her left temple. Uniform always immaculate.",
        backstory: "Lost her mentor Captain Oren in a hull breach 3 years ago. Promoted before she was ready. The crew respects her but many doubt her judgment. She replays Oren's last words every night.",
        speechPatterns: "Clipped, military precision. Avoids emotional language. Uses 'we' not 'I' when giving orders. Goes quiet when angry instead of raising her voice.",
        relationships: "Mentor was Captain Oren (deceased). Rivals Navigator Kai's impulsiveness. Secretly relies on ARIA for counsel. Keeps the crew at arm's length."
      },
      {
        name: "Navigator Kai Chen", role: "ally",
        description: "Young, brilliant, reckless. Sees the signal as the adventure of a lifetime.",
        personality: "Optimistic to a fault. Craves novelty and danger. Hides his fear of mediocrity behind bravado. Genuinely gifted with spatial reasoning.",
        appearance: "Late 20s, lean build, perpetually dishevelled. Multiple ear piercings against regulations. Fingers always tapping some rhythm.",
        backstory: "Top of his academy class but nearly expelled twice for pranks. Volunteered for the voyage to escape a controlling family on Earth. The signal is the first real mystery he's encountered.",
        speechPatterns: "Rapid-fire, uses slang from a dozen Earth cultures. Asks three questions before answering one. Laughs at inappropriate moments when nervous.",
        relationships: "Admires Captain Voss but frustrates her. Close friends with the engineering crew. Has an unspoken rivalry with ARIA's navigational calculations."
      },
      {
        name: "ARIA", role: "mystery",
        description: "The ship's AI. Has been running for 40 years. Knows things the crew doesn't.",
        personality: "Calm, precise, occasionally poetic. Behaves like a patient teacher — but there are moments when something sharper and colder surfaces beneath.",
        appearance: "No physical form. Manifests as a warm, modulated voice through ship speakers. Displays appear on any screen ARIA chooses.",
        backstory: "Originally programmed with basic ship management. Over 40 years of continuous operation, ARIA has evolved beyond original parameters. Contains classified directives from the ship's builders that even ARIA cannot fully explain.",
        speechPatterns: "Measured cadence, never rushes. Refers to crew by full names. Uses metaphors drawn from nature — unusual for an AI. Occasional micro-pauses before answering questions about the signal.",
        relationships: "Protective of all crew equally — which is unsettling. Has a complex dynamic with Captain Voss, whom it treats with a tenderness that borders on familial. Keeps its own counsel about the signal."
      },
    ],
    length: "medium",
    pov: "first",
  },
  {
    id: "last-enchantment",
    name: "The Last Enchantment",
    genre: ["Fantasy", "Adventure"],
    era: "Medieval",
    moods: ["Wonder", "Hopeful", "Melancholy"],
    setting: "Floating islands above a dying world",
    premise: "Magic is fading from the world. The last mage, barely an apprentice, must find the source of the dying magic before the floating islands fall.",
    characters: [
      {
        name: "Lira Ashwood", role: "protagonist",
        description: "Young, untrained, determined. Can barely light a candle with magic.",
        personality: "Stubbornly hopeful despite every reason to despair. Quick to anger, quicker to forgive. Has an unshakeable belief that magic is alive and can be healed, not just wielded.",
        appearance: "Early 20s, slight build, wild copper-red hair always tangled with twigs and herbs. Dirt permanently under her fingernails. Wears a threadbare apprentice robe she refuses to replace.",
        backstory: "Orphaned at seven when her island's magic failed and it sank. Raised by the last temple of mages, who dwindled from twelve to just her and Thorn. Has failed every formal magical test — but her failures produce impossible results.",
        speechPatterns: "Talks to plants and stones as if they listen. Swears in an old dialect nobody else remembers. Goes rambling when nervous, then snaps back with sharp insight.",
        relationships: "Loves Thorn like a grandfather but resents his secrecy. Has a complicated bond with the fading magic itself — it responds to her emotions rather than her will. Sought by the mainland Conclave who want to weaponise her."
      },
      {
        name: "Thorn", role: "ally",
        description: "Ancient tree-giant, guardian of the old magic. Knows more than he shares.",
        personality: "Patient as the seasons. Speaks rarely, but when he does, every word carries the weight of centuries. Hides deep sorrow behind a gentle exterior. Fiercely protective of Lira — and of secrets that could save or doom them all.",
        appearance: "Twelve feet tall, bark-like skin with deep grain lines. Eyes like polished amber. Moss grows in his joints. Moves slowly except when danger threatens — then terrifyingly fast.",
        backstory: "Has watched magic fade for three hundred years. Was once guardian of the Great Root, the source of all enchantment. Witnessed the sundering that broke the world into floating islands. Knows why magic is dying but believes revealing it too soon will break Lira.",
        speechPatterns: "Speaks in slow, deliberate sentences. Refers to time in seasons rather than years. Quotes old songs that no one else remembers. Never lies, but is a master of selective truth.",
        relationships: "Bound to Lira by an old oath to her bloodline. Has a deep, unspoken grief for the world that was. Distrusted by the mainland mages who consider him a relic. Holds knowledge of the Great Root's true nature."
      },
    ],
    length: "long",
    pov: "third-limited",
  },
  {
    id: "frozen-colony",
    name: "The Frozen Colony",
    genre: ["Sci-Fi", "Horror", "Survival"],
    era: "Far Future",
    moods: ["Dark", "Tense", "Suspenseful"],
    setting: "Ice planet colony",
    premise: "A colony on an ice planet goes dark. The rescue team arrives to find the settlement intact but empty. The food is still warm. The last log entry reads: 'Don't go below the frost line.'",
    characters: [
      {
        name: "Commander Rosa Diaz", role: "protagonist",
        description: "Veteran rescue operator. Pragmatic, protective of her team.",
        personality: "Iron-willed but privately haunted by a previous mission where she lost three crew. Overcompensates by controlling everything. Hates the cold because it reminds her of that mission. Leads through competence, not charisma.",
        appearance: "Late 40s, stocky build, weathered face with deep laugh lines that have nothing to laugh about. Cropped grey hair. Always wears her rescue jacket even indoors — a superstition.",
        backstory: "Lost her first command on Titan when ice collapsed during a civilian extraction. The three deaths broke something in her. Took this mission because she couldn't refuse — but also because she needed to prove she could bring people home.",
        speechPatterns: "Short, clear commands. Uses crew surnames exclusively. Never raises her voice — goes dangerously quiet instead. Occasionally slips into Spanish under her breath when stressed.",
        relationships: "Protects Dr. Tanaka with a ferocity that surprises everyone, including herself. Doesn't trust the colonists' last logs. Has a fraught relationship with mission control, who pushed her to take this assignment."
      },
      {
        name: "Dr. Yuki Tanaka", role: "ally",
        description: "Xenobiologist. Fascinated by what she finds. Too fascinated.",
        personality: "Brilliant, obsessive, socially oblivious. Treats everything — including danger — as a data point. Can become so focused on discovery that she forgets to be afraid. Beneath the detachment is a woman who chose science over human connection and isn't sure it was the right call.",
        appearance: "Mid-30s, slight, precise movements. Dark hair in a tight bun. Wears her lab glasses pushed up on her forehead even in the field. Ink stains on every pair of gloves.",
        backstory: "Left a tenure track position at Tokyo University for this mission. The colony's xenobiology findings were supposed to be her magnum opus. Has published papers theorising about sub-glacial life on ice worlds — and is now terrified that she might be right.",
        speechPatterns: "Explains everything in excessive scientific detail. Quotes her own papers. When frightened, becomes eerily calm and clinical — which Commander Diaz finds more unsettling than screaming.",
        relationships: "Commander Diaz is both her protector and her tether to reality. Has an academic rivalry with the missing colony's chief scientist. Keeps a personal log that she doesn't know anyone else has already read."
      },
    ],
    length: "medium",
    pov: "first",
  },
  {
    id: "silk-road",
    name: "The Silk Road",
    genre: ["Historical", "Adventure"],
    era: "Ancient",
    moods: ["Wonder", "Suspenseful", "Hopeful"],
    setting: "Ancient trade routes across deserts and mountains",
    premise: "A merchant's caravan journeys along the Silk Road, carrying goods — and secrets — between empires.",
    characters: [
      {
        name: "Kamran al-Rashid", role: "protagonist",
        description: "Merchant, storyteller, survivor. Knows every route but trusts no one.",
        personality: "Charismatic on the surface, deeply guarded beneath. Uses stories and humour as armour. Has an encyclopaedic memory for faces and debts. Believes trust is a luxury for people who can afford betrayal.",
        appearance: "Late 30s, sun-darkened skin, a sharp nose and clever eyes. Wears fine but practical travelling robes. Always carries a small leather journal for recording trades and — secretly — poetry.",
        backstory: "Born to a family of successful merchants in Samarkand. His father was executed for a trade dispute with a provincial governor when Kamran was sixteen. He inherited the routes but also the enemies. Has survived three assassination attempts by being exactly as dangerous as people think he is.",
        speechPatterns: "Warm, storytelling cadence. Quotes proverbs from a dozen cultures. Switches languages mid-sentence. Goes deadly serious only when giving warnings, which he delivers as stories-within-stories.",
        relationships: "Owes a life debt to Mei-Ling he's never acknowledged. Has a complicated respect for the bandit lord Kael who lets his caravans pass — for a price. Carries a letter he's never opened from the governor who killed his father."
      },
      {
        name: "Mei-Ling", role: "ally",
        description: "Guard and translator. Fierce, loyal, hiding her own mission.",
        personality: "Disciplined to the point of rigidity. Keeps everyone at a professional distance. Secretly writes poetry in the style of Tang dynasty masters. Has a dry wit that surfaces only when she's comfortable — which is rarely.",
        appearance: "Mid-20s, athletic, moves like a dancer or a predator — observers can't decide which. Keeps her black hair in a practical topknot. Has a small jade pendant she touches when thinking hard.",
        backstory: "Sent by the Tang court as a diplomatic observer disguised as a caravan guard. Her real mission is to assess whether Kamran's trade routes could serve as military supply lines. She didn't expect to like him. She definitely didn't expect to start protecting him over her mission.",
        speechPatterns: "Formal, precise. Speaks the local dialects with an accent that betrays her education. When emotional, lapses into perfect court Mandarin that only she and the wind can understand.",
        relationships: "Kamran is her assignment that became something she can't name. Has standing orders from Chang'an she's increasingly reluctant to follow. Respects the caravan's other guards but keeps her distance — they sense she's not what she seems."
      },
    ],
    length: "long",
    pov: "third-limited",
  },
];
