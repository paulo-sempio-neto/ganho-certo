import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinancialSummaryPanel } from "./FinancialSummaryPanel";
import type { FinancialSummary } from "../../types/financial";

const emptySummary: FinancialSummary = {
  gross_revenue: "0.00",
  total_expenses: "0.00",
  estimated_net_profit: "0.00",
  estimated_structural_costs: "0.00",
  estimated_economic_costs: "0.00",
  estimated_economic_result: "0.00",
  recurring_expenses_total: "0.00",
  recurring_expenses_breakdown: [],
  projected_economic_costs: "0.00",
  projected_economic_result: "0.00",
  structural_costs: {
    ownership: "0.00",
    insurance: "0.00",
    ipva: "0.00",
    other_fixed: "0.00",
    maintenance: "0.00",
    tires: "0.00",
    oil: "0.00",
    depreciation: "0.00",
  },
  total_distance_km: "0.00",
  total_worked_minutes: 0,
  total_trip_count: 0,
  gross_per_hour: null,
  net_per_hour: null,
  gross_per_km: null,
  net_per_km: null,
  expense_per_km: null,
  average_ticket: null,
  daily: [],
};

describe("FinancialSummaryPanel", () => {
  it("keeps the empty daily-result state understandable", () => {
    const html = renderToStaticMarkup(
      createElement(FinancialSummaryPanel, {
        summary: emptySummary,
        getExpenseCategoryLabel: () => "Combustivel",
      }),
    );

    expect(html).toContain("Quanto realmente esta sobrando?");
    expect(html).toContain("Nenhum dado no período selecionado.");
  });
});
