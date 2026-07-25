/**
 * Regression tests for the zod-schema narrowing refactor (session 53).
 *
 * Before session 53, `providerSchema` and `taskTypeSchema` were defined
 * as `z.enum(HERMES_PROVIDERS as readonly [string, ...string[]])` and
 * `z.enum(TASK_TYPES as readonly [string, ...string[]])`. The widening
 * cast forced 3+ call sites to write `as HermesProvider` / `as TaskType`
 * when consuming `parsed.data`.
 *
 * After session 53, the cast is removed and zod v4 narrows the parsed
 * type to the literal union. These tests lock the runtime behaviour
 * (every value in the canonical list passes, every other string is
 * rejected) so a future "let me widen it back to `string`" PR is
 * caught at the schema level.
 *
 * The TypeScript-level narrowing is verified by tsc itself: the
 * `providerSchema` and `taskTypeSchema` exports are now inferred as
 * the literal unions and the route handlers (`credentials/route.ts`,
 * `models/defaults/route.ts`) consume them without an `as` cast.
 */
import {
  providerSchema,
  taskTypeSchema,
  credentialPostSchema,
  setDefaultPutSchema,
} from "@/lib/api-schemas";
import { HERMES_PROVIDERS } from "@/modules/hermes/lib/providers";
import { TASK_TYPES } from "@/lib/models/task-types";

describe("providerSchema narrows parsed type to HermesProvider (session 53)", () => {
  it("accepts every value in the canonical HERMES_PROVIDERS list", () => {
    for (const provider of HERMES_PROVIDERS) {
      const result = providerSchema.safeParse(provider);
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown provider string", () => {
    const result = providerSchema.safeParse("not-a-real-provider");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = providerSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects a similar-but-wrong provider (typo resistance)", () => {
    // 'anthropicc' is not in the list — schema must reject it.
    const result = providerSchema.safeParse("anthropicc");
    expect(result.success).toBe(false);
  });
});

describe("taskTypeSchema narrows parsed type to TaskType (session 53)", () => {
  it("accepts every value in the canonical TASK_TYPES list", () => {
    for (const taskType of TASK_TYPES) {
      const result = taskTypeSchema.safeParse(taskType);
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown task-type string", () => {
    const result = taskTypeSchema.safeParse("not-a-real-task");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = taskTypeSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("credentialPostSchema end-to-end (validates narrowing flows through)", () => {
  it("accepts a valid credential payload", () => {
    const result = credentialPostSchema.safeParse({
      label: "Test",
      provider: "anthropic",
      apiKey: "sk-test-1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown provider at the top-level schema too", () => {
    const result = credentialPostSchema.safeParse({
      label: "Test",
      provider: "fake-provider",
      apiKey: "sk-test-1234",
    });
    expect(result.success).toBe(false);
  });
});

describe("setDefaultPutSchema end-to-end (validates narrowing flows through)", () => {
  it("accepts each taskType with a modelId", () => {
    for (const taskType of TASK_TYPES) {
      const result = setDefaultPutSchema.safeParse({ taskType, modelId: "test-model" });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown taskType at the top-level schema too", () => {
    const result = setDefaultPutSchema.safeParse({ taskType: "made-up-slot", modelId: "x" });
    expect(result.success).toBe(false);
  });
});
