// Shared type for the mission template modals. Lives in its own module so
// the manager + editor modals and the lib/hook consumers can import it
// without pulling in either modal's component tree.

export type { MissionTemplate } from "@/lib/missions/mission-types";
