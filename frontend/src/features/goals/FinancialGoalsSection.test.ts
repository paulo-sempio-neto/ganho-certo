import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FinancialGoal, FinancialGoalProgress } from "../../types/financial";
import { FinancialGoalsSection } from "./FinancialGoalsSection";

const goal: FinancialGoal = {
  id: 1,
  vehicle_id: null,
  goal_type: "net",
  target_amount: "1000.00",
  start_date: "2026-10-01",
  end_date: "2026-10-31",
  active: true,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
};

const progress: FinancialGoalProgress = {
  target_amount: "1000.00",
  current_amount: "250.00",
  remaining_amount: "750.00",
  progress_percentage: "25.00",
  days_total: 31,
  days_elapsed: 7,
  days_remaining: 24,
  required_daily_amount: "31.25",
  projected_completion_amount: "1107.14",
  on_track: true,
  average_net_per_hour: "25.00",
  average_projected_per_hour: "18.00",
  estimated_hours_remaining: "30.00",
};

function renderGoals(overrides: Partial<ComponentProps<typeof FinancialGoalsSection>> = {}) {
  return renderToStaticMarkup(createElement(FinancialGoalsSection, {
    financialGoals: [],
    financialGoalProgressById: {},
    isFinancialGoalsLoading: false,
    vehicles: [],
    getVehicleLabel: (vehicleId: number) => `Veículo ${vehicleId}`,
    getAuthHeaders: () => ({}),
    endSession: vi.fn(),
    setMessage: vi.fn(),
    setSuccessMessage: vi.fn(),
    loadFinancialGoals: vi.fn(async () => undefined),
    ...overrides,
  }));
}

describe("FinancialGoalsSection", () => {
  it("preserves the goal anchor, required fields and optional vehicle selection", () => {
    const html = renderGoals({ vehicles: [{
      id: 7, name: "Trabalho", brand: "Fiat", model: "Argo", year: 2023,
      fuel_type: "flex", created_at: "2026-10-01T10:00:00Z",
    }] });

    expect(html).toContain('id="metas"');
    for (const name of ["target_amount", "start_date", "end_date"]) {
      const field = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
      expect(field).toContain('required=""');
    }
    expect(html).toContain('name="financial-goal-type"');
    expect(html).toContain('name="vehicle_id"');
    expect(html).toContain('<option value="7">Trabalho - Fiat Argo</option>');
    expect(html).toContain('type="submit">Criar meta</button>');
    expect(html).toContain("Nenhuma meta cadastrada ainda.");
  });

  it("announces loading and disables refresh without presenting an empty list", () => {
    const html = renderGoals({ isFinancialGoalsLoading: true });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status" aria-atomic="true">Carregando metas...');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Atualizar<\/button>/);
    expect(html).not.toContain("Nenhuma meta cadastrada ainda.");
  });

  it("renders server progress and net hourly pace with the existing actions", () => {
    const html = renderGoals({ financialGoals: [goal], financialGoalProgressById: { 1: progress } });

    expect(html).toContain('<dt>Sobra registrada</dt><dd>R$ 250,00</dd>');
    expect(html).toContain('<dt>Ritmo atual por hora</dt><dd>R$ 25,00</dd>');
    expect(html).toContain('<dt>Horas estimadas restantes</dt><dd>30,00 h</dd>');
    expect(html).toContain('style="width:25%"');
    expect(html).toContain("01/10/2026 ate 31/10/2026");
    expect(html).toContain('<dt>Veiculo</dt><dd>Todos / sem veiculo</dd>');
    for (const action of ["Editar", "Desativar", "Excluir"]) {
      expect(html).toContain(`>${action}</button>`);
    }
  });

  it("keeps projected negative values and the selected vehicle distinct", () => {
    const html = renderGoals({
      financialGoals: [{ ...goal, goal_type: "projected", vehicle_id: 7, active: false }],
      financialGoalProgressById: { 1: {
        ...progress, current_amount: "-50.00", remaining_amount: "1050.00",
        progress_percentage: "-5.00", average_projected_per_hour: "-10.00",
        projected_completion_amount: "-100.00", on_track: false,
      } },
    });

    expect(html).toContain('<dt>Resultado projetado apurado</dt><dd>R$ -50,00</dd>');
    expect(html).toContain('<dt>Ritmo atual por hora</dt><dd>R$ -10,00</dd>');
    expect(html).toContain('<dt>Fechamento estimado</dt><dd>R$ -100,00</dd>');
    expect(html).toContain('<dt>Progresso</dt><dd>-5%</dd>');
    expect(html).toContain('style="width:0%"');
    expect(html).toContain('<dt>Veiculo</dt><dd>Veículo 7</dd>');
    expect(html).toContain('status-inactive">Inativa');
    expect(html).toContain('>Ativar</button>');
  });

  it("distinguishes zero values from unavailable pace and elapsed-period data", () => {
    const html = renderGoals({ financialGoals: [goal], financialGoalProgressById: { 1: {
      ...progress, current_amount: "0.00", progress_percentage: "0.00",
      days_elapsed: 0, average_net_per_hour: null, estimated_hours_remaining: null,
    } } });

    expect(html).toContain('<dt>Sobra registrada</dt><dd>R$ 0,00</dd>');
    expect(html).toContain('<dt>Progresso</dt><dd>0%</dd>');
    expect(html).toContain('<dt>Ritmo atual por hora</dt><dd>Dados insuficientes</dd>');
    expect(html).toContain('<dt>Horas estimadas restantes</dt><dd>—</dd>');
    expect(html).toContain('<dt>Fechamento estimado</dt><dd>Dados insuficientes</dd>');
    expect(html).not.toContain('Estimativa:');
  });

  it("shows goal completion without remaining pace or hours and bounds the progress bar", () => {
    const html = renderGoals({ financialGoals: [goal], financialGoalProgressById: { 1: {
      ...progress, current_amount: "1100.00", remaining_amount: "0.00",
      progress_percentage: "110.00", estimated_hours_remaining: "0.00",
    } } });

    expect(html).toContain('<strong>Meta atingida</strong>');
    expect(html).toContain('<dt>Ritmo necessario por dia</dt><dd>—</dd>');
    expect(html).toContain('<dt>Horas estimadas restantes</dt><dd>—</dd>');
    expect(html).toContain('<dt>Progresso</dt><dd>110%</dd>');
    expect(html).toContain('style="width:100%"');
    expect(html).not.toContain('Estimativa:');
  });

  it("keeps an existing goal visible while its progress is unavailable", () => {
    const html = renderGoals({ financialGoals: [goal] });

    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain('role="status" aria-atomic="true">Carregando progresso...');
    expect(html).toContain('<dt>Resumo</dt><dd>—</dd>');
    expect(html).not.toContain("Nenhuma meta cadastrada ainda.");
  });
});