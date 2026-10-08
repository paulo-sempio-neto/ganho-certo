import type { ReactNode, Ref } from "react";
import type { ExpenseCategory } from "../../types/domain";
import type { FinancialStructuralCosts, FinancialSummary } from "../../types/financial";
import { formatDistance, formatWorkTime, formatDate } from "../../utils/formatters";
import { formatMoney } from "../../utils/money";

const structuralCostLabels: Array<{ key: keyof FinancialStructuralCosts; label: string }> = [
  { key: "ownership", label: "Aluguel/financiamento" },
  { key: "insurance", label: "Seguro" },
  { key: "ipva", label: "IPVA" },
  { key: "other_fixed", label: "Outros custos fixos" },
  { key: "maintenance", label: "Manutencao" },
  { key: "tires", label: "Pneus" },
  { key: "oil", label: "Oleo" },
  { key: "depreciation", label: "Depreciacao" },
];

type FinancialSummaryPanelProps = {
  summary: FinancialSummary;
  getExpenseCategoryLabel: (category: ExpenseCategory) => string;
  resultRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
};

function getMetricValue(value: string | null, formatter: (metric: string) => string): string {
  return value === null ? "—" : formatter(value);
}

function getChartRange(summary: FinancialSummary) {
  const values = summary.daily.flatMap((dailyItem) => [
    Number(dailyItem.gross_revenue),
    Number(dailyItem.expenses),
    Number(dailyItem.estimated_net_profit),
  ]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const zeroPosition = (Math.abs(min) / range) * 100;
  return { range, zeroPosition };
}

function getChartStyles(valueStr: string, range: number, zeroPosition: number) {
  const val = Number(valueStr);
  const percentage = (Math.abs(val) / range) * 100;
  if (val < 0) {
    return {
      width: `${percentage}%`,
      marginLeft: `${zeroPosition - percentage}%`,
      backgroundColor: 'var(--color-danger)'
    };
  }
  return {
    width: `${percentage}%`,
    marginLeft: `${zeroPosition}%`
  };
}

function isPositiveMoney(value: string): boolean {
  return Number(value) > 0;
}

function isNegativeMoney(value: string): boolean {
  return Number(value) < 0;
}

function getResultCardClass(value: string): string {
  return isNegativeMoney(value) ? "metric-card metric-negative" : "metric-card metric-profit";
}

function getStructuralCostItems(summary: FinancialSummary) {
  const totalStructuralCosts = Number(summary.estimated_structural_costs);

  return structuralCostLabels
    .map((item) => ({
      ...item,
      value: summary.structural_costs[item.key],
      percentage:
        totalStructuralCosts > 0
          ? Math.round((Number(summary.structural_costs[item.key]) / totalStructuralCosts) * 100)
          : null,
    }))
    .filter((item) => isPositiveMoney(item.value));
}

function getRecurringProjectionItems(summary: FinancialSummary) {
  return summary.recurring_expenses_breakdown.filter((item) => isPositiveMoney(item.amount));
}

export function FinancialSummaryPanel({
  summary,
  getExpenseCategoryLabel,
  resultRef,
  children,
}: FinancialSummaryPanelProps) {
  return (
    <>
      <div className="economic-panel" ref={resultRef}>
        <div className="section-title">
          <h3>Quanto sobrou?</h3>
          <p className="subtle-note">
            No período e veículo selecionados, considerando apenas os valores registrados.
          </p>
        </div>

        <div className="metric-grid result-summary-grid">
          <article className={`${getResultCardClass(summary.estimated_net_profit)} result-primary`} data-result-kind="realized">
            <span>Realizado</span>
            <h4 className="result-label">Sobra após gastos registrados</h4>
            <strong>{formatMoney(summary.estimated_net_profit)}</strong>
            <small>Faturamento menos os gastos que você já lançou.</small>
            <small>Esta sobra é parcial: despesas ainda não lançadas não foram descontadas.</small>
          </article>
          <article className={getResultCardClass(summary.estimated_economic_result)} data-result-kind="estimated">
            <span>Estimado</span>
            <h4 className="result-label">Resultado estimado</h4>
            <strong>{formatMoney(summary.estimated_economic_result)}</strong>
            <small>Considera os gastos lançados e os custos configurados do veículo, como seguro, manutenção e perda de valor, distribuídos pelo período ou pelos quilômetros rodados.</small>
            <small>Custos equivalentes não são contados duas vezes. Não é saldo disponível.</small>
            {!isPositiveMoney(summary.estimated_structural_costs) ? (
              <small>Sem custos estimados neste período. Confira o perfil do veículo.</small>
            ) : null}
          </article>
          <article className={getResultCardClass(summary.projected_economic_result)} data-result-kind="projected">
            <span>Projetado</span>
            <h4 className="result-label">Resultado projetado</h4>
            <strong>{formatMoney(summary.projected_economic_result)}</strong>
            <small>Parte do resultado estimado e desconta também as despesas recorrentes previstas para o período que ainda não foram consideradas no cálculo.</small>
            <small>Usa o mesmo faturamento registrado. Não é previsão de renda.</small>
            {isNegativeMoney(summary.projected_economic_result) ? (
              <small>Os custos projetados estão acima do faturamento registrado.</small>
            ) : null}
          </article>
        </div>

        <a className="dashboard-result-link" href="#detalhes-resultado">Ver detalhes do cálculo</a>

        {summary.daily.length === 0 ? (
          <p className="empty-state compact-empty-state">
            Nenhuma movimentação registrada neste período. Registre seu dia ou selecione um período
            com registros para acompanhar o resultado. <a href="#hoje">Registrar meu dia</a>
          </p>
        ) : null}
      </div>

      {children}

      <details className="result-details" id="detalhes-resultado">
        <summary>Detalhes do resultado: custos, desempenho e registros</summary>
        <div className="result-details-content">
          <details className="calculation-details">
            <summary>Ver como cada resultado é formado</summary>

            <div className="dashboard-layers">
              <article className="dashboard-layer">
                <p className="eyebrow">Realizado</p>
                <dl>
                  <div>
                    <dt>Faturamento</dt>
                    <dd>{formatMoney(summary.gross_revenue)}</dd>
                  </div>
                  <div>
                    <dt>Despesas registradas</dt>
                    <dd>{formatMoney(summary.total_expenses)}</dd>
                  </div>
                  <div>
                    <dt>Sobra após gastos registrados</dt>
                    <dd>{formatMoney(summary.estimated_net_profit)}</dd>
                  </div>
                </dl>
              </article>

              <article className="dashboard-layer">
                <p className="eyebrow">Estimado</p>
                <dl>
                  <div>
                    <dt>Custos estimados do veículo</dt>
                    <dd>{formatMoney(summary.estimated_structural_costs)}</dd>
                  </div>
                  <div>
                    <dt>Resultado estimado</dt>
                    <dd>{formatMoney(summary.estimated_economic_result)}</dd>
                  </div>
                  <div>
                    <dt>O que entra aqui</dt>
                    <dd>Custos configurados do veículo, distribuídos pelo período ou pelos quilômetros rodados.</dd>
                  </div>
                </dl>
              </article>

              <article className="dashboard-layer dashboard-layer-projected">
                <p className="eyebrow">Projetado</p>
                <dl>
                  <div>
                    <dt>Despesas recorrentes previstas</dt>
                    <dd>{formatMoney(summary.recurring_expenses_total)}</dd>
                  </div>
                  <div>
                    <dt>Custos projetados totais</dt>
                    <dd>{formatMoney(summary.projected_economic_costs)}</dd>
                  </div>
                  <div>
                    <dt>Resultado projetado após recorrências</dt>
                    <dd>{formatMoney(summary.projected_economic_result)}</dd>
                  </div>
                  <div>
                    <dt>O que entra aqui</dt>
                    <dd>Recorrências previstas para o período que ainda não foram consideradas no cálculo.</dd>
                  </div>
                </dl>
              </article>
            </div>

            <p className="subtle-note">
              Para evitar contar o mesmo custo duas vezes, os custos do perfil podem substituir
              gastos equivalentes no resultado estimado e no projetado. Os dois usam o faturamento
              registrado; não são valores disponíveis em caixa.
            </p>

            {!isPositiveMoney(summary.estimated_structural_costs) ? (
              <p className="empty-state">
                Sem custos estimados neste período. Confira os custos do veículo e os registros
                usados no cálculo.{" "}
                <a href="#veiculos">Conferir custos do veículo</a>
              </p>
            ) : null}
          </details>

          <div className="recurring-projection">
            <div className="list-header">
              <h3>Despesas recorrentes previstas</h3>
            </div>
            <p className="subtle-note">
              São gastos que se repetem e foram configurados para este período. O cálculo evita
              repetir custos equivalentes já registrados ou considerados no perfil do veículo.
            </p>

            {isPositiveMoney(summary.recurring_expenses_total) ? (
              <>
                <div className="recurring-projection-list">
                  {getRecurringProjectionItems(summary).map((item) => (
                    <article className="structural-item" key={item.category}>
                      <div>
                        <strong>{getExpenseCategoryLabel(item.category)}</strong>
                        <span>Previsto no periodo</span>
                      </div>
                      <strong>{formatMoney(item.amount)}</strong>
                    </article>
                  ))}
                </div>
                <article className="recurring-projection-total">
                  <span>Total previsto no periodo</span>
                  <strong>{formatMoney(summary.recurring_expenses_total)}</strong>
                </article>
              </>
            ) : (
              <p className="empty-state compact-empty-state">
                Sem despesas recorrentes previstas a descontar neste período. Confira as recorrências
                configuradas e os gastos já registrados.{" "}
                <a href="#despesas-recorrentes">Configurar despesas recorrentes</a>
              </p>
            )}
          </div>

          <div className="structural-breakdown">
            <div className="list-header">
              <div>
                <h3>Custos estimados do veículo</h3>
                <p className="subtle-note">
                  Custos configurados no perfil do veículo, como seguro, manutenção e perda de valor.
                  Eles são distribuídos pelo período ou pelos quilômetros rodados e não representam,
                  necessariamente, gastos pagos neste período.
                </p>
              </div>
            </div>

            {getStructuralCostItems(summary).length === 0 ? (
              <p className="empty-state">
                Nenhum custo estrutural estimado neste período. Confira os custos do veículo e os
                registros do período para entender esta estimativa.
              </p>
            ) : (
              <div className="structural-list">
                {getStructuralCostItems(summary).map((item) => (
                  <article className="structural-item" key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>
                        {item.percentage === null
                          ? "Participacao indisponivel"
                          : `${item.percentage}% dos custos estruturais`}
                      </span>
                    </div>
                    <strong>{formatMoney(item.value)}</strong>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="list-header">
            <div>
              <h3>Desempenho registrado</h3>
              <p className="subtle-note">
                Estas metricas descrevem os registros deste periodo e nao indicam a causa de uma
                mudanca.
              </p>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <span>Resultado bruto por hora</span>
              <strong>{getMetricValue(summary.gross_per_hour, formatMoney)}</strong>
              <small>Faturamento dividido pelas horas registradas.</small>
            </article>
            <article className="metric-card">
              <span>Resultado apos despesas por hora</span>
              <strong>{getMetricValue(summary.net_per_hour, formatMoney)}</strong>
              <small>Sobra após gastos registrados dividida pelas horas registradas.</small>
            </article>
            <article className="metric-card">
              <span>Resultado bruto por km</span>
              <strong>{getMetricValue(summary.gross_per_km, formatMoney)}</strong>
              <small>Faturamento dividido pelos km registrados.</small>
            </article>
            <article className="metric-card">
              <span>Resultado apos despesas por km</span>
              <strong>{getMetricValue(summary.net_per_km, formatMoney)}</strong>
              <small>Sobra após gastos registrados dividida pelos km registrados.</small>
            </article>
            <article className="metric-card">
              <span>Custo registrado por km</span>
              <strong>{getMetricValue(summary.expense_per_km, formatMoney)}</strong>
              <small>Despesas registradas divididas pelos km.</small>
            </article>
            <article className="metric-card">
              <span>Ticket médio</span>
              <strong>{getMetricValue(summary.average_ticket, formatMoney)}</strong>
              <small>Faturamento dividido pelas corridas registradas.</small>
            </article>
            <article className="metric-card">
              <span>Corridas registradas</span>
              <strong>{summary.total_trip_count}</strong>
            </article>
            <article className="metric-card">
              <span>Horas registradas</span>
              <strong>{formatWorkTime(summary.total_worked_minutes)}</strong>
            </article>
            <article className="metric-card">
              <span>Km registrados</span>
              <strong>{formatDistance(summary.total_distance_km)} km</strong>
            </article>
          </div>

          <div className="daily-breakdown">
            <div className="list-header">
              <h3>Evolução diária</h3>
            </div>

            {summary.daily.length === 0 ? (
              <p className="empty-state">Nenhuma movimentação neste período. Registre jornadas e gastos para acompanhar a evolução diária.</p>
            ) : (
              (() => {
                const { range, zeroPosition } = getChartRange(summary);
                return summary.daily.map((dailyItem) => {
                  return (
                    <article className="daily-row" key={dailyItem.date}>
                      <h4>{formatDate(dailyItem.date)}</h4>
                      <div className="bar-line" aria-label={`Faturamento: ${formatMoney(dailyItem.gross_revenue)}`}>
                        <span aria-hidden="true">Faturamento</span>
                        <div aria-hidden="true">
                          <i
                            style={getChartStyles(dailyItem.gross_revenue, range, zeroPosition)}
                          />
                        </div>
                        <strong aria-hidden="true">{formatMoney(dailyItem.gross_revenue)}</strong>
                      </div>
                      <div className="bar-line expense-bar" aria-label={`Despesas: ${formatMoney(dailyItem.expenses)}`}>
                        <span aria-hidden="true">Despesas</span>
                        <div aria-hidden="true">
                          <i
                            style={getChartStyles(dailyItem.expenses, range, zeroPosition)}
                          />
                        </div>
                        <strong aria-hidden="true">{formatMoney(dailyItem.expenses)}</strong>
                      </div>
                      <div className="bar-line profit-bar" aria-label={`Sobra registrada: ${formatMoney(dailyItem.estimated_net_profit)}`}>
                        <span aria-hidden="true">Sobra registrada</span>
                        <div aria-hidden="true">
                          <i
                            className={isNegativeMoney(dailyItem.estimated_net_profit) ? "negative-bar" : ""}
                            style={getChartStyles(dailyItem.estimated_net_profit, range, zeroPosition)}
                          />
                        </div>
                        <strong aria-hidden="true">{formatMoney(dailyItem.estimated_net_profit)}</strong>
                      </div>
                    </article>
                  );
                });
              })()
            )}
          </div>
        </div>
      </details>
    </>
  );
}
