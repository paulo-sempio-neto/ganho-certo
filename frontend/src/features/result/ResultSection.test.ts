import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ResultSection } from "./ResultSection";
import type { FinancialHistoryResponse, FinancialSummary } from "../../types/financial";

const summary: FinancialSummary = {
  gross_revenue: "350.00", total_expenses: "90.00", estimated_net_profit: "260.00",
  estimated_structural_costs: "40.00", estimated_economic_costs: "130.00",
  estimated_economic_result: "220.00", recurring_expenses_total: "20.00",
  recurring_expenses_breakdown: [], projected_economic_costs: "150.00",
  projected_economic_result: "200.00",
  structural_costs: {
    ownership: "0.00", insurance: "0.00", ipva: "0.00", other_fixed: "0.00",
    maintenance: "40.00", tires: "0.00", oil: "0.00", depreciation: "0.00",
  },
  total_distance_km: "160.00", total_worked_minutes: 480, total_trip_count: 18,
  gross_per_hour: "43.75", net_per_hour: "32.50", gross_per_km: "2.19",
  net_per_km: "1.63", expense_per_km: "0.56", average_ticket: "19.44",
  daily: [{ date: "2026-09-26", gross_revenue: "350.00", expenses: "90.00", estimated_net_profit: "260.00" }],
};

const metric = { current: "260.00", previous: null, absolute_delta: null, percentage_delta: null };
const emptyHistory: FinancialHistoryResponse = {
  start_date: "2026-09-01", end_date: "2026-09-26", vehicle_id: null, grouping: "daily",
  periods: [], trend_facts: [],
  comparison: {
    current_period_start: "2026-09-01", current_period_end: "2026-09-26",
    previous_period_start: "2026-08-06", previous_period_end: "2026-08-31",
    gross_revenue: metric, registered_expenses: metric, estimated_result: metric,
    projected_result: metric, worked_minutes: metric, distance_km: metric,
    estimated_result_per_hour: metric, estimated_result_per_km: metric,
  },
};

function renderResultSection(overrides: Partial<ComponentProps<typeof ResultSection>> = {}): string {
  return renderToStaticMarkup(
    createElement(ResultSection, {
      vehicles: [],
      dashboardFilters: {
        period: "last7",
        customStartDate: "2026-09-26",
        customEndDate: "2026-09-26",
        vehicleId: "",
        onPeriodChange: vi.fn(),
        onCustomStartDateChange: vi.fn(),
        onCustomEndDateChange: vi.fn(),
        onVehicleChange: vi.fn(),
      },
      historyFilters: {
        period: "last30",
        startDate: "2026-09-01",
        endDate: "2026-09-26",
        grouping: "daily",
        vehicleId: "",
        onPeriodChange: vi.fn(),
        onDateChange: vi.fn(),
        onGroupingChange: vi.fn(),
        onVehicleChange: vi.fn(),
      },
      summary: null,
      insights: [],
      history: null,
      isSummaryLoading: false,
      isInsightsLoading: false,
      isHistoryLoading: false,
      summaryError: "",
      insightsError: "",
      historyError: "",
      onSummaryRetry: vi.fn(),
      onInsightsRetry: vi.fn(),
      onHistoryRetry: vi.fn(),
      onFirstResultViewed: vi.fn(),
      getAuthHeaders: () => ({}),
      endSession: vi.fn(),
      getVehicleLabel: () => "Carro",
      getExpenseCategoryLabel: () => "Combustivel",
      ...overrides,
    }),
  );
}

describe("ResultSection", () => {
  it("orders the answer, comparison, goal access, insights and optional details", () => {
    const html = renderResultSection({ summary });
    const markers = ['data-result-kind="realized"', 'id="evolucao"', 'href="#metas"', 'id="insights"', 'id="detalhes-resultado"'];
    for (let index = 1; index < markers.length; index += 1) {
      expect(html.indexOf(markers[index - 1])).toBeGreaterThan(-1);
      expect(html.indexOf(markers[index - 1])).toBeLessThan(html.indexOf(markers[index]));
    }
    expect(html).toContain('<a href="#evolucao">Evolução</a>');
    expect(html).toContain("R$ 260,00");
    expect(html).toContain("Quanto sobrou?");
  });

  it("guides an empty history back to real daily entry instead of simulation", () => {
    const html = renderResultSection({ summary, history: emptyHistory });
    expect(html).toContain("Registre jornadas e gastos ou ajuste o período.");
    expect(html).toContain('href="#hoje"');
    expect(html).not.toContain('href="#quick-start"');
  });

  it("explains why a saved day alone does not unlock a previous-period comparison", () => {
    const html = renderResultSection({ summary, history: {
      ...emptyHistory,
      periods: [{
        period_start: "2026-09-26", period_end: "2026-09-26", gross_revenue: "350.00",
        registered_expenses: "90.00", estimated_structural_costs: "40.00",
        recurring_projected_expenses: "20.00", cash_remaining: "260.00",
        estimated_result: "220.00", projected_result: "200.00", worked_minutes: 480,
        distance_km: "160.00", trip_count: 18, revenue_per_hour: "43.75",
        estimated_result_per_hour: "27.50", revenue_per_km: "2.19", estimated_result_per_km: "1.38",
      }],
    } });
    expect(html).toContain("Você já tem registros neste período.");
    expect(html).toContain("registros também no período anterior equivalente");
    expect(html).toContain("Comparação indisponível para esta métrica.");
  });

  it("announces loading separately from an empty result", () => {
    const html = renderResultSection({ isSummaryLoading: true });
    expect(html).toContain('class="loading-state" role="status"');
    expect(html).not.toContain("Ainda não há registros");
  });

  it("announces a failure and keeps retry available", () => {
    const html = renderResultSection({ summaryError: "Falha temporaria" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Falha temporaria");
    expect(html).toContain("Tentar novamente");
  });

  it("renders a clear empty state when the dashboard has no summary yet", () => {
    const html = renderResultSection();

    expect(html).toContain("Ainda não há registros para montar o resultado neste período.");
    expect(html).toContain("quilômetros e tempo trabalhado em Hoje");
    expect(html).toContain('href="#hoje"');
  });
});
