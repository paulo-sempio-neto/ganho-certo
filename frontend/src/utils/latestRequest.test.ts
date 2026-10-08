import { describe, expect, it, vi } from "vitest";

import { createLatestRequest } from "./latestRequest";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("latest request", () => {
  it("returns the same pending promise and starts a repeated key only once", async () => {
    const requests = createLatestRequest();
    const response = deferred();
    const task = vi.fn(async (isCurrent: () => boolean) => {
      expect(isCurrent()).toBe(true);
      await response.promise;
    });

    const first = requests.run("today", task);
    const duplicate = requests.run("today", task);

    expect(duplicate).toBe(first);
    expect(task).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);

    response.resolve();
    await first;
  });

  it("lets only the newest filter response update data", async () => {
    const requests = createLatestRequest();
    const oldResponse = deferred<string>();
    const newResponse = deferred<string>();
    const values: string[] = [];
    const oldRequest = requests.run("old-filter", async (isCurrent) => {
      const value = await oldResponse.promise;
      if (isCurrent()) values.push(value);
    });
    const newRequest = requests.run("new-filter", async (isCurrent) => {
      const value = await newResponse.promise;
      if (isCurrent()) values.push(value);
    });

    newResponse.resolve("new");
    await newRequest;
    oldResponse.resolve("old");
    await oldRequest;

    expect(values).toEqual(["new"]);
  });

  it("lets only the newest filter error update the error state", async () => {
    const requests = createLatestRequest();
    const oldResponse = deferred();
    const newResponse = deferred();
    const errors: string[] = [];
    const task = (response: Promise<void>, label: string) => async (isCurrent: () => boolean) => {
      try {
        await response;
      } catch {
        if (isCurrent()) errors.push(label);
      }
    };
    const oldRequest = requests.run("old-filter", task(oldResponse.promise, "old-error"));
    const newRequest = requests.run("new-filter", task(newResponse.promise, "new-error"));

    oldResponse.reject(new Error("old"));
    await oldRequest;
    newResponse.reject(new Error("new"));
    await newRequest;

    expect(errors).toEqual(["new-error"]);
  });

  it("invalidates pending writes and allows a refresh with the same key", async () => {
    const requests = createLatestRequest();
    const oldResponse = deferred();
    const newResponse = deferred();
    const accepted: string[] = [];
    const oldRequest = requests.run("today", async (isCurrent) => {
      await oldResponse.promise;
      if (isCurrent()) accepted.push("old");
    });
    requests.invalidate();
    const newRequest = requests.run("today", async (isCurrent) => {
      await newResponse.promise;
      if (isCurrent()) accepted.push("new");
    });

    expect(newRequest).not.toBe(oldRequest);
    oldResponse.resolve();
    await oldRequest;
    newResponse.resolve();
    await newRequest;

    expect(accepted).toEqual(["new"]);
  });

  it("does not let an old finally clear a newer request or its loading state", async () => {
    const requests = createLatestRequest();
    const oldResponse = deferred();
    const newResponse = deferred();
    let loading = true;
    const task = (response: Promise<void>) => async (isCurrent: () => boolean) => {
      try {
        await response;
      } finally {
        if (isCurrent()) loading = false;
      }
    };
    const oldRequest = requests.run("old-filter", task(oldResponse.promise));
    const newTask = vi.fn(task(newResponse.promise));
    const newRequest = requests.run("new-filter", newTask);

    oldResponse.resolve();
    await oldRequest;
    expect(loading).toBe(true);
    expect(requests.run("new-filter", newTask)).toBe(newRequest);
    expect(newTask).toHaveBeenCalledTimes(1);

    newResponse.resolve();
    await newRequest;
    expect(loading).toBe(false);
  });

  it("allows the same key to load again after success", async () => {
    const requests = createLatestRequest();
    const task = vi.fn(async () => {});
    const first = requests.run("today", task);
    await first;
    const second = requests.run("today", task);
    await second;

    expect(second).not.toBe(first);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("releases failed requests so the same key can be retried", async () => {
    const requests = createLatestRequest();
    const task = vi.fn(() => {
      throw new Error("request failed");
    });
    const first = requests.run("today", task);
    await expect(first).rejects.toThrow("request failed");
    const second = requests.run("today", task);
    await expect(second).rejects.toThrow("request failed");

    expect(second).not.toBe(first);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
