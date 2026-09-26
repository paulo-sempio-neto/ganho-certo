import type { AccountPlanResponse } from "../../api/account";

type AccountPlanPanelProps = {
  accountPlan: AccountPlanResponse | null;
  billingError: string;
  billingMessage: string;
  error: string;
  isCheckoutLoading: boolean;
  isLoading: boolean;
  onCheckoutPro: () => void;
  onRetry: () => void;
};

const featureLabels: Record<string, string> = {
  advanced_history: "Historico avancado",
  csv_import: "Importacao CSV",
  financial_insights: "Inteligencia financeira",
};

function getFeatureLabel(featureCode: string): string {
  return featureLabels[featureCode] ?? featureCode.replaceAll("_", " ");
}

function getAvailableFeatures(accountPlan: AccountPlanResponse): string[] {
  const features = ["Controle financeiro diario"];
  const vehicleLimit = accountPlan.limits.vehicle_limit;

  if (vehicleLimit) {
    features.push(`Cadastro de ${vehicleLimit} veiculo${vehicleLimit > 1 ? "s" : ""}`);
  } else {
    features.push("Cadastro de veiculos");
  }

  for (const [featureCode, enabled] of Object.entries(accountPlan.features)) {
    if (enabled) {
      features.push(getFeatureLabel(featureCode));
    }
  }

  return features;
}

function getLockedFeatures(accountPlan: AccountPlanResponse): string[] {
  return Object.entries(accountPlan.features)
    .filter(([, enabled]) => !enabled)
    .map(([featureCode]) => getFeatureLabel(featureCode));
}

function getSubscriptionStatusLabel(accountPlan: AccountPlanResponse): string {
  const subscriptionStatus = accountPlan.subscription?.status.toLowerCase();

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "Plano Pro ativo";
  }

  if (subscriptionStatus === "pending") {
    return "Pagamento em processamento";
  }

  if (subscriptionStatus === "canceled" || subscriptionStatus === "cancelled") {
    return "Assinatura cancelada";
  }

  if (accountPlan.current_plan.code === "pro") {
    return "Plano Pro ativo";
  }

  return "Plano gratuito";
}

function shouldShowUpgradeButton(accountPlan: AccountPlanResponse): boolean {
  const subscriptionStatus = accountPlan.subscription?.status.toLowerCase();
  return accountPlan.current_plan.code === "free" && subscriptionStatus !== "pending";
}

export function AccountPlanPanel({
  accountPlan,
  billingError,
  billingMessage,
  error,
  isCheckoutLoading,
  isLoading,
  onCheckoutPro,
  onRetry,
}: AccountPlanPanelProps) {
  const lockedFeatures = accountPlan ? getLockedFeatures(accountPlan) : [];

  return (
    <section className="account-plan-panel" aria-live="polite">
      <div className="account-plan-header">
        <div>
          <p className="eyebrow">Meu Plano</p>
          <h3>Plano atual</h3>
        </div>
        {accountPlan ? (
          <span className="status-pill status-active">
            {accountPlan.current_plan.code.toUpperCase()}
          </span>
        ) : null}
      </div>

      {isLoading ? <p className="empty-state compact-empty-state">Carregando plano...</p> : null}

      {error ? (
        <div className="history-error">
          <p className="form-message compact-message">{error}</p>
          <button className="text-button" type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {accountPlan ? (
        <>
          <div className="plan-status-panel">
            <strong>{getSubscriptionStatusLabel(accountPlan)}</strong>
            {accountPlan.subscription?.period_end ? (
              <span>
                Valido ate{" "}
                {new Date(accountPlan.subscription.period_end).toLocaleDateString("pt-BR")}
              </span>
            ) : null}
          </div>

          <div className="plan-feature-group">
            <h4>Recursos disponiveis</h4>
            <ul className="plan-feature-list">
              {getAvailableFeatures(accountPlan).map((feature) => (
                <li key={feature}>
                  <span className="status-dot status-dot-active" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="plan-feature-group">
            <h4>Beneficios Pro</h4>
            {lockedFeatures.length > 0 ? (
              <ul className="plan-feature-list">
                {lockedFeatures.map((feature) => (
                  <li key={feature}>
                    <span className="status-dot status-dot-locked" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle-note">Todos os recursos Pro estao liberados neste plano.</p>
            )}
          </div>

          {shouldShowUpgradeButton(accountPlan) ? (
            <div className="plan-upgrade-panel">
              <p>
                Desbloqueie importacao CSV, historico avancado e inteligencia financeira.
              </p>
              <button
                className="button"
                disabled={isCheckoutLoading}
                type="button"
                onClick={onCheckoutPro}
              >
                {isCheckoutLoading ? "Redirecionando..." : "Assinar Pro"}
              </button>
            </div>
          ) : null}

          {billingMessage ? (
            <p className="success-message compact-message">{billingMessage}</p>
          ) : null}
          {billingError ? <p className="form-message compact-message">{billingError}</p> : null}
        </>
      ) : null}
    </section>
  );
}
