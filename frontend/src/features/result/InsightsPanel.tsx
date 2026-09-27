import { FeedbackMessage } from "../../components/FeedbackMessage";
import type { FinancialInsight } from "../../types/financial";

type InsightsPanelProps = {
  insights: FinancialInsight[];
  isLoading: boolean;
  error: string;
  onRetry: () => void;
};

const insightPriority: Record<string, number> = {
  gross_revenue_change: 10,
  net_result_change: 10,
  net_per_hour_change: 10,
  weekly_performance_summary: 20,
  activity_consistency: 30,
  net_per_hour: 40,
  net_per_km: 40,
  best_weekday: 40,
  best_day: 40,
  expense_share: 50,
  top_expense_category: 50,
};

function prioritizeInsights(insights: FinancialInsight[]): FinancialInsight[] {
  return insights
    .map((insight, index) => ({ insight, index }))
    .sort(
      (left, right) =>
        (insightPriority[left.insight.code] ?? 100) -
          (insightPriority[right.insight.code] ?? 100) ||
        left.index - right.index,
    )
    .map(({ insight }) => insight);
}

function getInsightDataLabel(code: string): string | null {
  if (code === "expense_share" || code === "top_expense_category") {
    return "Despesas registradas";
  }

  if (
    code === "gross_revenue_change" ||
    code === "net_result_change" ||
    code === "net_per_hour_change"
  ) {
    return "Comparacao entre periodos";
  }

  return "Dados registrados";
}

export function InsightsPanel({ insights, isLoading, error, onRetry }: InsightsPanelProps) {
  const visibleInsights = prioritizeInsights(insights).slice(0, 6);

  return (
    <div className="financial-insights" id="insights">
      <div className="list-header">
        <div>
          <h3>Insights do seu periodo</h3>
          <p className="subtle-note">Resumo descritivo dos dados registrados neste periodo.</p>
        </div>
      </div>

      {isLoading ? <FeedbackMessage kind="loading" compact>Carregando insights...</FeedbackMessage> : null}
      {error ? (
        <div className="history-error">
          <FeedbackMessage kind="error" compact>{error}</FeedbackMessage>
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
                {getInsightDataLabel(insight.code) ? (
                  <span className="financial-insight-label">
                    {getInsightDataLabel(insight.code)}
                  </span>
                ) : null}
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
