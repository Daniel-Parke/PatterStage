export function pendingLookup<T>() {
  let complete!: (value: T) => void;
  let fail!: (reason: Error) => void;
  const promise = new Promise<T>((fulfil, reject) => {
    complete = fulfil;
    fail = reject;
  });
  return { promise, complete, fail };
}
