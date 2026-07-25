// Shared type for the mission template modals. Lives in its own module so
// the manager + editor modals and the lib/hook consumers can import it
// without pulling in either modal's component tree.

import type { LocalDirEntry } from "@/types/console";

export interface MissionTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  profile: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  suggestedSkills: string[];
  suggestedToolsets?: string[];
  localDirs?: LocalDirEntry[];
  references?: string[];
  isCustom?: boolean;
  dispatchMode?: string;
  schedule?: string;
  defaultModel?: string;
  defaultProvider?: string;
  timeoutMinutes?: number;
  outputFormat?: string;
  constraints?: string;
}
