import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AccountPlanPanel } from "./AccountPlanPanel";
import type { AccountPlanResponse } from "../../api/account";

const freePlan: AccountPlanResponse = {
  current_plan: { id: 1, name: "Free", code: "free" },
  features: {
    advanced_history: false,
    csv_import: false,
    financial_insights: true,
  },
  limits: { vehicle_limit: 1 },
};

const proPlan: AccountPlanResponse = {
  current_plan: { id: 2, name: "Pro", code: "pro" },
  features: {
    advanced_history: true,
    csv_import: true,
    financial_insights: true,
  },
  limits: {},
};

function renderPanel(accountPlan: AccountPlanResponse | null, error = ""): string {
  return renderToStaticMarkup(
    createElement(AccountPlanPanel, {
      accountPlan,
      error,
      isLoading: false,
      onRetry: vi.fn(),
    }),
  );
}

describe("AccountPlanPanel", () => {
  it("renders the FREE plan with available and locked features", () => {
    const html = renderPanel(freePlan);

    expect(html).toContain("FREE");
    expect(html).toContain("Controle financeiro diario");
    expect(html).toContain("Cadastro de 1 veiculo");
    expect(html).toContain("Importacao CSV");
    expect(html).toContain("Historico avancado");
    expect(html).toContain("Inteligencia financeira");
  });

  it("renders the PRO plan without locked features", () => {
    const html = renderPanel(proPlan);

    expect(html).toContain("PRO");
    expect(html).toContain("Cadastro de veiculos");
    expect(html).toContain("Importacao CSV");
    expect(html).toContain("Historico avancado");
    expect(html).toContain("Nenhum recurso bloqueado neste plano.");
  });

  it("renders loading and error states", () => {
    const html = renderToStaticMarkup(
      createElement(AccountPlanPanel, {
        accountPlan: null,
        error: "Nao foi possivel carregar seu plano.",
        isLoading: true,
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain("Carregando plano");
    expect(html).toContain("Nao foi possivel carregar seu plano.");
  });
});
