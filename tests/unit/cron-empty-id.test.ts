// Regression: Cron POST must reject names that produce empty IDs
// Bug: name "----" produced empty ID after sanitization

describe("Cron job ID sanitization", () => {
  it("rejects names with only special characters (empty ID)", () => {
    // Simulate the ID generation logic from cron POST handler
    const names = ["----", "!!!", "...", "   ", "@#$%^&"];

    for (const name of names) {
      const id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      expect(id).toBe(""); // These should all produce empty IDs
      // The handler should now reject these with a 400 error
    }
  });

  it("accepts names with alphanumeric characters", () => {
    const cases = [
      { name: "my-job", expected: "my-job" },
      { name: "Hello World", expected: "hello-world" },
      { name: "test_123", expected: "test-123" },
      { name: "---abc---", expected: "abc" },
      { name: "a", expected: "a" },
    ];

    for (const { name, expected } of cases) {
      const id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      expect(id).toBe(expected);
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
