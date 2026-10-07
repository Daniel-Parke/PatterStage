/** @jest-environment jsdom */
// T-0193 ORACLE Franklin-01a1062c-ad31-77c2-8ff2-71c41ee9b5d6, 2026-10-04.
// Metamorphic read truth: held, failed, empty and cached answers remain distinct.
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { renderWithQuery } from "../helpers/render-with-query";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { jsonResponse, type FetchAnswer } from "../helpers/fetch-map";
import ModelsPage from "@/app/agent/models/page";
import SkillDetailPage from "@/app/agent/skills/[...path]/page";
import AgentGrowthPanel from "@/components/agents/AgentGrowthPanel";
import { emptyModelDefaults } from "@/lib/utils";

let mockPath: string | string[] | undefined;
jest.mock("next/navigation", () => ({
  useParams: () => ({ path: mockPath }), usePathname: () => "/agent/models",
  useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());

const originalFetch = global.fetch;
let drain = async () => {};
beforeEach(() => { mockPath = ["testing", "owned-skill"]; drain = async () => {}; });
afterEach(async () => { await drain(); cleanup(); global.fetch = originalFetch; });
const failure: FetchAnswer = { body: { error: "Owned read failure" }, status: 500 };
const skillUrl = "/api/skills/testing/owned-skill";
const thinSkill = { name: "Owned Skill", path: "testing/owned-skill", source: "catalog", content: "Owned skill body" };
const model = { id: "owned-model", name: "Owned Model", provider: "ollama", modelId: "owned-local", baseUrl: null, contextLength: null, credentialsId: null, createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z" };

function modelAnswers(models: typeof model[] = []): Record<string, FetchAnswer> {
  return {
    "/api/models": { body: { data: { models } } },
    "/api/credentials": { body: { data: { credentials: [] } } },
    "/api/models/defaults": { body: { data: { defaults: emptyModelDefaults() } } },
    "/api/models/sync/drift": { body: { data: null } },
    "/api/models/fallbacks": { body: { data: { entries: [] } } },
    "/api/models/fallbacks/config": { body: { data: { config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 3 } } } },
  };
}
function install(answers: Record<string, FetchAnswer>, heldUrl?: string) {
  const held = pendingLookup<Response>();
  const fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if ((init?.method ?? "GET") !== "GET") throw new Error(`Unexpected write: ${url}`);
    if (url === heldUrl) return held.promise;
    const answer = answers[url];
    if (!answer) throw new Error(`Unmatched owned read: ${url}`);
    return jsonResponse(answer.body, answer.status);
  });
  global.fetch = fetch;
  async function release(answer: FetchAnswer) {
    await act(async () => { held.complete(jsonResponse(answer.body, answer.status)); });
  }
  drain = () => release(failure);
  return { fetch, release };
}
function expectOnlyReads(fetch: jest.Mock) {
  expect(fetch.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  expect(fetch.mock.calls.some(([url]) => String(url).includes("/import"))).toBe(false);
}
// Drives the real shared cache for a background read, without inventing a page action.
function BackgroundReload({ endpoint }: { endpoint: string }) {
  const client = useQueryClient();
  return <button onClick={() => void client.refetchQueries({ queryKey: [endpoint], exact: true })}>Fixture background reload</button>;
}

describe("T-0193 Models read truth", () => {
  it("held first read shows loading, then a genuine empty registry", async () => {
    const answers = modelAnswers(); const net = install(answers, "/api/models");
    renderWithQuery(<ModelsPage />);
    expect(screen.getByText(/Loading models/)).toBeInTheDocument();
    expect(screen.queryByText(/No models yet/i)).toBeNull();
    await net.release(answers["/api/models"]);
    await screen.findByText(/No models yet/i); expect(screen.queryByRole("alert")).toBeNull();
    expectOnlyReads(net.fetch);
  });

  it.each(["/api/models", "/api/credentials", "/api/models/defaults"])("%s failure is not empty and Retry only reads", async (endpoint) => {
    const answers = modelAnswers(); answers[endpoint] = failure; const net = install(answers);
    renderWithQuery(<ModelsPage />); await screen.findByRole("alert");
    expect(screen.queryByText(/No models yet/i)).toBeNull();
    answers[endpoint] = modelAnswers()[endpoint];
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await screen.findByText(/No models yet/i); expectOnlyReads(net.fetch);
    expect(net.fetch.mock.calls.filter(([url]) => url === endpoint)).toHaveLength(2);
  });

  it("failed background reload preserves cached model row and open disclosure", async () => {
    const answers = modelAnswers([model]); const net = install(answers);
    const h = renderWithQuery(<><ModelsPage /><BackgroundReload endpoint="/api/models" /></>);
    const disclosure = await screen.findByRole("button", { name: /Fallback Chain/ });
    fireEvent.click(disclosure);
    const row = h.container.querySelector('[data-row-id="owned-model"]'); expect(row).toBeInTheDocument();
    answers["/api/models"] = failure;
    fireEvent.click(screen.getByRole("button", { name: "Fixture background reload" }));
    await screen.findByRole("alert");
    expect(row).toBeInTheDocument(); expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText(/No models yet/i)).toBeNull(); expectOnlyReads(net.fetch);
  });
});

