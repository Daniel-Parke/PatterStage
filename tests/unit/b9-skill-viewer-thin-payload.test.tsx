/** @jest-environment jsdom */

/**
 * B9 oracle, the skill viewer's render (T-0103, D81).
 *
 * The sweep asked for this one: the route answers a thinner payload for a
 * skill the catalogue holds and the disk does not, and nothing rendered that
 * payload, so a page that reaches straight into `frontmatter` and
 * `linkedFiles` walked through every other case.
 */

import { render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/skills/writing",
  useParams: () => ({ path: ["writing"] }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));

import SkillDetailPage from "@/app/agent/skills/[...path]/page";

beforeEach(() => jest.clearAllMocks());

describe("a skill that is in the catalogue and not on disk", () => {
  /** Exactly what the route sends for that case: no frontmatter keys with
   *  values, no linked files, no mtime, and a source that says why. */
  const THIN = {
    data: {
      name: "writing",
      path: "writing",
      source: "catalog",
      frontmatter: { name: "writing", description: "Prose that lands", category: "creative" },
      content: "# Writing\n\nBe brief.\n",
      rawContent: "# Writing\n\nBe brief.\n",
      size: 24,
      lastModified: "2026-09-05T09:00:00.000Z",
      linkedFiles: [],
    },
  };

  it("renders, and says where it came from", async () => {
    mockApiFetch.mockResolvedValue(THIN);

    render(<SkillDetailPage />);

    await waitFor(() => expect(screen.getByText(/Be brief\./)).toBeInTheDocument());
    expect(screen.queryByText("Skill Not Found")).toBeNull();
    expect(screen.getByText(/in the catalogue, not yet on disk/i)).toBeInTheDocument();
  });

  it("renders a payload carrying none of the optional halves at all", async () => {
    // The thinnest thing the page could ever be handed: a name and a body.
    mockApiFetch.mockResolvedValue({
      data: { name: "writing", path: "writing", content: "# Writing\n\nBe brief.\n" },
    });

    render(<SkillDetailPage />);

    await waitFor(() => expect(screen.getByText(/Be brief\./)).toBeInTheDocument());
    expect(screen.queryByText("Skill Not Found")).toBeNull();
    // No Metadata card and no Linked Files card, rather than a thrown render.
    expect(screen.queryByText("Metadata")).toBeNull();
    expect(screen.queryByText("Linked Files")).toBeNull();
  });

  it("GREEN CONTROL: the full payload still shows its metadata and its files", async () => {
    mockApiFetch.mockResolvedValue({
      data: {
        ...THIN.data,
        source: "disk",
        linkedFiles: [{ name: "checklist.md", path: "references/checklist.md", size: 512 }],
      },
    });

    render(<SkillDetailPage />);

    await waitFor(() => expect(screen.getByText("Metadata")).toBeInTheDocument());
    expect(screen.getByText("Linked Files")).toBeInTheDocument();
    expect(screen.getByText("checklist.md")).toBeInTheDocument();
    expect(screen.queryByText(/not yet on disk/i)).toBeNull();
  });
});
