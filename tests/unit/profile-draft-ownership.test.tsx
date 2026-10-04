/** @jest-environment jsdom */
// T-0193 independent ORACLE Faraday, 2026-10-04. Real forms, writes and selection.
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { jsonResponse } from "../helpers/fetch-map";
import ProfilesPage from "@/app/agent/profiles/page";
import EditProfileModal from "@/components/agents/EditProfileModal";
import { FeedbackContext } from "@/components/ui/feedback-context";
import { getSelectedProfile, setSelectedProfile } from "@/hooks/useSelectedProfile";
import type { AgentProfile } from "@/types/console";

jest.mock("next/navigation", () => ({ usePathname: () => "/agent/profiles" }));
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("@/components/agents/AgentGrowthPanel", () => ({ __esModule: true, default: () => null }));

type Kind = "create" | "edit";
type Write = { url: string; body: { name?: string; displayName?: string; description: string; cloneFrom?: string } };
const profile = (id: string, name: string): AgentProfile => ({
  id, name, description: `Original ${id}`, isDefault: id === "default", isBundled: false,
  personality: "technical", skillsCount: 0, toolsCount: 0, syncStatus: "synced", syncError: null,
  syncedAt: null, files: [],
});
const originalFetch = global.fetch;
let drain = async () => {};
beforeEach(() => { window.localStorage.clear(); setSelectedProfile("default"); });
afterEach(async () => { await drain(); cleanup(); global.fetch = originalFetch; window.localStorage.clear(); setSelectedProfile("default"); });

const dialog = () => screen.getByRole("dialog");
const button = (name: string) => within(dialog()).getByRole("button", { name });
function fill(name: string, description = "Later description") {
  fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), { target: { value: name } });
  fireEvent.change(within(dialog()).getByRole("textbox", { name: "Description" }), { target: { value: description } });
}
function cloneQA() {
  fireEvent.click(within(dialog()).getByRole("button", { name: "Clone from profile" }));
  fireEvent.click(screen.getByRole("option", { name: "QA Engineer" }));
}
function expectDraft(kind: Kind, name = "Later B") {
  expect(within(dialog()).getByRole("textbox", { name: "Name" })).toHaveValue(name);
  expect(within(dialog()).getByRole("textbox", { name: "Description" })).toHaveValue("Later description");
  expect(button(kind === "create" ? "Create" : "Save")).toBeEnabled();
}

async function mount(kind: Kind, root = false, holdRefresh = false) {
  const held = pendingLookup<Response>(), refresh = pendingLookup<Response>(), feedback = jest.fn();
  let rows = [profile("default", "Bob (local default)"), profile("qa", "QA Engineer")];
  let reads = 0, completed = false;
  const writes: Write[] = [];
  function persist(write: Write) {
    const name = write.body.name ?? write.body.displayName!;
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    if (write.url === "/api/agent/profiles") rows.push({ ...profile(slug, name), description: write.body.description });
    else rows = rows.map(row => row.id === write.url.split("/").pop() || write.url === "/api/agent/root" && row.isDefault
      ? { ...row, id: row.isDefault ? "default" : slug, name, description: write.body.description } : row);
    return jsonResponse({ data: { success: true, slug } });
  }
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" || init?.method === "PUT") {
      const write = { url, body: JSON.parse(String(init.body)) } as Write;
      writes.push(write);
      return writes.length === 1 ? held.promise : persist(write);
    }
    if (url === "/api/agent/profiles") {
      reads++;
      return holdRefresh && reads > 1 ? refresh.promise : jsonResponse({ data: { profiles: rows.map(row => ({ ...row })) } });
    }
    if (url === "/api/monitor") return jsonResponse({ data: { framework: { available: true } } });
    throw new Error(`Unmatched owned request: ${url}`);
  });
  setSelectedProfile(root ? "default" : "qa");
  const rendered = renderWithQuery(<FeedbackContext.Provider value={{ showToast: feedback }}><ProfilesPage /></FeedbackContext.Provider>);
  await screen.findByRole("button", { name: "Edit profile" });
  function open() { fireEvent.click(screen.getByRole("button", { name: kind === "create" ? "New Profile" : "Edit profile" })); }
  open();
  await screen.findByRole("dialog");
  async function complete(refused: boolean | "envelope" = false) {
    if (completed) return;
    completed = true;
    await act(async () => { held.complete(refused === "envelope" ? jsonResponse({ data: { success: false, error: "Owned refusal" } })
      : refused || !writes.length ? jsonResponse({ error: "Owned refusal" }, 500) : persist(writes[0])); });
  }
  async function releaseRefresh() { await act(async () => { refresh.complete(jsonResponse({ data: { profiles: rows.map(row => ({ ...row })) } })); }); }
  drain = async () => { await complete(true); await releaseRefresh(); };
  async function submit(duplicate = false) {
    fill("Submitted A", "Submitted description");
    const action = button(kind === "create" ? "Create" : "Save");
    act(() => { fireEvent.click(action); if (duplicate) fireEvent.click(action); });
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({ url: kind === "create" ? "/api/agent/profiles" : root ? "/api/agent/root" : "/api/agent/profiles/qa",
      body: kind === "create" ? { name: "Submitted A", description: "Submitted description", cloneFrom: "default" }
        : root ? { displayName: "Submitted A", description: "Submitted description" } : { name: "Submitted A", description: "Submitted description" } });
  }
  return { ...rendered, open, submit, complete, releaseRefresh, feedback, writes, reads: () => reads, rows: () => rows };
}

