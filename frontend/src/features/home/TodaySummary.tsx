import { FeedbackMessage } from "../../components/FeedbackMessage";
import type { FinancialDailySummary, FinancialGoal, FinancialGoalProgress } from "../../types/financial";
import { formatDate, formatPercent, getProgressWidth } from "../../utils/formatters";
import { formatMoney, moneyValueToCents } from "../../utils/money";
import { getGoalCurrentValueLabel } from "../goals/goalMessages";

type TodaySummaryProps = {
  date: string;
  daily: FinancialDailySummary | null;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  onRegister: () => void;
  onAddExpense: () => void;
  isRegisterOpen: boolean;
  isExpenseOpen: boolean;
  goal: {
    goal: FinancialGoal;
    progress: FinancialGoalProgress;
    vehicleLabel: string | null;
  } | null;
  isGoalLoading: boolean;
};

export function TodaySummary({
  date,
  daily,
  isLoading,
  error,
  onRetry,
  onRegister,
  onAddExpense,
  isRegisterOpen,
  isExpenseOpen,
  goal,
  isGoalLoading,
}: TodaySummaryProps) {
  const day = daily?.date === date ? daily : null;
  const isNegative = day !== null && moneyValueToCents(day.estimated_net_profit) < 0n;
  const goalProgressWidth = getProgressWidth(goal?.progress.progress_percentage ?? null);

  return (
    <section
      className="today-summary"
      id="today-summary"
      tabIndex={-1}
      aria-labelledby="today-summary-title"
    >
      <div className="section-title">
        <h2 id="today-summary-title">Hoje</h2>
        <p className="subtle-note">{formatDate(date)} · Todos os veículos</p>
      </div>

      {isLoading ? (
        <FeedbackMessage kind="loading" compact>Carregando o resumo do dia...</FeedbackMessage>
      ) : error ? (
        <div>
          <FeedbackMessage kind="error" compact>{error}</FeedbackMessage>
          <button className="button button-secondary" type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {day === null ? (
            <p className="empty-state compact-empty-state">
              Nenhum registro neste dia. Registre seu dia ou adicione um gasto para acompanhar os valores.
            </p>
          ) : null}
          <div className="metric-grid today-summary-metrics">
            <article
              className={`metric-card ${isNegative ? "metric-negative" : "metric-profit"} result-primary`}
              data-result-kind="realized"
            >
              <span>Sobra após despesas registradas</span>
              <strong>{day === null ? "—" : formatMoney(day.estimated_net_profit)}</strong>
              <small>Gastos ainda não registrados não estão descontados.</small>
            </article>
            <article className="metric-card">
              <span>Faturamento</span>
              <strong>{day === null ? "—" : formatMoney(day.gross_revenue)}</strong>
            </article>
            <article className="metric-card">
              <span>Gastos registrados</span>
              <strong>{day === null ? "—" : formatMoney(day.expenses)}</strong>
            </article>
          </div>
        </>
      )}

      <div className="today-summary-actions">
        <button
          className="button"
          type="button"
          onClick={onRegister}
          aria-expanded={isRegisterOpen}
          aria-controls="daily-entry-panel"
        >
          Registrar dia
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onAddExpense}
          aria-expanded={isExpenseOpen}
          aria-controls="daily-expense-form"
        >
          Adicionar gasto
        </button>
      </div>

      {!isLoading && !error ? (
        isGoalLoading ? (
          <FeedbackMessage kind="loading" compact>Carregando a meta aplicável...</FeedbackMessage>
        ) : goal ? (
          <div className="goal-progress-panel">
            <h3>
              Meta do período · {formatDate(goal.goal.start_date)}–{formatDate(goal.goal.end_date)}
            </h3>
            <p className="subtle-note">{goal.vehicleLabel ?? "Todos os veículos"}</p>
            <div className="goal-progress-main">
              <span>{getGoalCurrentValueLabel(goal.goal.goal_type)}</span>
              <strong>
                {formatMoney(goal.progress.current_amount)} de {formatMoney(goal.progress.target_amount)}
              </strong>
              <small>{formatPercent(goal.progress.progress_percentage)} da meta no período.</small>
            </div>
            <div
              className="goal-progress-bar"
              role="progressbar"
              aria-label="Progresso da meta no período"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number.parseFloat(goalProgressWidth)}
              aria-valuetext={`${formatPercent(goal.progress.progress_percentage)} da meta no período`}
            >
              <i style={{ width: goalProgressWidth }} />
            </div>
            <a href="#metas">Ver metas</a>
          </div>
        ) : null
      ) : null}
    </section>
  );
}
