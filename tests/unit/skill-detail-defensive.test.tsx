/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";

// Mock useParams to simulate various path shapes the catch-all route
// can produce. Mirrors Next.js's actual return shape for [...path] routes
// (string[] | string | undefined, depending on the URL encoding).
const mockUseParams = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/agent/skills",
  useSearchParams: () => new URLSearchParams(),
  notFound: jest.fn(),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/layout/PageHeader", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/ui/LoadingSpinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading</div>,
}));

import SkillDetailPage from "@/app/agent/skills/[...path]/page";

beforeEach(() => {
  mockUseParams.mockReset();
  mockApiFetch.mockReset();
});

describe("SkillDetailPage — defensive path handling", () => {
  it("renders the in-page 'Skill Not Found' state (not the error boundary) when params.path is a single string containing a slash", async () => {
    // URL-encoded slash in the URL lands here as a single string with
    // a literal slash inside. Pre-fix this crashed the render with
    // 'Something went wrong' (the global error boundary).
    mockUseParams.mockReturnValue({ path: "software-development/patterstage" });

    render(<SkillDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Skill Not Found")).toBeInTheDocument();
    });
    // We should NOT have called the API for a malformed path.
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Invalid skill path/)
    ).toBeInTheDocument();
  });

  it("renders the in-page 'Skill Not Found' state when params.path is undefined", async () => {
    mockUseParams.mockReturnValue({});

    render(<SkillDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Skill Not Found")).toBeInTheDocument();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("renders the in-page 'Skill Not Found' state when params.path is an array with empty segments", async () => {
    mockUseParams.mockReturnValue({ path: ["valid", "", "another"] });

    render(<SkillDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Skill Not Found")).toBeInTheDocument();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("renders the loading state initially for a well-formed path", () => {
    mockUseParams.mockReturnValue({ path: ["software-development", "patterstage"] });
    // Return a never-resolving promise so we stay in the loading state.
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    render(<SkillDetailPage />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });
});
