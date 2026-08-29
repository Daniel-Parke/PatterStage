// ═══════════════════════════════════════════════════════════════
// GET  /api/spend — provider spend per period and per source, plus the
//                   operator's budget and the verdict against it.
// PUT  /api/spend — set, change or clear the budget figure, its period, and
//                   the hard stop.
//
// The validation here is the load-bearing part, and it is deliberately
// duplicated with migration 033's CHECK constraints. The database's job is that
// a dishonest pair CANNOT exist; this route's job is that a person who tries to
// create one gets a sentence back instead of a constraint name.
//
// The rule both of them enforce: a hard stop is only ever armed beside a figure
// it can be measured against. A stop with no ceiling would refuse every
// unattended dispatch forever with no number anybody could raise.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";

import { badRequest, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { asSpendPeriod } from "@/lib/spend/spend-law";
import { getSpendSummary } from "@/lib/spend/spend-summary";
import { readSpendPolicy, writeSpendPolicy, type SpendPolicyPatch } from "@/lib/spend/spend-repository";

export async function GET() {
  try {
    ensureDb();
    return ok({ spend: getSpendSummary() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/spend", "", error, "Failed to load spend");
  }
}

export async function PUT(request: NextRequest) {
  try {
    ensureDb();
    const body = await parseJsonBody(request);
    if (body instanceof NextResponse) return body;

    const patch: SpendPolicyPatch = {};

    // `null` clears the budget back to unset, which is the shipped state and
    // must stay reachable: a figure you cannot remove is a figure you resent.
    if (body.limitUsd !== undefined) {
      if (body.limitUsd === null) {
        patch.limitUsd = null;
      } else if (typeof body.limitUsd === "number" && Number.isFinite(body.limitUsd) && body.limitUsd > 0) {
        patch.limitUsd = body.limitUsd;
      } else {
        return badRequest("Budget must be a positive number of US dollars, or null to remove it");
      }
    }

    if (body.period !== undefined) {
      const period = asSpendPeriod(body.period);
      if (!period) return badRequest("Period must be one of: day, week, month");
      patch.period = period;
    }

    if (body.hardStop !== undefined) {
      if (typeof body.hardStop !== "boolean") return badRequest("hardStop must be true or false");
      patch.hardStop = body.hardStop;
    }

    if (Object.keys(patch).length === 0) {
      return badRequest("Nothing to change: send limitUsd, period or hardStop");
    }

    // Clearing the figure disarms the stop in the SAME write, so the pair the
    // database forbids never has to exist even for a statement.
    if (patch.limitUsd === null) patch.hardStop = false;

    // Arming a stop needs a figure: either one arriving in this request, or one
    // already stored. Refused here with a sentence, and refused again by the
    // CHECK in migration 033 if this ever stops being true.
    if (patch.hardStop === true) {
      const figure = patch.limitUsd ?? readSpendPolicy().limitUsd;
      if (figure === null || figure === undefined) {
        return badRequest("Set a budget figure before switching the hard stop on");
      }
    }

    writeSpendPolicy(patch);
    return ok({ spend: getSpendSummary() });
  } catch (error) {
    return serverErrorFromCatch("PUT /api/spend", "updating spend budget", error, "Failed to update the budget");
  }
}