describe("T-0193 profile draft ownership", () => {
  for (const kind of ["create", "edit"] as const) {
    it(`${kind} ordinary success preserves current-owner and root/default semantics`, async () => {
      const h = await mount(kind, kind === "edit");
      if (kind === "create") {
        fill("Kept draft"); cloneQA(); fireEvent.click(button("Cancel")); h.open();
        expectDraft(kind, "Kept draft");
        expect(within(dialog()).getByRole("button", { name: "Clone from profile" })).toHaveTextContent("QA Engineer");
        fireEvent.click(button("Close dialog")); h.open();
        expect(within(dialog()).getByRole("textbox", { name: "Name" })).toHaveValue("");
        expect(within(dialog()).getByRole("textbox", { name: "Description" })).toHaveValue("");
        expect(within(dialog()).getByRole("button", { name: "Clone from profile" })).toHaveTextContent("Default (Bob)");
      } else expect(within(dialog()).getByRole("textbox", { name: "Name" })).toHaveValue("Bob");
      await h.submit(); await h.complete();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(h.reads()).toBeGreaterThan(1));
      expect(h.rows().some(row => row.name === "Submitted A")).toBe(true);
      h.open(); expect(button(kind === "create" ? "Create" : "Save")).not.toHaveTextContent(/Creating|Saving/);
    });

    it(`${kind} late success preserves close/reopen replacement B and selection`, async () => {
      const h = await mount(kind); await h.submit(true); fireEvent.click(button("Close dialog"));
      if (kind === "edit") fireEvent.click(screen.getByRole("button", { name: "Bob" }));
      h.open(); fill("Later B"); if (kind === "create") cloneQA();
      await h.complete(); await waitFor(() => expect(h.reads()).toBeGreaterThan(1));
      expectDraft(kind);
      expect(getSelectedProfile()).toBe(kind === "create" ? "qa" : "default");
      if (kind === "create") expect(within(dialog()).getByRole("button", { name: "Clone from profile" })).toHaveTextContent("QA Engineer");
      expect(h.writes).toHaveLength(1);
    });

    it(`${kind} success preserves fields edited during the pending save and permits the next write`, async () => {
      const h = await mount(kind); await h.submit(); fill("Later B");
      await h.complete(); await waitFor(() => expect(h.reads()).toBeGreaterThan(1));
      expectDraft(kind);
      fireEvent.click(button(kind === "create" ? "Create" : "Save"));
      await waitFor(() => expect(h.writes).toHaveLength(2));
      expect(h.writes[1]).toEqual({ url: kind === "create" ? "/api/agent/profiles" : "/api/agent/profiles/submitted-a",
        body: kind === "create" ? { name: "Later B", description: "Later description", cloneFrom: "default" }
          : { name: "Later B", description: "Later description" } });
    });

    it(`${kind} refusal preserves later fields and clears busy without success`, async () => {
      const h = await mount(kind); await h.submit(); fill("Later B"); await h.complete(true);
      await waitFor(() => expect(h.feedback).toHaveBeenCalledWith("Owned refusal", "error"));
      expectDraft(kind); expect(getSelectedProfile()).toBe("qa");
      expect(h.feedback.mock.calls.some(([, tone]) => tone === "success")).toBe(false);
      expect(h.rows().map(row => row.id)).toEqual(["default", "qa"]);
    });

    it(`${kind} 2xx success:false preserves draft and selection without success`, async () => {
      const h = await mount(kind); await h.submit(); fill("Later B");
      const selection = jest.spyOn(Storage.prototype, "setItem");
      try {
        await h.complete("envelope");
        await waitFor(() => expect(h.feedback).toHaveBeenCalledWith("Owned refusal", "error"));
        expectDraft(kind); expect(getSelectedProfile()).toBe("qa");
        expect(selection.mock.calls.filter(([key]) => key === "patterstage.selected-profile")).toEqual([]);
        expect(h.feedback.mock.calls.some(([, tone]) => tone === "success")).toBe(false);
        expect(h.rows().map(row => row.id)).toEqual(["default", "qa"]);
        expect(h.writes).toHaveLength(1);
      } finally { selection.mockRestore(); }
    });

    it(`${kind} unmount prevents late feedback, reload and selection mutation`, async () => {
      const h = await mount(kind); await h.submit(); h.unmount(); setSelectedProfile("default");
      const reads = h.reads(); await h.complete();
      expect(h.feedback).not.toHaveBeenCalled(); expect(h.reads()).toBe(reads); expect(getSelectedProfile()).toBe("default");
    });
  }

  for (const chooseBob of [false, true]) {
    it(`edit named rename with held refresh ${chooseBob ? "retains Bob chosen during reload" : "follows renamed selection without transient Bob fallback"}`, async () => {
      const h = await mount("edit", false, true); await h.submit();
      const selection = jest.spyOn(Storage.prototype, "setItem");
      try {
        await h.complete(); await waitFor(() => expect(h.reads()).toBeGreaterThan(1));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(["qa", "submitted-a"]).toContain(getSelectedProfile());
        expect(selection.mock.calls.filter(([key]) => key === "patterstage.selected-profile").map(([, value]) => value)).not.toContain("default");
        if (chooseBob) fireEvent.click(screen.getByRole("button", { name: "Bob" }));
        await h.releaseRefresh();
        await screen.findByRole("button", { name: "Submitted A" });
        expect(getSelectedProfile()).toBe(chooseBob ? "default" : "submitted-a");
        expect(screen.getByRole("heading", { level: 2, name: chooseBob ? "Bob (local default)" : "Submitted A" })).toBeInTheDocument();
        expect(h.writes).toHaveLength(1);
      } finally { selection.mockRestore(); }
    });
  }

  it("edit same-identity reopen retains B and follows A's persisted rename for the next PUT", async () => {
    const h = await mount("edit"); await h.submit(); fireEvent.click(button("Close dialog")); h.open(); fill("Later B");
    await h.complete(); await waitFor(() => expect(h.reads()).toBeGreaterThan(1));
    expectDraft("edit"); expect(getSelectedProfile()).toBe("submitted-a");
    fireEvent.click(button("Save")); await waitFor(() => expect(h.writes).toHaveLength(2));
    expect(h.writes[1].url).toBe("/api/agent/profiles/submitted-a");
    expect(h.writes[1].body).toEqual({ name: "Later B", description: "Later description" });
  });

  it("edit fresh same-ID object preserves dirty fields while explicit reopen reseeds", () => {
    const initial = profile("qa", "QA Engineer"), fresh = { ...initial, name: "Fresh server name", description: "Fresh server description" };
    const props = { open: true, profile: initial, saving: false, onClose: jest.fn(), onSave: jest.fn() };
    const h = renderWithQuery(<EditProfileModal {...props} />); fill("Later B");
    h.rerender(<EditProfileModal {...props} profile={fresh} />); expectDraft("edit");
    h.rerender(<EditProfileModal {...props} profile={fresh} open={false} />);
    h.rerender(<EditProfileModal {...props} profile={fresh} />);
    expect(within(dialog()).getByRole("textbox", { name: "Name" })).toHaveValue("Fresh server name");
    expect(within(dialog()).getByRole("textbox", { name: "Description" })).toHaveValue("Fresh server description");
  });
});
