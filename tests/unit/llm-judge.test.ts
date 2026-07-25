/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The independent grader, lifted out of the benchmark subsystem.
//
// The property worth pinning is the one the original got wrong: there is no
// judge-model fallback, so a model can never grade its own output by omission.
// score-judge.ts defaulted to getDefaultModel("agent"), which silently applied
// to 14 of the suite's items.
// ═══════════════════════════════════════════════════════════════

const mockCallLLM = jest.fn();
jest.mock("@/lib/llm", () => ({
  callLLM: (...a: unknown[]) => mockCallLLM(...a),
}));

import { judge, buildJudgePrompt, parseJudgeReply } from "@/lib/llm-judge";

const REQ = {
  task: "Summarise the changelog",
  criteria: "Mentions every breaking change",
  response: "It changes the auth header.",
  judgeModelId: "judge-model-1",
};

beforeEach(() => jest.clearAllMocks());

describe("judge", () => {
  it("grades with the caller's judge model, never a default", async () => {
    mockCallLLM.mockResolvedValue({ content: '{"score":0.8,"pass":true,"reason":"ok"}' });

    const v = await judge(REQ);

    expect(v).toEqual({ score: 0.8, passed: true, reason: "ok" });
    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ modelId: "judge-model-1", temperature: 0 }),
    );
  });

  it("throws rather than scoring zero when the reply is unparseable", async () => {
    // Unknown is not zero. Treating it as zero is how a working system gets
    // reported as broken.
    mockCallLLM.mockResolvedValue({ content: "I think it's pretty good, honestly." });
    await expect(judge(REQ)).rejects.toThrow(/no parseable score/);
  });

  it("grades the final answer, not the model's deliberation", async () => {
    mockCallLLM.mockResolvedValue({ content: '{"score":1}' });
    await judge({ ...REQ, response: "<think>maybe waffle</think>The auth header changed." });

    const prompt = mockCallLLM.mock.calls[0][0][0].content as string;
    expect(prompt).toContain("The auth header changed.");
    expect(prompt).not.toContain("maybe waffle");
  });

  it("short-circuits an empty response without calling the judge", async () => {
    const v = await judge({ ...REQ, response: "   " });
    expect(v).toEqual({ score: 0, passed: false, reason: "empty response" });
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it("derives pass from the threshold when the judge omits it", async () => {
    mockCallLLM.mockResolvedValue({ content: '{"score":0.6}' });
    expect((await judge(REQ)).passed).toBe(false);
    mockCallLLM.mockResolvedValue({ content: '{"score":0.6}' });
    expect((await judge({ ...REQ, passThreshold: 0.5 })).passed).toBe(true);
  });

  it("clamps an out-of-range score instead of trusting it", () => {
    expect(parseJudgeReply('{"score":7}')!.score).toBe(1);
    expect(parseJudgeReply('{"score":-3}')!.score).toBe(0);
    expect(parseJudgeReply('{"score":"high"}')).toBeNull();
  });

  it("reads a score out of a fenced code block", () => {
    expect(parseJudgeReply('```json\n{"score":0.5}\n```')!.score).toBe(0.5);
  });

  it("keeps the calibration anchors and the anti-verbosity penalty in the prompt", () => {
    // These are the reason the grader is worth lifting: without them two runs
    // score on different scales.
    const p = buildJudgePrompt(REQ);
    for (const anchor of ["1.00", "0.75", "0.50", "0.25", "0.00"]) expect(p).toContain(anchor);
    expect(p).toContain("Do NOT reward verbosity");
    expect(p).toContain("Penalise fabrication");
  });
});
