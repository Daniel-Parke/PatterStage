// ═══════════════════════════════════════════════════════════════
// Hindsight Health Banner — shows when Hindsight is unavailable
// ═══════════════════════════════════════════════════════════════
// One error surface, with its Retry inside it (T-0096): this used to pair a
// message-only banner (since retired) with a separate button.

import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { healthBannerMessage } from "./health-message";
import type { HealthState } from "./types";

interface HealthBannerProps {
  health: HealthState;
  loadingInitial: boolean;
  onRetry: () => void;
}

export default function HealthBanner({ health, loadingInitial, onRetry }: HealthBannerProps) {
  if (loadingInitial || health.available) return null;

  return <LoadErrorBanner error={healthBannerMessage(health)} onRetry={onRetry} />;
}
