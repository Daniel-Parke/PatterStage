/** @jest-environment node */

// T-0083 acceptance oracle — operator ruling 3, from QA finding 17 (Section D).
//
// There is no way to delete a credential. Every piece is already built:
// `deleteCredential` exists as the POST rollback path,
// `removeCredentialFromHermesEnv` exists as production code whose own docstring
// says "Used when a credential is deleted", and `models.credentials_id` is
// `ON DELETE SET NULL`. The door was never hung.
//
// THE HAZARD, and the reason this file is longer than the route.
// `upsertCredential`'s docstring claims credentials are "matched by provider
// (unique constraint)". There is no unique constraint. Migration 001 creates a
// plain `CREATE INDEX idx_credentials_provider`, so two rows CAN share a
// provider — and the `.env` var is per-PROVIDER, not per-row. Deleting one of
// two OpenAI keys must not blank OPENAI_API_KEY out from under the other,
// which is what a naive "delete row, remove env var" would do.
//
// The second hazard is quieter: a model attached to the deleted credential is
// silently unlinked by the foreign key and stops working at its next call. The
// operator is told, at the moment they can still change their mind.

const mockGetCredential = jest.fn();
const mockDeleteCredential = jest.fn();
const mockListCredentials = jest.fn();
const mockRemoveFromEnv = jest.fn();
const mockAppendAuditLine = jest.fn();
const mockListModels = jest.fn();

jest.mock("@/lib/credentials-repository", () => ({
  getCredential: (id: string) => mockGetCredential(id),
  deleteCredential: (id: string) => mockDeleteCredential(id),
  listCredentials: () => mockListCredentials(),
}));
jest.mock("@/modules/hermes/lib/hermes-env-sync", () => ({
  removeCredentialFromHermesEnv: (p: string) => mockRemoveFromEnv(p),
}));
jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: (l: unknown) => mockAppendAuditLine(l),
}));
jest.mock("@/lib/models-repository", () => ({
  listModels: () => mockListModels(),
}));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

import { DELETE } from "@/app/api/credentials/[id]/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function cred(id: string, provider: string) {
  return { id, provider, label: `${provider} key`, keyHint: "sk-…abcd" };
}

async function bodyOf(res: Response) {
  return (await res.json()) as { error?: string; data?: Record<string, unknown> };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteCredential.mockReturnValue(true);
  mockRemoveFromEnv.mockReturnValue({ backupPath: null });
  mockListModels.mockReturnValue([]);
  mockGetCredential.mockImplementation((id: string) =>
    id === "c1" ? cred("c1", "openai") : null,
  );
  mockListCredentials.mockReturnValue([cred("c1", "openai")]);
});

describe("the row goes", () => {
  it("deletes it and says so", async () => {
    const res = await DELETE({} as never, ctx("c1"));

    expect(res.status).toBe(200);
    expect(mockDeleteCredential).toHaveBeenCalledWith("c1");
  });

  it("404s for an id that is not there, without deleting anything", async () => {
    const res = await DELETE({} as never, ctx("nope"));

    expect(res.status).toBe(404);
    expect(mockDeleteCredential).not.toHaveBeenCalled();
  });

  it("leaves a trace", async () => {
    // T-0070's rule: a destructive act leaves a record. This one removes a
    // secret from two places at once.
    await DELETE({} as never, ctx("c1"));

    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "credential.delete", resource: "c1", ok: true }),
    );
  });

  it("never echoes the key, not even a hint of it, in the response", async () => {
    mockGetCredential.mockReturnValue({
      ...cred("c1", "openai"),
      apiKey: "sk-super-secret-value",
    });

    const body = JSON.stringify(await bodyOf(await DELETE({} as never, ctx("c1"))));

    expect(body).not.toContain("sk-super-secret-value");
  });
});

