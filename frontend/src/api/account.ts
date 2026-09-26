import { requestApi } from "./client";

type AuthHeaders = Record<string, string>;

export type AccountPlan = {
  id: number;
  name: string;
  code: string;
};

export type AccountSubscription = {
  status: string;
  provider: string;
  period_start: string | null;
  period_end: string | null;
  canceled_at: string | null;
};

export type AccountPlanResponse = {
  current_plan: AccountPlan;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  subscription: AccountSubscription | null;
};

export function getAccountPlan(headers: AuthHeaders) {
  return requestApi<AccountPlanResponse>("/account/plan", { headers });
}
