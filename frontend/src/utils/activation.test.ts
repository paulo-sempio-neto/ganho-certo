import { describe, expect, it } from "vitest";

import { getBetaActivationNextStep } from "./activation";

describe("getBetaActivationNextStep", () => {
  it("guides a new user without a vehicle while preserving first-day intent", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 0,
      workSessionCount: 0,
      expenseCount: 0,
      hasQuickDailyResult: false,
    });

    expect(step).toEqual({
      title: "Primeiro passo da beta",
      message:
        "Cadastre o veiculo ou preencha o dia agora. Se salvar antes, seus dados ficam guardados.",
      actionLabel: "Cadastrar veiculo",
      targetId: "veiculos",
    });
  });

  it("points users with a vehicle to their first financial entry", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 1,
      workSessionCount: 0,
      expenseCount: 0,
      hasQuickDailyResult: false,
    });

    expect(step?.title).toBe("Registre seu primeiro dia");
    expect(step?.targetId).toBe("hoje");
  });

  it("asks for the first expense after a saved work day", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 1,
      workSessionCount: 1,
      expenseCount: 0,
      hasQuickDailyResult: true,
    });

    expect(step?.title).toBe("Inclua o primeiro gasto");
    expect(step?.actionLabel).toBe("Adicionar gasto");
  });

  it("does not interrupt an activated existing user", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 1,
      workSessionCount: 3,
      expenseCount: 2,
      hasQuickDailyResult: false,
    });

    expect(step).toBeNull();
  });
});
