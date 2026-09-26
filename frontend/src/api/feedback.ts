import { requestApi } from "./client";

type AuthHeaders = Record<string, string>;

export type BetaFeedbackCategory = "bug" | "confusing" | "idea" | "other";

export type BetaFeedbackResponse = {
  id: number;
  category: BetaFeedbackCategory;
  message: string;
  path: string | null;
  created_at: string;
};

export function createBetaFeedback(
  headers: AuthHeaders,
  payload: { category: BetaFeedbackCategory; message: string; path?: string },
) {
  return requestApi<BetaFeedbackResponse>("/feedback", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}
