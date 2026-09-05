/** @jest-environment node */

// Tests the secret-masking helpers in src/lib/secret-mask.ts.
// Both /api/config (model.api_key + auxiliary.<task>.api_key) and
// /api/models/import (credential keyHint) use these primitives.

import {
  maskApiKey,
  maskKeyHint,
  maskEnvValue,
  maskEnvFileContent,
  isFullyMaskedEnvName,
} from "@/lib/secret-mask";

describe("maskEnvFileContent", () => {
  // Regression: GET /api/agent/files/env used to return the raw ~/.hermes/.env
  // to any caller. Masking existed only in a React component, so anything that
  // called the API instead of loading the page got every key in plaintext.
  it("masks values while preserving structure", () => {
    const raw = [
      "# keys",
      "",
      "OPENAI_API_KEY=sk-verylongsecretvalue1234",
      'DISCORD_TOKEN="tok-abcdefghijklmnop"',
      "HERMES_PASSWORD=hunter2hunter2",
      "PORT=42069",
    ].join("\n");

    const masked = maskEnvFileContent(raw);

    expect(masked).not.toContain("verylongsecretvalue");
    expect(masked).not.toContain("abcdefghijklmnop");
    expect(masked).not.toContain("hunter2hunter2");
    expect(masked).toContain("# keys");
    expect(masked).toContain("OPENAI_API_KEY=sk-v...1234");
    // password/token names are fully hidden — no first4/last4 hint at all
    expect(masked).toContain("HERMES_PASSWORD=••••••••");
    expect(masked).toContain("DISCORD_TOKEN=••••••••");
    expect(masked.split("\n")).toHaveLength(6);
  });

  it("leaves comments, blanks and non-assignments alone", () => {
    expect(maskEnvFileContent("# just a comment")).toBe("# just a comment");
    expect(maskEnvFileContent("")).toBe("");
    expect(maskEnvFileContent("NOT_AN_ASSIGNMENT")).toBe("NOT_AN_ASSIGNMENT");
  });
});

describe("maskApiKey", () => {
  it("masks long keys as first 4 + •••• + last 4", () => {
    expect(maskApiKey("sk-abc...1234")).toBe("sk-a••••1234");
  });

  it("returns bare •••• for short keys (<= 8 chars)", () => {
    expect(maskApiKey("short")).toBe("••••");
    expect(maskApiKey("12345678")).toBe("••••");
  });

  it("uses •••• fallback at exactly the threshold (length === 8)", () => {
    // length > 8 is the gate, so 8-char keys fall through to ••••
    expect(maskApiKey("12345678")).toBe("••••");
  });

  it("masks 9-char keys (just over threshold)", () => {
    expect(maskApiKey("123456789")).toBe("1234••••6789");
  });

  it("handles unicode keys (BMP chars count as 1 code unit, supplementary as 2)", () => {
    // Each 🔑 is 2 UTF-16 code units (it's a supplementary-plane char).
    // 9 emojis = 18 code units, well above the >8 threshold.
    expect(maskApiKey("🔑🔑🔑🔑🔑🔑🔑🔑🔑")).toBe("🔑🔑••••🔑🔑");
  });

  it("preserves an empty string as •••• (the >0 check is upstream)", () => {
    // The route only masks when length > 0; the helper itself returns •••• for empty.
    expect(maskApiKey("")).toBe("••••");
  });
});

describe("maskKeyHint", () => {
  it("masks long keys with literal '...' separator (used in import preview)", () => {
    expect(maskKeyHint("sk-abc...1234")).toBe("sk-a...1234");
  });

  it("returns bare •••• for short keys (<= 8 chars)", () => {
    expect(maskKeyHint("short")).toBe("••••");
  });

  it("masks 9-char keys with '...'", () => {
    expect(maskKeyHint("123456789")).toBe("1234...6789");
  });
});

describe("maskEnvValue — password/secret names are fully hidden", () => {
  it("fully masks passwords, secrets, tokens, and private keys (no first/last hint)", () => {
    expect(maskEnvValue("SUDO_PASSWORD", "hunter2hunter2")).toBe("••••••••");
    expect(maskEnvValue("DB_PASS", "supersecretpw")).toBe("••••••••");
    expect(maskEnvValue("CLIENT_SECRET", "abcdef123456")).toBe("••••••••");
    expect(maskEnvValue("GITHUB_TOKEN", "ghp_abcdef123456")).toBe("••••••••");
    expect(maskEnvValue("SSH_PRIVATE_KEY", "-----BEGIN KEY-----xyz")).toBe("••••••••");
  });

  it("keeps the first4…last4 hint for API keys and other non-secret names", () => {
    expect(maskEnvValue("OPENAI_API_KEY", "sk-abcdef1234")).toBe("sk-a...1234");
    expect(maskEnvValue("HERMES_BASE_URL", "abcdefghijkl")).toBe("abcd...ijkl");
  });

  it("classifies sensitive names case-insensitively", () => {
    expect(isFullyMaskedEnvName("sudo_password")).toBe(true);
    expect(isFullyMaskedEnvName("PassPhrase")).toBe(true);
    expect(isFullyMaskedEnvName("OPENAI_API_KEY")).toBe(false);
  });

  it("returns empty string for an empty value", () => {
    expect(maskEnvValue("SUDO_PASSWORD", "")).toBe("");
  });
});
