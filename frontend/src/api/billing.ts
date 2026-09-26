import { requestApi } from "./client";

type AuthHeaders = Record<string, string>;

export type BillingCheckoutResponse = {
  provider: string;
  checkout_id: string;
  checkout_url: string;
};

export function createBillingCheckout(headers: AuthHeaders) {
  return requestApi<BillingCheckoutResponse>("/billing/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ plan_code: "pro" }),
  });
}
