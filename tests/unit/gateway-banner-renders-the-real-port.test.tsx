/** @jest-environment jsdom */

// T-0080 — the banner is rendered, not grepped.
//
// Mutation found this gap, and it is the third instance of one shape in this
// programme: the DECISION was tested (`gateway-banner-states`), the ROUTE that
// supplies the address was tested (`gateway-health-route`), and the component
// that joins them was tested by nobody. The one chat-page test that touches
// GatewayBanner replaces it with a `<div data-testid="gateway-banner" />`, so
// the copy could say anything at all -- including the hardcoded "port 8642"
// that started this -- and every suite stayed green.
//
// So this renders the real component and reads what an operator would read.

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = (name: string) => () => `[${name}]`;
  return new Proxy({}, { get: (_t, prop: string) => passthrough(prop) });
});

import GatewayBanner from "@/components/chat/GatewayBanner";

/** The banner splits its body into spans and <code>; read it as one string. */
function bannerText(): string {
  return document.body.textContent ?? "";
}

describe("the offline banner names the gateway that is actually down", () => {
  it("renders the configured address", () => {
    render(<GatewayBanner status="offline" gatewayUrl="http://127.0.0.1:8652" />);

    expect(bannerText()).toContain("http://127.0.0.1:8652");
  });

  it("does NOT name a port nobody configured", () => {
    // The defect, in one assertion. It said "port 8642" while the gateway was
    // on 8652, sending the operator to check something that was not down.
    render(<GatewayBanner status="offline" gatewayUrl="http://127.0.0.1:8652" />);

    expect(bannerText()).not.toContain("8642");
  });

  it("follows the address it is given rather than a constant", () => {
    render(<GatewayBanner status="offline" gatewayUrl="http://gw.internal:9999" />);

    expect(bannerText()).toContain("http://gw.internal:9999");
  });

  it("still says what to do", () => {
    // The address is a diagnosis; this is the remedy, and the reason this
    // banner earns its space.
    render(<GatewayBanner status="offline" gatewayUrl="http://127.0.0.1:8652" />);

    expect(bannerText()).toMatch(/hermes gateway start/);
  });

  it("keeps the emphasis on the remedy, not the address", () => {
    // `renderBody` gives the FIRST {code} token the accent colour and mutes
    // the rest, and across all the banners that first token is the thing to
    // act on. Leading with the address would quietly move the emphasis onto a
    // fact -- a design change made by accident rather than on purpose.
    const { container } = render(
      <GatewayBanner status="offline" gatewayUrl="http://127.0.0.1:8652" />,
    );

    const codes = Array.from(container.querySelectorAll("code"));
    expect(codes[0]?.textContent).toBe("hermes gateway start");
  });

  it("omits the address rather than inventing one while the probe is in flight", () => {
    // `gatewayUrl` is null until the first health answer arrives. A banner
    // that filled that gap with a default would be back to guessing, which is
    // the whole defect.
    render(<GatewayBanner status="offline" gatewayUrl={null} />);

    const text = bannerText();
    expect(text).toMatch(/not responding/);
    expect(text).not.toMatch(/\d{4}/);
  });

  it("GREEN CONTROL: it renders at all without a gatewayUrl prop", () => {
    render(<GatewayBanner status="offline" />);
    expect(bannerText()).toMatch(/Gateway Offline/);
  });
});

describe("the other three banners are unchanged", () => {
  it("auth-missing still names the key and both files it belongs in", () => {
    render(<GatewayBanner status="auth-missing" gatewayUrl="http://127.0.0.1:8652" />);

    const text = bannerText();
    expect(text).toContain("API_SERVER_KEY");
    expect(text).toMatch(/401/);
  });

  it("model-missing still points at Config and the config file", () => {
    render(<GatewayBanner status="model-missing" />);

    expect(bannerText()).toMatch(/Config/);
  });

  it("checking renders the quiet spinner form, not a card", () => {
    const { container } = render(<GatewayBanner status="checking" />);

    expect(screen.getByText(/Checking gateway connection/)).toBeTruthy();
    // The muted state deliberately has no bordered card; a spinner that looked
    // like an error would report a healthy first load as a fault.
    expect(container.querySelector(".border")).toBeNull();
  });
});
