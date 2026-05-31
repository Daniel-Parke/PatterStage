// ═══════════════════════════════════════════════════════════════
// cron-repository.ts — SQLite-backed cron jobs + Hermes sync (barrel)
// ═══════════════════════════════════════════════════════════════
//
// Implementation lives in ./cron/*. Re-exported here for stable import paths.

export type {
  HermesJobRaw,
  CronJobRecord,
  CreateCronJobInput,
  UpdateCronJobInput,
  ImportHermesJobResult,
  SyncResult,
} from "./cron/types";

export {
  listCronJobs,
  getCronJob,
  getCronJobByHermesId,
} from "./cron/read";

export {
  createCronJob,
  updateCronJob,
  deleteCronJob,
  deleteCronJobByHermesId,
  normalizeRepeat,
  parseRepeatJson,
} from "./cron/write";

export {
  importHermesJobs,
  syncAllJobsToHermes,
  pushJobToHermes,
  removeJobFromHermes,
  syncCronWithHermes,
  triggerJobViaGateway,
} from "./cron/hermes-sync";
