import { describe, expect, it } from "vitest";

import {
  getGoalCurrentValueLabel,
  getGoalProgressScopeMessage,
  getGoalProgressStatusMessage,
  getGoalRequiredPaceMessage,
  getGoalUpdatedAfterWorkMessage,
  getMatchingNetGoal,
} from "./goalMessages";
import type { FinancialGoal } from "../../types/financial";

const activeNetGoal: FinancialGoal = {
  id: 1,
  vehicle_id: null,
  goal_type: "net",
  target_amount: "1000.00",
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  active: true,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("goal presentation messages", () => {
  it("labels pace and closing values as estimates", () => {
    expect(getGoalProgressScopeMessage()).toContain("estimativas");
    expect(getGoalProgressScopeMessage()).toContain("nao garantias");
    expect(getGoalCurrentValueLabel("net")).toBe("Sobra registrada");
    expect(getGoalCurrentValueLabel("projected")).toBe("Resultado projetado apurado");
    expect(getGoalRequiredPaceMessage(5, false)).toContain("Nao e uma previsao");
    expect(getGoalRequiredPaceMessage(0, false)).toContain("periodo terminou");
  });

  it("explains reached, insufficient, and pace states", () => {
    expect(getGoalProgressStatusMessage(true, true, true)).toContain("Meta atingida");
    expect(getGoalProgressStatusMessage(false, false, false)).toContain("dados suficientes");
    expect(getGoalProgressStatusMessage(false, true, true)).toContain("ritmo necessario");
    expect(getGoalProgressStatusMessage(false, true, false)).toContain("abaixo");
  });

  it("connects a saved workday with active goals", () => {
    expect(getGoalUpdatedAfterWorkMessage(true)).toContain("metas ativas foram atualizadas");
    expect(getGoalUpdatedAfterWorkMessage(false)).toContain("Veja a sobra");
    expect(getMatchingNetGoal([activeNetGoal], "2026-09-10", 7)?.id).toBe(1);
    expect(getMatchingNetGoal([activeNetGoal], "2026-10-01", 7)).toBeNull();
    expect(getMatchingNetGoal([{ ...activeNetGoal, active: false }], "2026-09-10", 7)).toBeNull();
    expect(getMatchingNetGoal([{ ...activeNetGoal, goal_type: "projected" }], "2026-09-10", 7)).toBeNull();
    expect(
      getMatchingNetGoal(
        [activeNetGoal, { ...activeNetGoal, id: 2, vehicle_id: 7 }],
        "2026-09-10",
        7,
      )?.id,
    ).toBe(2);
  });
});
