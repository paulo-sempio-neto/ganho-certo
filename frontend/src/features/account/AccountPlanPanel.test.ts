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
  subscription: null,
};

const proPlan: AccountPlanResponse = {
  current_plan: { id: 2, name: "Pro", code: "pro" },
  features: {
    advanced_history: true,
    csv_import: true,
    financial_insights: true,
  },
  limits: {},
  subscription: {
    status: "active",
    provider: "mercado_pago",
    period_start: "2026-09-26T00:00:00Z",
    period_end: "2026-10-26T00:00:00Z",
    canceled_at: null,
  },
};

function renderPanel(
  accountPlan: AccountPlanResponse | null,
  error = "",
  billingError = "",
): string {
  return renderToStaticMarkup(
    createElement(AccountPlanPanel, {
      accountPlan,
      billingError,
      billingMessage: "",
      error,
      isCheckoutLoading: false,
      isLoading: false,
      onCheckoutPro: vi.fn(),
      onRetry: vi.fn(),
    }),
  );
}

describe("AccountPlanPanel", () => {
  it("renders the FREE plan with available and locked features", () => {
    const html = renderPanel(freePlan);

    expect(html).toContain("FREE");
    expect(html).toContain("Plano gratuito");
    expect(html).toContain("Controle financeiro diario");
    expect(html).toContain("Cadastro de 1 veiculo");
    expect(html).toContain("Importacao CSV");
    expect(html).toContain("Historico avancado");
    expect(html).toContain("Inteligencia financeira");
    expect(html).toContain("Assinar Pro");
  });

  it("renders the PRO plan without locked features", () => {
    const html = renderPanel(proPlan);

    expect(html).toContain("PRO");
    expect(html).toContain("Plano Pro ativo");
    expect(html).toContain("Cadastro de veiculos");
    expect(html).toContain("Importacao CSV");
    expect(html).toContain("Historico avancado");
    expect(html).toContain("Todos os recursos Pro estao liberados neste plano.");
    expect(html).not.toContain("Assinar Pro");
  });

  it("renders subscription status from backend information", () => {
    const pendingPlan: AccountPlanResponse = {
      ...freePlan,
      subscription: {
        status: "pending",
        provider: "mercado_pago",
        period_start: null,
        period_end: null,
        canceled_at: null,
      },
    };
    const canceledPlan: AccountPlanResponse = {
      ...freePlan,
      subscription: {
        status: "canceled",
        provider: "mercado_pago",
        period_start: null,
        period_end: null,
        canceled_at: "2026-09-26T00:00:00Z",
      },
    };

    expect(renderPanel(pendingPlan)).toContain("Pagamento em processamento");
    expect(renderPanel(canceledPlan)).toContain("Assinatura cancelada");
  });

  it("renders loading and error states", () => {
    const html = renderToStaticMarkup(
      createElement(AccountPlanPanel, {
        accountPlan: null,
        billingError: "",
        billingMessage: "",
        error: "Nao foi possivel carregar seu plano.",
        isCheckoutLoading: false,
        isLoading: true,
        onCheckoutPro: vi.fn(),
        onRetry: vi.fn(),
      }),
    );

    expect(html).toContain("Carregando plano");
    expect(html).toContain("Nao foi possivel carregar seu plano.");
  });

  it("renders checkout error feedback", () => {
    const html = renderPanel(freePlan, "", "Nao foi possivel iniciar a assinatura.");

    expect(html).toContain("Nao foi possivel iniciar a assinatura.");
  });
});
