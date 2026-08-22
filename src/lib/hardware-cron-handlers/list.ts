// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/list.ts - GET /api/cron/hardware
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { serverErrorFromError } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";

import { readAndParseCrontab } from "./crontab-store";

export async function handleListHardwareCrons(): Promise<NextResponse> {
  try {
    const { jobs } = await readAndParseCrontab();
    return ok({ jobs, total: jobs.length });
  } catch (e: unknown) {
    return serverErrorFromError("GET /api/cron/hardware", "read crontab", e, "Failed to read crontab");
  }
}
