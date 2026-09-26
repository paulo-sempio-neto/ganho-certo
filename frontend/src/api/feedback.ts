import { requestApi } from "./client";

type AuthHeaders = Record<string, string>;

export type BetaFeedbackCategory = "bug" | "confusing" | "idea" | "other";
export type BetaFeedbackPriority = "low" | "normal" | "high" | "urgent";
export type BetaFeedbackStatus = "open" | "reviewing" | "resolved" | "closed";

export type BetaFeedbackResponse = {
  id: number;
  category: BetaFeedbackCategory;
  priority: BetaFeedbackPriority;
  status: BetaFeedbackStatus;
  message: string;
  path: string | null;
  resolved_at: string | null;
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