describe("the .env var goes ONLY when nothing else needs it", () => {
  it("removes it when this was the provider's last credential", async () => {
    mockListCredentials.mockReturnValue([]); // after the delete

    await DELETE({} as never, ctx("c1"));

    expect(mockRemoveFromEnv).toHaveBeenCalledWith("openai");
  });

  it("KEEPS it when a sibling still uses the same provider", async () => {
    // The hazard. There is no unique constraint on `provider`, whatever
    // upsertCredential's docstring says, so two OpenAI keys can coexist — and
    // OPENAI_API_KEY is shared between them. Blanking it would break a
    // credential the operator did not touch.
    mockListCredentials.mockReturnValue([cred("c2", "openai")]);

    await DELETE({} as never, ctx("c1"));

    expect(mockRemoveFromEnv).not.toHaveBeenCalled();
  });

  it("says which it did, so the operator is not guessing", async () => {
    mockListCredentials.mockReturnValue([cred("c2", "openai")]);

    const body = await bodyOf(await DELETE({} as never, ctx("c1")));

    expect(String(JSON.stringify(body.data))).toMatch(/openai/i);
  });

  it("still reports success when the row went but the .env write failed", async () => {
    // The row is gone; that is the operator's request and it happened. A 500
    // here would say the deletion did not take, which is false, and would
    // invite a retry that 404s. Same lesson as T-0082.
    mockListCredentials.mockReturnValue([]);
    mockRemoveFromEnv.mockImplementation(() => {
      throw new Error("EACCES: permission denied, open '/h/.env'");
    });

    const res = await DELETE({} as never, ctx("c1"));
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(JSON.stringify(body.data)).toMatch(/EACCES|env/i);
  });
});

describe("a model that loses its key is named", () => {
  it("reads the attachments BEFORE the delete, while the link still exists", async () => {
    // Mutation found this. ON DELETE SET NULL means the link is GONE the
    // instant the row goes, so a filter run afterwards matches nothing and the
    // warning is silently always empty. The earlier test could not see it,
    // because its listModels mock answered the same thing whenever it was
    // called. This one simulates the foreign key.
    mockListCredentials.mockReturnValue([]);
    let rowDeleted = false;
    mockDeleteCredential.mockImplementation(() => {
      rowDeleted = true;
      return true;
    });
    mockListModels.mockImplementation(() =>
      rowDeleted
        ? [{ id: "m1", modelId: "gpt-4o", credentialsId: null }]
        : [{ id: "m1", modelId: "gpt-4o", credentialsId: "c1" }],
    );

    const body = await bodyOf(await DELETE({} as never, ctx("c1")));

    expect(JSON.stringify(body.data)).toContain("gpt-4o");
  });

  it("warns about the models that were attached", async () => {
    // ON DELETE SET NULL unlinks them silently, and the next call they make
    // fails with a missing key. Saying so at the moment of deletion is the only
    // point where the operator can still change their mind.
    mockListCredentials.mockReturnValue([]);
    mockListModels.mockReturnValue([
      { id: "m1", modelId: "gpt-4o", credentialsId: "c1" },
      { id: "m2", modelId: "claude", credentialsId: "other" },
    ]);

    const body = await bodyOf(await DELETE({} as never, ctx("c1")));

    expect(JSON.stringify(body.data)).toContain("gpt-4o");
    expect(JSON.stringify(body.data)).not.toContain("claude");
  });

  it("GREEN CONTROL: says nothing about models when none were attached", async () => {
    mockListCredentials.mockReturnValue([]);
    mockListModels.mockReturnValue([{ id: "m2", modelId: "claude", credentialsId: "other" }]);

    const body = await bodyOf(await DELETE({} as never, ctx("c1")));

    expect(JSON.stringify(body.data)).not.toContain("claude");
  });

  it("deletes anyway — the warning is information, not a veto", async () => {
    // Refusing would leave the operator unable to remove a key that is in use,
    // which is exactly when removing it matters most.
    mockListCredentials.mockReturnValue([]);
    mockListModels.mockReturnValue([{ id: "m1", modelId: "gpt-4o", credentialsId: "c1" }]);

    await DELETE({} as never, ctx("c1"));

    expect(mockDeleteCredential).toHaveBeenCalledWith("c1");
  });
});
