import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { InsightsPanel } from "./InsightsPanel";
import type { FinancialInsight } from "../../types/financial";

const insights: FinancialInsight[] = [
  {
    code: "activity_consistency",
    type: "info",
    title: "Consistencia de registro",
    message: "Voce registrou movimentacao em 4 de 7 dias do periodo.",
  },
  {
    code: "weekly_performance_summary",
    type: "positive",
    title: "Resumo semanal",
    message: "Sua media semanal ficou positiva neste periodo.",
  },
  {
    code: "best_weekday",
    type: "positive",
    title: "Dia da semana em destaque",
    message: "Sexta-feira concentrou a maior sobra registrada.",
  },
  {
    code: "expense_share",
    type: "info",
    title: "Despesas sobre o faturamento",
    message: "Suas despesas registradas representam 20% do faturamento.",
  },
  {
    code: "net_per_hour",
    type: "positive",
    title: "Resultado por hora",
    message: "Seu resultado medio foi positivo.",
  },
  {
    code: "top_expense_category",
    type: "info",
    title: "Maior categoria de despesa",
    message: "Combustivel foi sua maior despesa.",
  },
  {
    code: "hidden_seventh",
    type: "info",
    title: "Insight oculto",
    message: "Este item nao deve aparecer.",
  },
];

describe("InsightsPanel", () => {
  it("renders retention insights in the existing result area", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, {
        insights,
        isLoading: false,
        error: "",
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain("Consistencia de registro");
    expect(html).toContain("Resumo semanal");
    expect(html).toContain("Dia da semana em destaque");
    expect(html).toContain("Maior categoria de despesa");
    expect(html).toContain("Dados registrados");
    expect(html).toContain("Despesas registradas");
    expect(html).not.toContain("Insight oculto");
  });

  it("keeps the empty insight state understandable", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, {
        insights: [],
        isLoading: false,
        error: "",
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain("Ainda não há dados suficientes para gerar insights deste período.");
    expect(html).toContain("Registre jornadas e gastos em outros dias");
    expect(html).toContain("dados nos dois períodos");
  });

  it("puts comparison and weekly insights before performance and expense details", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, {
        insights: [
          {
            code: "expense_share",
            type: "info",
            title: "Despesas",
            message: "Detalhes de despesas.",
          },
          {
            code: "best_day",
            type: "positive",
            title: "Melhor dia",
            message: "Desempenho.",
          },
          {
            code: "weekly_performance_summary",
            type: "positive",
            title: "Resumo semanal prioritario",
            message: "Comparacao semanal.",
          },
          {
            code: "net_result_change",
            type: "positive",
            title: "Comparacao do periodo",
            message: "Resultado anterior.",
          },
          {
            code: "activity_consistency",
            type: "info",
            title: "Consistencia",
            message: "Dias registrados.",
          },
        ],
        isLoading: false,
        error: "",
        onRetry: vi.fn(),
      }),
    );

    expect(html.indexOf("Comparacao do periodo")).toBeLessThan(
      html.indexOf("Resumo semanal prioritario"),
    );
    expect(html.indexOf("Resumo semanal prioritario")).toBeLessThan(
      html.indexOf("Consistencia"),
    );
    expect(html.indexOf("Consistencia")).toBeLessThan(html.indexOf("Melhor dia"));
    expect(html.indexOf("Melhor dia")).toBeLessThan(html.indexOf("Despesas"));
  });
});
