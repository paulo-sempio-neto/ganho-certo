import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ResultSection } from "./ResultSection";

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
  it("announces loading separately from an empty result", () => {
    const html = renderResultSection({ isSummaryLoading: true });
    expect(html).toContain('class="loading-state" role="status"');
    expect(html).not.toContain("Ainda nao ha dados");
  });

  it("announces a failure and keeps retry available", () => {
    const html = renderResultSection({ summaryError: "Falha temporaria" });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Falha temporaria");
    expect(html).toContain("Tentar novamente");
  });

  it("renders the history navigation label with correct accents", () => {
    expect(renderResultSection()).toContain('<a href="#evolucao">Evolu\u00e7\u00e3o</a>');
  });

  it("renders a clear empty state when the dashboard has no summary yet", () => {
    const html = renderResultSection();

    expect(html).toContain("Ainda nao ha dados para montar o resultado.");
    expect(html).toContain("Registre seu dia em Hoje");
  });
});
