import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TodaySummary } from "./TodaySummary";

type Props = ComponentProps<typeof TodaySummary>;

const daily: NonNullable<Props["daily"]> = {
  date: "2026-10-07",
  gross_revenue: "300.00",
  expenses: "80.00",
  estimated_net_profit: "220.00",
};

const goal: NonNullable<Props["goal"]> = {
  goal: {
    id: 1,
    vehicle_id: null,
    goal_type: "net",
    target_amount: "1000.00",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    active: true,
    created_at: "2026-10-01T12:00:00",
    updated_at: "2026-10-01T12:00:00",
  },
  progress: {
    target_amount: "1000.00",
    current_amount: "450.00",
    remaining_amount: "550.00",
    progress_percentage: "45.00",
    days_total: 31,
    days_elapsed: 7,
    days_remaining: 24,
    required_daily_amount: "22.92",
    projected_completion_amount: "1992.86",
    on_track: true,
    average_net_per_hour: "20.00",
    average_projected_per_hour: null,
    estimated_hours_remaining: "27.50",
  },
  vehicleLabel: null,
};

function renderSummary(overrides: Partial<Props> = {}) {
  return renderToStaticMarkup(createElement(TodaySummary, {
    date: daily.date,
    daily,
    isLoading: false,
    error: "",
    onRetry: () => undefined,
    onRegister: () => undefined,
    onAddExpense: () => undefined,
    isRegisterOpen: false,
    isExpenseOpen: false,
    goal: null,
    isGoalLoading: false,
    ...overrides,
  }));
}

describe("TodaySummary", () => {
  it("shows the exact day's registered amounts and explicit scope", () => {
    const html = renderSummary();

    expect(html).toContain('id="today-summary" tabindex="-1"');
    expect(html).toContain('id="today-summary-title">Hoje</h2>');
    expect(html).toContain("07/10/2026 · Todos os veículos");
    expect(html).toContain('data-result-kind="realized"');
    expect(html).toContain("Sobra após despesas registradas");
    expect(html).toContain("R$ 220,00");
    expect(html).toContain("R$ 300,00");
    expect(html).toContain("R$ 80,00");
    expect(html).toContain("Gastos ainda não registrados não estão descontados.");
  });

  it("distinguishes a recorded zero from a day without records", () => {
    const recordedZero = renderSummary({
      daily: { ...daily, gross_revenue: "0.00", expenses: "0.00", estimated_net_profit: "0.00" },
    });
    const noRecords = renderSummary({ daily: null });

    expect(recordedZero.match(/R\$ 0,00/g)).toHaveLength(3);
    expect(recordedZero).not.toContain("Nenhum registro neste dia");
    expect(recordedZero).not.toContain("<strong>—</strong>");
    expect(noRecords.match(/<strong>—<\/strong>/g)).toHaveLength(3);
    expect(noRecords).toContain("Nenhum registro neste dia");
    expect(noRecords).not.toContain("R$ 0,00");
  });

  it("does not show figures from another date", () => {
    const html = renderSummary({ daily: { ...daily, date: "2026-10-06" } });

    expect(html).toContain("Nenhum registro neste dia");
    expect(html).not.toContain("R$ 220,00");
    expect(html).not.toContain("R$ 300,00");
    expect(html).not.toContain("R$ 80,00");
  });

  it("preserves a negative registered remainder", () => {
    const html = renderSummary({
      daily: { ...daily, gross_revenue: "0.00", expenses: "80.00", estimated_net_profit: "-80.00" },
    });

    expect(html).toContain("metric-negative");
    expect(html).toContain("R$ -80,00");
    expect(html).not.toContain("Nenhum registro neste dia");
  });

  it.each([
    { isLoading: true, message: "Carregando o resumo do dia...", role: "status" },
    { error: "Não foi possível carregar o dia.", message: "Não foi possível carregar o dia.", role: "alert" },
  ])("hides stale amounts while loading or after failure", ({ message, role, ...state }) => {
    const html = renderSummary({ ...state, goal });

    expect(html).toContain(message);
    expect(html).toContain(`role="${role}"`);
    expect(html).not.toContain("R$");
    expect(html).not.toContain("Nenhum registro neste dia");
    expect(html).toContain("Registrar dia");
    expect(html).toContain("Adicionar gasto");
    if (state.error) expect(html).toContain("Tentar novamente");
  });

  it("separates the goal period's accumulated progress from today's figures", () => {
    const html = renderSummary({ goal });

    expect(html).toContain("Meta do período · 01/10/2026–31/10/2026");
    expect(html).toContain("Sobra registrada");
    expect(html).toContain("R$ 450,00 de R$ 1.000,00");
    expect(html).toContain("45% da meta no período.");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="45"');
    expect(html).toContain('href="#metas"');
    expect(html.match(/Todos os veículos/g)).toHaveLength(2);
  });

  it("labels vehicle-scoped projected goals and clamps accessible progress", () => {
    const html = renderSummary({
      goal: {
        ...goal,
        goal: { ...goal.goal, goal_type: "projected", vehicle_id: 7 },
        progress: { ...goal.progress, current_amount: "1200.00", progress_percentage: "120.00" },
        vehicleLabel: "Carro de trabalho",
      },
    });

    expect(html).toContain("Resultado projetado apurado");
    expect(html).toContain("Carro de trabalho");
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-valuetext="120% da meta no período"');
    expect(html).toContain('style="width:100%"');
  });

  it("hides stale goal progress while the applicable goal loads", () => {
    const html = renderSummary({ goal, isGoalLoading: true });

    expect(html).toContain("Carregando a meta aplicável...");
    expect(html).toContain("R$ 220,00");
    expect(html).not.toContain("R$ 450,00");
    expect(html).not.toContain('role="progressbar"');
  });

  it("exposes both form controls and their expanded states", () => {
    const closed = renderSummary();
    const open = renderSummary({ isRegisterOpen: true, isExpenseOpen: true });

    expect(closed).toContain('aria-expanded="false" aria-controls="daily-entry-panel"');
    expect(closed).toContain('aria-expanded="false" aria-controls="daily-expense-form"');
    expect(open).toContain('aria-expanded="true" aria-controls="daily-entry-panel"');
    expect(open).toContain('aria-expanded="true" aria-controls="daily-expense-form"');
    expect(open.match(/Registrar dia/g)).toHaveLength(1);
    expect(open.match(/Adicionar gasto/g)).toHaveLength(1);
  });
});
