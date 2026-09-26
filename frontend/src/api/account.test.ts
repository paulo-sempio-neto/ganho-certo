import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestApi } from "./client";
import { getAccountPlan } from "./account";

vi.mock("./client", () => ({
  requestApi: vi.fn(),
}));

const requestApiMock = vi.mocked(requestApi);

describe("account api", () => {
  beforeEach(() => {
    requestApiMock.mockReset();
  });

  it("loads the current account plan through the shared API client", async () => {
    const headers = { Authorization: "Bearer token" };
    const response = {
      current_plan: { id: 1, name: "Free", code: "free" },
      features: { csv_import: false },
      limits: { vehicle_limit: 1 },
    };
    requestApiMock.mockResolvedValue(response);

    await expect(getAccountPlan(headers)).resolves.toBe(response);

    expect(requestApiMock).toHaveBeenCalledWith("/account/plan", { headers });
  });
});
