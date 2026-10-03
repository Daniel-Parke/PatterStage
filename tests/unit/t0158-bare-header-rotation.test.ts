/** @jest-environment node */
/** ADR-0012: a queued raw Authorization response stops after token rotation. */
import { randomBytes } from "node:crypto";
import {
  createHeldSession,
  finishHeldResponse,
  heldGatewayModels,
  installHeldGatewayMock,
  type HeldSession,
} from "../helpers/t0158-held-session";

let mockFetchGateway: jest.Mock;
jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

let session: HeldSession;

const heldModels = (authorization: string, marker: string) =>
  heldGatewayModels(mockFetchGateway, { authorization }, marker);

beforeEach(async () => {
  jest.resetModules();
  mockFetchGateway = installHeldGatewayMock();
  session = await createHeldSession("t0158-bare-header-", "http://127.0.0.1:8652");
});

afterEach(() => {
  session.dispose();
});

describe("T-0158 bare Authorization rotation", () => {
  it("Given a valid raw Authorization token, a held model response reaches the caller", async () => {
    const marker = "t0158-valid-raw-header-model-marker";
    const response = await finishHeldResponse(heldModels(session.operatorToken, marker));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });

  it("Given a held raw Authorization response, token rotation prevents release", async () => {
    const marker = "t0158-rotated-raw-header-model-marker";
    const held = heldModels(session.operatorToken, marker);
    const response = await finishHeldResponse(held, async () => {
      process.env.PS_AUTH_TOKEN = randomBytes(32).toString("hex");
      expect(process.env.PS_AUTH_TOKEN === session.operatorToken).toBe(false);
    });
    const body = await response.text();
    expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
  });

  it("Given a valid prefixed Bearer token, a held model response reaches the caller", async () => {
    const marker = "t0158-valid-bearer-header-model-marker";
    const response = await finishHeldResponse(heldModels(`Bearer ${session.operatorToken}`, marker));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(marker);
  });
});
