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

  it("presents realized, estimated, and projected results in that order", () => {
    const html = renderToStaticMarkup(
      createElement(FinancialSummaryPanel, {
        summary: {
          ...emptySummary,
          estimated_net_profit: "120.00",
          estimated_structural_costs: "40.00",
          estimated_economic_result: "80.00",
          recurring_expenses_total: "10.00",
          projected_economic_costs: "50.00",
          projected_economic_result: "70.00",
        },
        getExpenseCategoryLabel: () => "Combustivel",
      }),
    );

    expect(html).toContain("Realizado");
    expect(html).toContain("Estimado");
    expect(html).toContain("Projetado");
    expect(html).toContain("Sobra no caixa: faturamento menos despesas registradas.");
    expect(html).toContain("Resultado apos custos estruturais estimados do veiculo.");
    expect(html).toContain("Estimado mais despesas recorrentes previstas para o periodo.");
    expect(html).toContain("Desempenho registrado");
    expect(html).toContain("Sobra no caixa dividida pelas horas registradas.");
    expect(html).toContain("Custos estruturais estimados");
    expect(html.indexOf("Realizado")).toBeLessThan(html.indexOf("Estimado"));
    expect(html.indexOf("Estimado")).toBeLessThan(html.indexOf("Projetado"));
  });

  it("explains which missing inputs limit estimated and projected results", () => {
    const html = renderToStaticMarkup(
      createElement(FinancialSummaryPanel, {
        summary: emptySummary,
        getExpenseCategoryLabel: () => "Combustivel",
      }),
    );

    expect(html).toContain("Dados insuficientes para o resultado estimado");
    expect(html).toContain("Dados insuficientes para o projetado");
    expect(html).toContain("nenhum custo estrutural foi configurado");
  });
});
