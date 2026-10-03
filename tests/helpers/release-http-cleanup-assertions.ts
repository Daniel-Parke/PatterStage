type CleanupObservation = {
  ownedStopped: boolean;
  decoySurvived: boolean;
  signalsOwned: boolean;
  withinDeadline: boolean;
  elapsedSeconds: number;
  credentialLeaked: boolean;
  scriptContainsCredential: boolean;
};

export function assertHttpCleanup(result: CleanupObservation): void {
  expect(result.ownedStopped).toBe(true);
  expect(result.decoySurvived).toBe(true);
  expect(result.signalsOwned).toBe(true);
  expect(result.withinDeadline).toBe(true);
  expect(result.elapsedSeconds).toBeLessThan(25);
  expect(result.credentialLeaked).toBe(false);
  expect(result.scriptContainsCredential).toBe(false);
}
