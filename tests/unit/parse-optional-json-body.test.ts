// Unit tests for the parseOptionalJsonBody helper
// (src/lib/parse-optional-json-body.ts).
//
// parseOptionalJsonBody is the SIBLING of parseJsonBody. It returns
// `Record<string, unknown>` on success, OR `{}` when the body is missing,
// unparseable, or otherwise unusable. It is intended for routes that
// treat the JSON body as a bag of optional flags (e.g.
// `POST /api/agent/profiles/sync/push`) where the user is allowed to
// POST an empty body, malformed JSON, or no body at all.
//
// The behaviour is the OPPOSITE of parseJsonBody: parseJsonBody returns
// 400 on parse failure; parseOptionalJsonBody silently coerces to `{}`.
// Do NOT use parseOptionalJsonBody for routes that REQUIRE a body.

import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";

// Minimal NextRequest-like object — only `.json()` is invoked by the
// helper, and we never need any NextResponse behaviour (the helper
// always returns Record<string, unknown>, never a NextResponse).
function makeRequest(body: string | null): { json: () => Promise<unknown> } {
  return {
    json: async () => {
      if (body === null) {
        throw new SyntaxError("Unexpected end of JSON input");
      }
      return JSON.parse(body);
    },
  };
}

describe("parseOptionalJsonBody", () => {
  it("returns the parsed object on valid JSON", async () => {
    const req = makeRequest('{"slug": "default", "all": true}');
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({ slug: "default", all: true });
  });

  it("returns an empty object on malformed JSON", async () => {
    const req = makeRequest("{not valid json");
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({});
  });

  it("returns an empty object when json() throws (e.g. empty body)", async () => {
    const req = makeRequest(null);
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({});
  });

  it("returns an empty object when the body is the JSON literal `null`", async () => {
    // Some clients send `null` as the body. JSON.parse succeeds but
    // returns null, which would crash any later `body.field` access.
    const req = makeRequest("null");
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({});
  });

  it("returns an empty object when the body is a JSON array, not an object", async () => {
    // Defensive: an array should NOT be passed as the body of an
    // "optional flags" route. The helper coerces to {} rather than
    // surfacing the array — callers treat this as "no flags set".
    const req = makeRequest("[1, 2, 3]");
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({});
  });

  it("returns an empty object when the body is a JSON string", async () => {
    const req = makeRequest('"hello"');
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({});
  });

  it("returns an empty object when the body is a JSON number", async () => {
    const req = makeRequest("42");
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({});
  });

  it("preserves all keys when the body is a valid object", async () => {
    // Smoke test: deep-equal the full payload to make sure no keys
    // are silently dropped (e.g. by a typo in a key-picker).
    const req = makeRequest(
      '{"slug": "work", "all": true, "root": false, "skills": true, "skillKey": "x", "missingOnly": true, "onlyOutOfSync": false, "reconcileDisk": true, "importDiscovered": false}'
    );
    const result = await parseOptionalJsonBody(req as never);
    expect(result).toEqual({
      slug: "work",
      all: true,
      root: false,
      skills: true,
      skillKey: "x",
      missingOnly: true,
      onlyOutOfSync: false,
      reconcileDisk: true,
      importDiscovered: false,
    });
  });
});
