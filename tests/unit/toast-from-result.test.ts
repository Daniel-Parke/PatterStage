// Unit tests for the toastFromResult helper
// (src/lib/dashboard/toast-from-result.ts)
//
// Locks the showToast contract:
//   - success branch uses default tone (no second arg)
//   - failure branch uses "error" tone
//   - uses result.error when present, else the fallback

import { toastFromResult } from "@/lib/dashboard/toast-from-result";

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

  it("accepts a function for successMsg and calls it on the success path", () => {
    // Function form: handlers with mode-dependent success messages
    // (e.g. dispatch mode → different toast per mode) pass a thunk so
    // the message-construction cost is paid only on the success path.
    const successFn = jest.fn(() => "Mission dispatched");
    toastFromResult(
      showToast,
      { ok: true },
      successFn,
      "Failed to dispatch",
    );
    expect(successFn).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Mission dispatched");
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("does NOT call the successMsg function when result.ok is false", () => {
    // The lazy-eval contract: a thunk on the failure path means the
    // message-construction cost is paid zero times, not once. This
    // matters for thunks that allocate an interpolated string with
    // several template substitutions.
    const successFn = jest.fn(() => "should not be called");
    toastFromResult(
      showToast,
      { ok: false, error: "Server said no" },
      successFn,
      "Failed",
    );
    expect(successFn).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Server said no", "error");
  });
});
