import type { FinancialInsight } from "../../types/financial";

type InsightsPanelProps = {
  insights: FinancialInsight[];
  isLoading: boolean;
  error: string;
  onRetry: () => void;
};

export function InsightsPanel({ insights, isLoading, error, onRetry }: InsightsPanelProps) {
  const visibleInsights = insights.slice(0, 5);

  return (
    <div className="financial-insights" id="insights">
      <div className="list-header">
        <h3>Insights do seu periodo</h3>
      </div>

      {isLoading ? <p className="empty-state compact-empty-state">Carregando insights...</p> : null}
      {error ? (
        <div className="history-error">
          <p className="form-message compact-message">{error}</p>
          <button className="text-button" disabled={isLoading} type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!isLoading && !error ? (
        visibleInsights.length > 0 ? (
          <div className="financial-insights-list">
            {visibleInsights.map((insight) => (
              <article
                className={`financial-insight financial-insight-${insight.type}`}
                key={insight.code}
              >
                <strong>{insight.title}</strong>
                <p>{insight.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state compact-empty-state">
            Ainda não há dados suficientes para gerar insights deste período.
          </p>
        )
      ) : null}
    </div>
  );
}
