import { afterEach, describe, expect, it, vi } from "vitest";
import { requestApi } from "../../api/client";
import type { FinancialSummary } from "../../types/financial";
import { loadDailySummary } from "./useTodaySummary";

vi.mock("../../api/client", () => ({ requestApi: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const date = "2026-10-07";
const day = { date, gross_revenue: "0.00", expenses: "0.00", estimated_net_profit: "0.00" };
function respond(daily: FinancialSummary["daily"]) {
  vi.mocked(requestApi).mockResolvedValue({ gross_revenue: "9999.00", daily });
}

describe("today summary data", () => {
  it("requests only the indicated day, across all vehicles", async () => {
    respond([day]);
    const headers = { Authorization: "Bearer test" };
    expect(await loadDailySummary(headers, date)).toEqual(day);
    expect(requestApi).toHaveBeenCalledWith(
      "/financial-summary?start_date=2026-10-07&end_date=2026-10-07", { headers },
    );
  });

  it("distinguishes a day with zero values from no records", async () => {
    respond([day]);
    expect(await loadDailySummary({}, date)).toEqual(day);
    respond([]);
    expect(await loadDailySummary({}, date)).toBeNull();
  });

  it("does not borrow another day's row or the period totals", async () => {
    respond([{ ...day, date: "2026-10-06", gross_revenue: "850.00" }]);
    expect(await loadDailySummary({}, date)).toBeNull();
  });

  it("preserves the server's negative balance for an expense-only day", async () => {
    const expenseOnly = { ...day, expenses: "50.00", estimated_net_profit: "-50.00" };
    respond([expenseOnly]);
    expect(await loadDailySummary({}, date)).toEqual(expenseOnly);
  });

  it("propagates a failed load instead of presenting an empty day", async () => {
    vi.mocked(requestApi).mockRejectedValue(new Error("Falha de conexão"));
    await expect(loadDailySummary({}, date)).rejects.toThrow("Falha de conexão");
  });
});
