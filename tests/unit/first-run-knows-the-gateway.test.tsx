/**
 * @jest-environment jsdom
 */

// T-0092, finding D from this device's browser pass: "Hermes is not installed
// on this machine, nothing will actually run" was shown while a gateway was
// configured, answering, and running missions fine. The install is remote;
// the sentence has to say so.

import { render } from "@testing-library/react";
import { firstRunSteps, shouldShowFirstRun, type FirstRunFacts } from "@/lib/dashboard/first-run-steps";
import FirstRunPanel from "@/components/dashboard/FirstRunPanel";

const remote: FirstRunFacts = {
  frameworkName: "Hermes",
  frameworkAvailable: false,
  gatewayReachable: true,
  gatewayUrl: "http://192.168.1.50:8642",
  sessionCount: 0,
  missionCount: 0,
};

describe("a reachable gateway with no local install", () => {
  it("the agent step is done, and says where the work runs", () => {
    const agent = firstRunSteps(remote).find((s) => s.id === "agent")!;

    expect(agent.done).toBe(true);
    expect(agent.title).toMatch(/gateway/i);
    expect(agent.detail).toContain("http://192.168.1.50:8642");
    expect(agent.detail).toMatch(/missions will run there/i);
  });

  it("the panel headline names the gateway instead of saying nothing will run", () => {
    const { container } = render(<FirstRunPanel facts={remote} />);

    expect(container.textContent).toContain("http://192.168.1.50:8642");
    expect(container.textContent).not.toMatch(/nothing will actually run/i);
    expect(container.textContent).not.toMatch(/not installed on this machine yet\.$/m);
  });

  it("still shows the checklist until something has run", () => {
    expect(shouldShowFirstRun(remote)).toBe(true);
    expect(shouldShowFirstRun({ ...remote, missionCount: 1 })).toBe(false);
  });

  it("GREEN CONTROL: no local install and no gateway still leads with installing", () => {
    const agent = firstRunSteps({ ...remote, gatewayReachable: false, gatewayUrl: null }).find((s) => s.id === "agent")!;

    expect(agent.done).toBe(false);
    expect(agent.title).toMatch(/Install Hermes/);
  });
});
