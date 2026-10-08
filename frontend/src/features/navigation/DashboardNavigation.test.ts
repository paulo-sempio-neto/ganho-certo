import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardNavigation, getDashboardArea, type DashboardArea } from "./DashboardNavigation";

describe("dashboard navigation", () => {
  it.each<DashboardArea>(["hoje", "resultado", "custos", "mais"])("marks only %s as the current area", (activeArea) => {
    const html = renderToStaticMarkup(createElement(DashboardNavigation, { activeArea }));
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`href="#${activeArea}"[^>]*aria-current="page"`));
    for (const destination of ["hoje", "resultado", "custos", "mais"]) {
      expect(html).toContain(`href="#${destination}"`);
    }
  });

  it.each([
    ["#daily-entry-result", "hoje"],
    ["#quick-start", "hoje"],
    ["#metas", "resultado"],
    ["#detalhes-resultado", "resultado"],
    ["#padroes", "resultado"],
    ["#veiculos", "custos"],
    ["#despesas-recorrentes", "custos"],
    ["#manutencao", "custos"],
    ["#lista-despesas", "custos"],
    ["#lista-jornadas", "mais"],
    ["#conta", "mais"],
    ["%76eiculos", "custos"],
  ])("opens the owning area for an internal destination %s", (target, expected) => {
    expect(getDashboardArea(target)).toBe(expected);
  });

  it.each(["", "#missing", "#%", "#toString", "#__proto__"])("safely defaults to Hoje for %s", (target) => {
    expect(getDashboardArea(target)).toBe("hoje");
  });
});