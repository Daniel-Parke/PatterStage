// ═══════════════════════════════════════════════════════════════
// cron/types.ts — shared cron repository types
// ═══════════════════════════════════════════════════════════════

export interface HermesJobRaw {
  id: string;
  name?: string;
  prompt?: string;
  skills?: string[];
  skill?: string;
  model?: string;
  provider?: string;
  base_url?: string;
  schedule: unknown;
  schedule_display?: string;
  repeat?: unknown;
  enabled?: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  created_at?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_delivery_error?: string | null;
  mission_id?: string;
  [key: string]: unknown;
}

export interface CronJobRecord {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  model: string;
  provider: string;
  base_url: string | null;
  schedule: string; // JSON string
  schedule_display: string;
  repeat: { times: number | null; completed: number };
  enabled: boolean;
  state: string;
  deliver: string;
  script: string | null;
  profile_name: string;
  hermes_job_id: string | null;
  source: "ch" | "hermes";
  orphan: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  created_at: string;
  updated_at: string;
  workdir: string | null;
}

/** SQLite row shape for `cron_jobs`. */
export interface CronJobRow {
  id: string;
  name: string;
  prompt: string;
  skills: string;
  model: string;
  provider: string;
  base_url: string | null;
  schedule: string;
  schedule_display: string;
  repeat_json: string;
  enabled: number;
  state: string;
  deliver: string;
  script: string | null;
  profile_name: string;
  hermes_job_id: string | null;
  source: string;
  orphan: number;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  created_at: string;
  updated_at: string;
  workdir: string | null;
}

export interface CreateCronJobInput {
  name: string;
  prompt?: string;
  skills?: string[];
  model?: string;
  provider?: string;
  base_url?: string | null;
  schedule: string; // raw schedule string like "*/5 * * * *"
  schedule_display?: string;
  repeat?: { times: number | null; completed?: number };
  enabled?: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  profile_name?: string;
  hermes_job_id?: string | null; // if linking to existing Hermes job
  source?: "ch" | "hermes";
  workdir?: string | null;
}

export interface UpdateCronJobInput {
  name?: string;
  prompt?: string;
  skills?: string[];
  model?: string;
  provider?: string;
  base_url?: string | null;
  schedule?: string;
  schedule_display?: string;
  repeat?: { times: number | null; completed?: number };
  enabled?: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_delivery_error?: string | null;
  profile_name?: string;
  hermes_job_id?: string | null;
  orphan?: boolean;
  workdir?: string | null;
}

export interface ImportHermesJobResult {
  id: string;
  action: "inserted" | "updated";
  hermes_job_id: string;
}

export interface SyncResult {
  hermesImported: ImportHermesJobResult[];
  hermesExportErrors: string[];
  errors: string[];
}
