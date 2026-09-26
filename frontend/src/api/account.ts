import { requestApi } from "./client";

type AuthHeaders = Record<string, string>;

export type AccountPlan = {
  id: number;
  name: string;
  code: string;
};

export type AccountPlanResponse = {
  current_plan: AccountPlan;
  features: Record<string, boolean>;
  limits: Record<string, number>;
};

export function getAccountPlan(headers: AuthHeaders) {
  return requestApi<AccountPlanResponse>("/account/plan", { headers });
}
