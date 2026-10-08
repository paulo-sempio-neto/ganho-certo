/** Keep one current request per resource; callers guard state writes with isCurrent. */
export function createLatestRequest() {
  let activeRequest: {
    key: string;
    token: symbol;
    promise: Promise<void>;
  } | null = null;

  return {
    run(key: string, task: (isCurrent: () => boolean) => Promise<void>): Promise<void> {
      if (activeRequest?.key === key) {
        return activeRequest.promise;
      }

      const token = Symbol();
      const isCurrent = () => activeRequest?.token === token;
      const promise = Promise.resolve()
        .then(() => task(isCurrent))
        .finally(() => {
          if (isCurrent()) {
            activeRequest = null;
          }
        });

      activeRequest = { key, token, promise };
      return promise;
    },
    invalidate() {
      activeRequest = null;
    },
  };
}
