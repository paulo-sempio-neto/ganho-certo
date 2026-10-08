import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getBetaActivationNextStep } from "../../utils/activation";
import { DashboardStart } from "./DashboardStart";

function renderStart(workSessionCount: number, vehicleCount = 1, isLoading = false) {
  return renderToStaticMarkup(createElement(DashboardStart, {
    nextStep: getBetaActivationNextStep({ workSessionCount, vehicleCount }),
    hasWorkdays: workSessionCount > 0,
    isLoading,
    onRegister: () => undefined,
  }));
}

describe("DashboardStart", () => {
  it.each([0, 1])("prioritizes the first record with %i vehicles", (vehicles) => {
    const html = renderStart(0, vehicles);

    expect(html).toContain("Registre seu primeiro dia");
    expect(html.match(/Registrar meu dia/g)).toHaveLength(1);
    expect(html).toContain('id="primeiro-resultado"');
    expect(html).toContain("Depois de salvar, acompanhe a sobra no resumo de Hoje.");
    expect(html).not.toContain('href="#resultado"');
    expect(html).not.toContain("#quick-start");
  });

  it("explains the next step after one saved workday and links to the result", () => {
    const html = renderStart(1);

    expect(html).toContain("Registre mais um dia para comparar");
    expect(html).toContain('href="#resultado"');
    expect(html).toContain("Ver resultado");
    expect(html).not.toContain('id="primeiro-resultado"');
    expect(html).not.toContain("Registre seu primeiro dia");
  });

  it("preserves trend guidance for returning users and the daily action", () => {
    const html = renderStart(4);

    expect(html).toContain("Revise suas tendencias");
    expect(html).toContain("Registrar meu dia");
    expect(html).toContain('href="#resultado"');
  });

  it("does not display first-use instructions while records are loading", () => {
    const html = renderStart(0, 0, true);

    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando seus registros...");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Registre seu primeiro dia");
    expect(html).not.toContain('id="primeiro-resultado"');
  });
});
