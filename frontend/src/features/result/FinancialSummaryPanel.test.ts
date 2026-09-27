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

    expect(html).toContain("Quanto sobrou?");
    expect(html).toContain("Nenhuma movimentação registrada neste período.");
    expect(html).toContain('href="#hoje"');
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
    expect(html).toContain('data-result-kind="realized"');
    expect(html).toContain('data-result-kind="estimated"');
    expect(html).toContain('data-result-kind="projected"');
    expect(html).toContain("R$ 120,00");
    expect(html).toContain("R$ 80,00");
    expect(html).toContain("R$ 70,00");
    expect(html).toContain("Sobra no caixa: faturamento menos despesas registradas.");
    expect(html).toContain("Sobra registrada menos os custos estimados do veículo. Não é saldo em caixa.");
    expect(html).toContain("Não é previsão de renda.");
    expect(html).toContain("Gastos ainda não registrados não estão descontados.");
    expect(html).toContain('result-primary" data-result-kind="realized"');
    expect(html).toContain("Desempenho registrado");
    expect(html).toContain("Sobra no caixa dividida pelas horas registradas.");
    expect(html).toContain("Custos estruturais estimados");
    expect(html.indexOf("Realizado")).toBeLessThan(html.indexOf("Estimado"));
    expect(html.indexOf("Estimado")).toBeLessThan(html.indexOf("Projetado"));
  });

  it("keeps negative amounts distinct from the certainty of a result", () => {
    const html = renderToStaticMarkup(createElement(FinancialSummaryPanel, {
      summary: { ...emptySummary, estimated_economic_result: "-40.00" },
      getExpenseCategoryLabel: () => "Combustivel",
    }));

    expect(html).toContain('class="metric-card metric-negative" data-result-kind="estimated"');
    expect(html).toContain("R$ -40,00");
    expect(html).toContain("Estimado");
  });

  it("explains which missing inputs limit estimated and projected results", () => {
    const html = renderToStaticMarkup(
      createElement(FinancialSummaryPanel, {
        summary: emptySummary,
        getExpenseCategoryLabel: () => "Combustivel",
      }),
    );

    expect(html).toContain("Dados insuficientes para o resultado estimado");
    expect(html).toContain("Sem despesas recorrentes previstas a descontar neste período.");
    expect(html).toContain("Nenhum custo estrutural estimado neste período.");
    expect(html).toContain("Sem custos estimados neste período. Confira o perfil do veículo.");
  });

  it("keeps intermediate result sections before optional details without removing metrics", () => {
    const html = renderToStaticMarkup(createElement(FinancialSummaryPanel, {
      summary: emptySummary,
      getExpenseCategoryLabel: () => "Combustivel",
      children: createElement("section", { id: "comparison-slot" }, "Comparacoes"),
    }));

    expect(html.indexOf('data-result-kind="realized"')).toBeLessThan(html.indexOf('id="comparison-slot"'));
    expect(html.indexOf('id="comparison-slot"')).toBeLessThan(html.indexOf('id="detalhes-resultado"'));
    expect(html).toContain('<details class="result-details" id="detalhes-resultado">');
    expect(html).toContain("Desempenho registrado");
    expect(html).toContain("Evolução diária");
    expect(html).toContain("Despesas recorrentes previstas");
  });

  it.each(["0.00", "-250.00", "9999999.99"])("preserves the registered amount %s", (amount) => {
    const html = renderToStaticMarkup(createElement(FinancialSummaryPanel, {
      summary: { ...emptySummary, estimated_net_profit: amount },
      getExpenseCategoryLabel: () => "Combustivel",
    }));
    const primary = html.split('data-result-kind="realized">')[1].split("</article>")[0];
    expect(primary).toContain(amount === "0.00" ? "R$ 0,00" : amount === "-250.00" ? "R$ -250,00" : "R$ 9.999.999,99");
    expect(primary).toContain("Realizado");
    if (amount.startsWith("-")) expect(html).toContain("metric-negative result-primary");
  });
});
