import { FeedbackMessage } from "../../components/FeedbackMessage";
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
  financial_insights: "Insights financeiros",
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
    features.push("Cadastro de veiculos sem limite");
  }

  for (const [featureCode, enabled] of Object.entries(accountPlan.features)) {
    if (enabled) {
      features.push(getFeatureLabel(featureCode));
    }
  }

  return features;
}

function getLockedFeatures(accountPlan: AccountPlanResponse): string[] {
  const lockedFeatures = Object.entries(accountPlan.features)
    .filter(([, enabled]) => !enabled)
    .map(([featureCode]) => getFeatureLabel(featureCode));

  if (accountPlan.limits.vehicle_limit) {
    lockedFeatures.unshift("Cadastro de veiculos sem limite");
  }

  return lockedFeatures;
}

function getSubscriptionStatusMessage(accountPlan: AccountPlanResponse): string | null {
  const subscriptionStatus = accountPlan.subscription?.status.toLowerCase();

  if (subscriptionStatus === "pending") {
    return "O pagamento ainda esta sendo confirmado. O acesso Pro sera liberado somente apos a confirmacao.";
  }

  if (subscriptionStatus === "canceled" || subscriptionStatus === "cancelled") {
    return "A assinatura nao esta ativa e seus recursos permanecem no plano gratuito. Voce pode tentar novamente.";
  }

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "Pagamento confirmado. Os recursos Pro estao liberados enquanto a assinatura estiver ativa.";
  }

  return null;
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
  const subscriptionStatusMessage = accountPlan
    ? getSubscriptionStatusMessage(accountPlan)
    : null;

  return (
    <section className="account-plan-panel">
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

      {isLoading ? <FeedbackMessage kind="loading" compact>Carregando plano...</FeedbackMessage> : null}

      {error ? (
        <div className="history-error">
          <FeedbackMessage kind="error" compact>{error}</FeedbackMessage>
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
            {subscriptionStatusMessage ? <span>{subscriptionStatusMessage}</span> : null}
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
            <h4>{lockedFeatures.length > 0 ? "Disponivel no Pro" : "Recursos Pro"}</h4>
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
                Seu plano gratuito continua disponivel. No Pro, voce libera {lockedFeatures.join(
                  ", ",
                )}.
              </p>
              <p className="subtle-note">
                O acesso Pro so e ativado depois que o pagamento for confirmado.
              </p>
              <button
                className="button"
                disabled={isCheckoutLoading}
                type="button"
                onClick={onCheckoutPro}
              >
                {isCheckoutLoading ? "Abrindo pagamento..." : "Continuar para pagamento"}
              </button>
            </div>
          ) : null}

          {billingMessage ? (
            <FeedbackMessage kind="success" compact>{billingMessage}</FeedbackMessage>
          ) : null}
          {billingError ? <FeedbackMessage kind="error" compact>{billingError}</FeedbackMessage> : null}
        </>
      ) : null}
    </section>
  );
}