describe("T-0193 Skill read truth", () => {
  it.each(["500", "network"])("%s failure differs from missing and Retry recovers a thin catalogue payload", async (mode) => {
    const answers = { [skillUrl]: failure }; const net = install(answers);
    if (mode === "network") net.fetch.mockRejectedValueOnce(new TypeError("Owned read failure"));
    renderWithQuery(<SkillDetailPage />); await screen.findByText("Owned read failure");
    expect(screen.queryByText("Skill Not Found")).toBeNull();
    answers[skillUrl] = { body: { data: thinSkill } };
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { level: 1, name: "Owned Skill" });
    expect(screen.getByText("Owned skill body")).toBeInTheDocument(); expectOnlyReads(net.fetch);
    expect(net.fetch).toHaveBeenCalledTimes(2);
  });

  it("404 remains genuinely missing", async () => {
    install({ [skillUrl]: { body: { error: "Owned missing skill" }, status: 404 } });
    renderWithQuery(<SkillDetailPage />); await screen.findByText("Skill Not Found");
    expect(screen.getByText("Owned missing skill")).toBeInTheDocument();
  });

  it.each([[undefined], ["testing/owned-skill"], [["testing", "", "owned-skill"]]])("malformed path %p remains local and sends no request", async (path) => {
    mockPath = path; const net = install({}); renderWithQuery(<SkillDetailPage />);
    await screen.findByText("Skill Not Found"); expect(screen.getByText(/Invalid skill path/)).toBeInTheDocument();
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it("held first read and thin catalogue success remain usable", async () => {
    const net = install({}, skillUrl); renderWithQuery(<SkillDetailPage />);
    expect(screen.getByText(/Loading skill/)).toBeInTheDocument();
    await net.release({ body: { data: thinSkill } });
    await screen.findByRole("heading", { level: 1, name: "Owned Skill" });
    fireEvent.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByText("Owned skill body")).toBeInTheDocument();
    expect(screen.queryByText("Skill Not Found")).toBeNull();
  });
});

describe("T-0193 Growth read truth", () => {
  const endpoint = "/api/agents/experience";
  it("held read is loading and successful empty is no completed work", async () => {
    const net = install({}, endpoint); renderWithQuery(<AgentGrowthPanel profileId="qa" />);
    expect(screen.getByText("Loading growth…")).toBeInTheDocument();
    expect(screen.queryByText(/No completed work yet/)).toBeNull();
    await net.release({ body: { data: { entries: [] } } });
    await screen.findByText(/No completed work yet/); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("failed read does not claim no completed work and Retry recovers measured growth", async () => {
    const answers = { [endpoint]: failure }; const net = install(answers);
    renderWithQuery(<AgentGrowthPanel profileId="qa" />);
    await waitFor(() => expect(screen.queryByText("Loading growth…")).toBeNull());
    expect(screen.queryByText(/No completed work yet/)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Owned read failure");
    answers[endpoint] = { body: { data: { entries: [{ rank: 1, targetRef: "qa", targetLabel: "QA Engineer", experience: { slug: "qa", xp: 900, level: { level: 3, title: "Adept", progress: 0.5 }, signals: { runsCompleted: 11, totalTokens: 1000, activeDays: 2, skillsEnabled: 4, toolsetCount: 2, memoryFacts: 0 } } }] } } };
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Runs completed"); expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull(); expectOnlyReads(net.fetch);
  });
});
