import { describe, expect, it } from "vitest";

import { isRestoringSession } from "./session";

const restoring = { token: "jwt", hasUser: false, hasError: false, isResetPasswordRoute: false };

describe("isRestoringSession", () => {
  it("waits for the user while a stored token is being checked", () => {
    expect(isRestoringSession(restoring)).toBe(true);
  });

  it.each([
    ["there is no token", { token: null }],
    ["the user has loaded", { hasUser: true }],
    ["the check failed with a message", { hasError: true }],
    ["the reset-password link is open", { isResetPasswordRoute: true }],
  ])("stops when %s", (_, change) => {
    expect(isRestoringSession({ ...restoring, ...change })).toBe(false);
  });
});
