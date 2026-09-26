import type { AccountPlanResponse } from "../../api/account";

type AccountPlanPanelProps = {
  accountPlan: AccountPlanResponse | null;
  error: string;
  isLoading: boolean;
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

export function AccountPlanPanel({
  accountPlan,
  error,
  isLoading,
  onRetry,
}: AccountPlanPanelProps) {
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
            <h4>Recursos Pro</h4>
            {getLockedFeatures(accountPlan).length > 0 ? (
              <ul className="plan-feature-list">
                {getLockedFeatures(accountPlan).map((feature) => (
                  <li key={feature}>
                    <span className="status-dot status-dot-locked" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle-note">Nenhum recurso bloqueado neste plano.</p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
