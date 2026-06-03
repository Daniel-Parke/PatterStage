// Unit tests for the toastFromResult helper
// (src/lib/toast-from-result.ts)
//
// Locks the showToast contract:
//   - success branch uses default tone (no second arg)
//   - failure branch uses "error" tone
//   - uses result.error when present, else the fallback

import { toastFromResult } from "@/lib/toast-from-result";

describe("toastFromResult", () => {
  let showToast: jest.Mock;

  beforeEach(() => {
    showToast = jest.fn();
  });

  it("shows the success message with no tone when result.ok is true", () => {
    toastFromResult(showToast, { ok: true }, "Saved", "Failed to save");
    expect(showToast).toHaveBeenCalledWith("Saved");
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("shows the success message when ok is true even if error is set", () => {
    // Defensive: ok overrides error
    toastFromResult(
      showToast,
      { ok: true, error: "ignored" },
      "Saved",
      "Failed",
    );
    expect(showToast).toHaveBeenCalledWith("Saved");
  });

  it("shows the server error with the error tone when ok is false and error is present", () => {
    toastFromResult(
      showToast,
      { ok: false, error: "Server said no" },
      "Saved",
      "Failed to save",
    );
    expect(showToast).toHaveBeenCalledWith("Server said no", "error");
  });

  it("shows the fallback error with the error tone when ok is false and error is missing", () => {
    toastFromResult(showToast, { ok: false }, "Saved", "Failed to save");
    expect(showToast).toHaveBeenCalledWith("Failed to save", "error");
  });

  it("shows the fallback when ok is false and error is null", () => {
    toastFromResult(
      showToast,
      { ok: false, error: null },
      "Saved",
      "Failed to save",
    );
    expect(showToast).toHaveBeenCalledWith("Failed to save", "error");
  });

  it("shows the empty error string verbatim (?? is null/undefined only)", () => {
    // Documented behaviour: the `??` operator only fires on null/undefined,
    // not on empty string. Empty error means the caller has nothing useful
    // to show — same as the pre-refactor inline form.
    toastFromResult(
      showToast,
      { ok: false, error: "" },
      "Saved",
      "Failed to save",
    );
    expect(showToast).toHaveBeenCalledWith("", "error");
  });
});
