import { describe, expect, it } from "vitest";

import { getBetaActivationNextStep } from "./activation";

describe("getBetaActivationNextStep", () => {
  it("guides a new user without a vehicle while preserving first-day intent", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 0,
      workSessionCount: 0,
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
    });

    expect(step?.title).toBe("Registre seu primeiro dia");
    expect(step?.targetId).toBe("hoje");
  });

  it("explains that another workday enables comparisons", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 1,
      workSessionCount: 1,
    });

    expect(step?.title).toBe("Registre mais um dia para comparar");
    expect(step?.message).toContain("outro registro");
    expect(step?.actionLabel).toBe("Registrar outro dia");
  });

  it("encourages trend review after multiple saved workdays", () => {
    const step = getBetaActivationNextStep({
      vehicleCount: 1,
      workSessionCount: 3,
    });

    expect(step?.title).toBe("Revise suas tendencias");
    expect(step?.actionLabel).toBe("Ver tendencias");
    expect(step?.targetId).toBe("resultado");
  });
});
