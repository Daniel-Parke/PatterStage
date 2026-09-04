/**
 * @jest-environment jsdom
 */

// T-0089, ruling 1: round 6, finding 17. The Personalities page carried a
// "Set as active" control with an ACTIVE badge, an active-first sort, a stat
// tile and a success toast, and persisted `display.personality` to
// config.yaml, which nothing in PatterStage reads. A control that changes
// nothing is a lie with a button. Removed.

import { render, waitFor } from "@testing-library/react";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  toastError: jest.fn(),
  safeApiCall: jest.fn(),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: jest.fn(), toasts: [], lastResult: null, dismiss: jest.fn() }),
  LastResult: () => null,
}));

import PersonalitiesPage from "@/app/operations/personalities/page";

beforeEach(() => {
  jest.clearAllMocks();
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/personalities")) {
      return { data: { personalities: [
        { name: "Calm", prompt: "Speak softly and carry a checklist." },
        { name: "Brisk", prompt: "Short sentences. Move on." },
      ] } };
    }
    return { data: {} };
  });
});

it("renders the personalities with no activate control, badge or banner", async () => {
  const { container } = render(<PersonalitiesPage />);

  await waitFor(() => expect(container.textContent).toContain("Calm"));

  expect(container.querySelector('[title="Set as active"]')).toBeNull();
  expect(container.textContent).not.toMatch(/\bACTIVE\b/);
  expect(container.textContent).not.toMatch(/Active:/);
});

it("does not read the config for an active personality it can no longer set", async () => {
  const { container } = render(<PersonalitiesPage />);
  await waitFor(() => expect(container.textContent).toContain("Brisk"));

  const urls = mockApiFetch.mock.calls.map((c) => String(c[0]));
  expect(urls.some((u) => u.startsWith("/api/config"))).toBe(false);
});
