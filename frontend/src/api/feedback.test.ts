import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestApi } from "./client";
import { createBetaFeedback } from "./feedback";

vi.mock("./client", () => ({
  requestApi: vi.fn(),
}));

const requestApiMock = vi.mocked(requestApi);

describe("feedback api", () => {
  beforeEach(() => {
    requestApiMock.mockReset();
  });

  it("sends beta feedback through the shared API client", async () => {
    const headers = { Authorization: "Bearer token" };
    const response = {
      id: 1,
      category: "confusing",
      priority: "normal",
      status: "open",
      message: "Nao entendi o resumo.",
      path: "/#resultado",
      resolved_at: null,
      created_at: "2026-09-26T12:00:00Z",
    };
    requestApiMock.mockResolvedValue(response);

    await expect(
      createBetaFeedback(headers, {
        category: "confusing",
        message: "Nao entendi o resumo.",
        path: "/#resultado",
      }),
    ).resolves.toBe(response);

    expect(requestApiMock).toHaveBeenCalledWith("/feedback", {
      method: "POST",
      headers,
      body: JSON.stringify({
        category: "confusing",
        message: "Nao entendi o resumo.",
        path: "/#resultado",
      }),
    });
  });
});
