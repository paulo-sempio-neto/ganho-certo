import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBillingCheckout } from "./billing";
import { requestApi } from "./client";

vi.mock("./client", () => ({
  requestApi: vi.fn(),
}));

const requestApiMock = vi.mocked(requestApi);

describe("billing api", () => {
  beforeEach(() => {
    requestApiMock.mockReset();
  });

  it("creates a Mercado Pago checkout through the shared API client", async () => {
    const headers = { Authorization: "Bearer token" };
    const response = {
      provider: "mercado_pago",
      checkout_id: "preapproval_123",
      checkout_url: "https://www.mercadopago.com.br/subscriptions/checkout?id=123",
    };
    requestApiMock.mockResolvedValue(response);

    await expect(createBillingCheckout(headers)).resolves.toBe(response);

    expect(requestApiMock).toHaveBeenCalledWith("/billing/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify({ plan_code: "pro" }),
    });
  });
});
