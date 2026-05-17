import {
  categorizeLogFileGroup,
  compareLogFileNames,
  sanitizeLogBasename,
} from "@/lib/log-files";

describe("sanitizeLogBasename", () => {
  it("accepts letters digits dot underscore hyphen", () => {
    expect(sanitizeLogBasename("ch-health")).toBe("ch-health");
    expect(sanitizeLogBasename("agent2")).toBe("agent2");
    expect(sanitizeLogBasename("my.log.file")).toBe("my.log.file");
  });

  it("strips optional .log suffix", () => {
    expect(sanitizeLogBasename("agent.log")).toBe("agent");
  });

  it("rejects path traversal and slashes", () => {
    expect(sanitizeLogBasename("../etc/passwd")).toBeNull();
    expect(sanitizeLogBasename("a/b")).toBeNull();
  });

  it("rejects empty and bad characters", () => {
    expect(sanitizeLogBasename("")).toBeNull();
    expect(sanitizeLogBasename("a b")).toBeNull();
    expect(sanitizeLogBasename("a;rm")).toBeNull();
  });
});

describe("categorizeLogFileGroup", () => {
  it("classifies core and hardware", () => {
    expect(categorizeLogFileGroup("agent")).toBe("core");
    expect(categorizeLogFileGroup("ch-watchdog")).toBe("system");
    expect(categorizeLogFileGroup("custom")).toBe("other");
  });
});

describe("compareLogFileNames", () => {
  it("orders agent before gateway before zzz", () => {
    const names = ["zzz", "agent", "gateway"].sort(compareLogFileNames);
    expect(names).toEqual(["agent", "gateway", "zzz"]);
  });
});
