/** @jest-environment node */

// T-0082, the honesty half of QA finding 7.
//
// The reported symptom was not only the ENOENT. It was that the toolset PUT
// answered 500 "failed" over a change that WAS saved — the DB write happens
// first, deliberately and documented — so the operator reloaded, saw their edit
// sitting there, and could not tell whether it had taken.
//
// WHAT THIS DOES NOT DO, and why. The obvious repair is to invert the order:
// push first, commit on success. That is not available here. Both push
// functions READ the committed row — pushRootToHermes calls getAgentRoot(),
// pushProfileToHermes calls getProfile(slug) — so there is nothing to push
// before the commit without restructuring them to take a proposed state. The
// honest fix at this size is to say what actually happened, which is what the
// operator needed in the first place: the change is saved, the mirror to Hermes
// is not, and nothing is lost.
//
// AND THE STATUS SPLIT. `POST /api/agent/profiles/sync/push` answered 200
// {success:false} for the same failure the toolsets route answered 500 for. It
// also put the reason at `data.result.error`, while runSyncAction looks at
// `data.error` — so the operator saw a bare "Push failed" and never the ENOENT
// underneath it. Single-target pushes now answer 500 carrying the reason. Batch
// pushes stay 200, because partial success across many profiles is a real
// outcome and not a server error, but they name the failures where the client
// actually reads.

import { NextResponse } from "next/server";

const mockPushRoot = jest.fn();
const mockPushProfile = jest.fn();
const mockPushAllProfiles = jest.fn();
const mockPushAllSkills = jest.fn();
const mockPushSkill = jest.fn();

jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushRootToHermes: () => mockPushRoot(),
  pushProfileToHermes: (slug: string) => mockPushProfile(slug),
  pushAllProfiles: (o: unknown) => mockPushAllProfiles(o),
  pushAllSkillsToHermes: () => mockPushAllSkills(),
  pushSkillToHermes: (k: string) => mockPushSkill(k),
}));

jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

import { toPatchResponse } from "@/modules/hermes/handlers/profile-patch";
import { POST as syncPush } from "@/app/api/agent/profiles/sync/push/route";

const ENOENT = "ENOENT: no such file or directory, open '/h/memories/USER.md'";

function failed(slug: string) {
  return { success: false, slug, backupPath: null, error: ENOENT };
}
function succeeded(slug: string) {
  return { success: true, slug, backupPath: "/h/backups", error: null };
}

function req(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ "content-type": "application/json" }),
  } as never;
}

async function bodyOf(res: Response) {
  return (await res.json()) as { error?: string; data?: Record<string, unknown> };
}

beforeEach(() => jest.clearAllMocks());

describe("a push that failed after the save says the save happened", () => {
  it("says the change was saved", async () => {
    // The sentence the operator needed. Without it, "Failed to update toolsets"
    // over an edit that is visibly still there is a contradiction they have to
    // resolve by guessing.
    const res = toPatchResponse({ ok: false, reason: "push-failed", error: ENOENT }, "Fallback");

    expect(await bodyOf(res as unknown as Response)).toMatchObject({
      error: expect.stringMatching(/saved/i),
    });
  });

  it("says the push is what failed, not the save", async () => {
    const body = await bodyOf(
      toPatchResponse({ ok: false, reason: "push-failed", error: ENOENT }, "F") as unknown as Response,
    );

    expect(body.error).toMatch(/hermes/i);
  });

  it("still carries the underlying reason", async () => {
    // Softening the message must not cost the diagnosis. ENOENT on a named path
    // is the most useful thing in the string.
    const body = await bodyOf(
      toPatchResponse({ ok: false, reason: "push-failed", error: ENOENT }, "F") as unknown as Response,
    );

    expect(body.error).toContain("USER.md");
  });

  it("is still a 500", async () => {
    // The operation the caller asked for did not fully happen, and a 200 would
    // put the burden of noticing back on a client that has to remember to look.
    const res = toPatchResponse({ ok: false, reason: "push-failed", error: ENOENT }, "F");

    expect((res as NextResponse).status).toBe(500);
  });

  it("GREEN CONTROL: not-found is untouched, and says nothing about saving", async () => {
    // A patch to a profile that does not exist saved nothing. Telling that
    // operator their change is safe would be a new lie in place of the old one.
    const res = toPatchResponse({ ok: false, reason: "not-found" }, "F");

    expect((res as NextResponse).status).toBe(404);
    expect((await bodyOf(res as unknown as Response)).error).not.toMatch(/saved/i);
  });

  it("GREEN CONTROL: success still returns null so the caller continues", () => {
    expect(toPatchResponse({ ok: true, profile: "default" }, "F")).toBeNull();
  });
});

describe("sync/push answers with the outcome it had", () => {
  it("a failed single-profile push is not a 200", async () => {
    mockPushProfile.mockReturnValue(failed("scout"));

    expect((await syncPush(req({ slug: "scout" }))).status).toBe(500);
  });

  it("a failed root push is not a 200", async () => {
    mockPushRoot.mockReturnValue(failed("default"));

    expect((await syncPush(req({ root: true }))).status).toBe(500);
  });

  it("puts the reason where the client actually reads it", async () => {
    // runSyncAction reads `data.error` on the 200 path and the thrown ApiError's
    // message on the non-2xx path — both of which come from the top-level
    // `error` field. The route used to bury the reason at `data.result.error`,
    // so every push failure surfaced as a bare "Push failed".
    mockPushRoot.mockReturnValue(failed("default"));

    const body = await bodyOf(await syncPush(req({ root: true })));

    expect(body.error).toContain("USER.md");
  });

  it("a failed skill push is not a 200 either", async () => {
    mockPushSkill.mockReturnValue(failed("some-skill"));

    expect((await syncPush(req({ skillKey: "some-skill" }))).status).toBe(500);
  });

  it("GREEN CONTROL: a successful single push is still 200 with its result", async () => {
    mockPushProfile.mockReturnValue(succeeded("scout"));

    const res = await syncPush(req({ slug: "scout" }));

    expect(res.status).toBe(200);
    expect((await bodyOf(res)).data).toMatchObject({ success: true });
  });

  it("a BATCH stays 200, because partial success is a real outcome", async () => {
    // Deliberately not converged onto 500. Twelve profiles of which one failed
    // is not a server error, and collapsing it to one would throw away the
    // eleven that worked.
    mockPushAllProfiles.mockReturnValue([succeeded("a"), failed("b")]);
    mockPushRoot.mockReturnValue(succeeded("default"));

    expect((await syncPush(req({ all: true }))).status).toBe(200);
  });

  it("but a batch names its failures where the client reads", async () => {
    mockPushAllProfiles.mockReturnValue([succeeded("a"), failed("b")]);
    mockPushRoot.mockReturnValue(succeeded("default"));

    const body = await bodyOf(await syncPush(req({ all: true })));

    expect(body.data?.success).toBe(false);
    expect(String(body.data?.error)).toContain("b");
  });

  it("GREEN CONTROL: a fully successful batch says nothing about failures", async () => {
    mockPushAllProfiles.mockReturnValue([succeeded("a"), succeeded("b")]);
    mockPushRoot.mockReturnValue(succeeded("default"));

    const body = await bodyOf(await syncPush(req({ all: true })));

    expect(body.data?.success).toBe(true);
    expect(body.data?.error).toBeUndefined();
  });

  it("GREEN CONTROL: a request naming nothing is still a 400", async () => {
    expect((await syncPush(req({}))).status).toBe(400);
  });
});
