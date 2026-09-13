// ═══════════════════════════════════════════════════════════════
// API Test Helpers — shared utilities for route tests
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

/** Create a mock NextRequest for testing API routes. */
export function mockRequest(
  url: string,
  method: string = "GET",
  body?: unknown,
  searchParams?: Record<string, string>
): NextRequest {
  let fullUrl = url;
  if (searchParams && Object.keys(searchParams).length > 0) {
    const params = new URLSearchParams(searchParams);
    fullUrl += "?" + params.toString();
  }
  return new NextRequest(fullUrl, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

// Three more were exported here and nothing called any of them (tests-13):
//
//   expectJsonResponse  a status assertion plus response.json(), which every
//                       suite writes inline because it wants its own message
//   setupFsMocks        a bag of jest.fn()s wired to nothing; a caller still
//                       had to write the jest.mock factory itself
//   setupRouteMocks     seven jest.mock calls inside a function, which jest
//                       does not hoist, so it could not have worked from a
//                       test body; its own comment said so
//
// knip could not say so: its project globs stop at src and scripts, and
// widening them to tests/ is tooling-16, which waits on cross-cutting-22 and
// tooling-02. Until then a dead export here is found by reading.
