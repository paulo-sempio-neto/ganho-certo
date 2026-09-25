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
};

function getMetricValue(value: string | null, formatter: (metric: string) => string): string {
  return value === null ? "—" : formatter(value);
}

function getChartValue(value: string): number {
  return Math.max(0, Number(value));
}

function getChartMax(summary: FinancialSummary): number {
  const values = summary.daily.flatMap((dailyItem) => [
    getChartValue(dailyItem.gross_revenue),
    getChartValue(dailyItem.expenses),
    getChartValue(dailyItem.estimated_net_profit),
  ]);
  return Math.max(...values, 1);
}

function isPositiveMoney(value: string): boolean {
  return Number(value) > 0;
}

function isNegativeMoney(value: string): boolean {
  return Number(value) < 0;
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
}: FinancialSummaryPanelProps) {
  return (
    <>
      <div className="economic-panel">
        <div className="section-title">
          <p className="eyebrow">Resultado</p>
          <h3>Quanto realmente esta sobrando?</h3>
          <p className="subtle-note">
            Primeiro veja a sobra do caixa e o impacto estimado do veículo. Os detalhes continuam
            disponíveis abaixo.
          </p>
        </div>

        <div className="metric-grid result-summary-grid">
          <article className="metric-card metric-profit">
            <span>Sobrou no caixa</span>
            <strong>{formatMoney(summary.estimated_net_profit)}</strong>
            <small>Faturamento menos despesas registradas.</small>
          </article>
          <article className="metric-card metric-expense">
            <span>Custos estimados do veículo</span>
            <strong>{formatMoney(summary.estimated_structural_costs)}</strong>
            <small>Custos configurados que nem sempre aparecem como gasto do dia.</small>
          </article>
          <article
            className={
              isNegativeMoney(summary.estimated_economic_result)
                ? "metric-card metric-negative"
                : "metric-card metric-profit"
            }
          >
            <span>Resultado estimado</span>
            <strong>{formatMoney(summary.estimated_economic_result)}</strong>
            <small>Depois de considerar os custos estimados do veículo.</small>
          </article>
        </div>

        <details className="calculation-details">
          <summary>Ver detalhes do cálculo</summary>

          <article
            className={
              isNegativeMoney(summary.projected_economic_result)
                ? "metric-card projected-result-card metric-negative"
                : "metric-card projected-result-card metric-profit"
            }
          >
            <span>Resultado projetado</span>
            <strong>{formatMoney(summary.projected_economic_result)}</strong>
            <small>
              Considera despesas registradas, custos estruturais configurados e despesas recorrentes
              previstas para o periodo.
            </small>
            {isNegativeMoney(summary.projected_economic_result) ? (
              <small>
                Neste periodo, seus custos projetados estao acima do faturamento registrado.
              </small>
            ) : null}
          </article>

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
                  <dt>Sobra apos despesas</dt>
                  <dd>{formatMoney(summary.estimated_net_profit)}</dd>
                </div>
              </dl>
            </article>

            <article className="dashboard-layer">
              <p className="eyebrow">Estimado</p>
              <dl>
                <div>
                  <dt>Custos estruturais estimados</dt>
                  <dd>{formatMoney(summary.estimated_structural_costs)}</dd>
                </div>
                <div>
                  <dt>Resultado economico estimado</dt>
                  <dd>{formatMoney(summary.estimated_economic_result)}</dd>
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
                  <dt>Resultado projetado apos recorrencias</dt>
                  <dd>{formatMoney(summary.projected_economic_result)}</dd>
                </div>
              </dl>
            </article>
          </div>

          {!isPositiveMoney(summary.estimated_structural_costs) ? (
            <p className="empty-state">
              Configure os custos do veiculo para obter uma estimativa economica mais completa.{" "}
              <a href="#veiculos">Ir para Veiculos</a>
            </p>
          ) : null}
        </details>
      </div>

      <div className="recurring-projection">
        <div className="list-header">
          <h3>Despesas recorrentes previstas</h3>
        </div>
        <p className="subtle-note">
          Despesas recorrentes sao projecoes baseadas nos custos que voce configurou. Quando uma
          despesa real equivalente ja esta registrada, o GanhoCerto evita contar o mesmo custo duas
          vezes.
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
            Voce ainda nao possui despesas recorrentes previstas neste periodo.{" "}
            <a href="#despesas-recorrentes">Configurar despesas recorrentes</a>
          </p>
        )}
      </div>

      <div className="structural-breakdown">
        <div className="list-header">
          <h3>Para onde seu dinheiro esta indo?</h3>
        </div>

        {getStructuralCostItems(summary).length === 0 ? (
          <p className="empty-state">Nenhum custo estrutural estimado para o periodo selecionado.</p>
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

      <div className="metric-grid">
        <article className="metric-card">
          <span>Ganho bruto por hora</span>
          <strong>{getMetricValue(summary.gross_per_hour, formatMoney)}</strong>
        </article>
        <article className="metric-card">
          <span>Ganho líquido por hora</span>
          <strong>{getMetricValue(summary.net_per_hour, formatMoney)}</strong>
        </article>
        <article className="metric-card">
          <span>Ganho bruto por km</span>
          <strong>{getMetricValue(summary.gross_per_km, formatMoney)}</strong>
        </article>
        <article className="metric-card">
          <span>Ganho líquido por km</span>
          <strong>{getMetricValue(summary.net_per_km, formatMoney)}</strong>
        </article>
        <article className="metric-card">
          <span>Custo por km</span>
          <strong>{getMetricValue(summary.expense_per_km, formatMoney)}</strong>
        </article>
        <article className="metric-card">
          <span>Ticket médio</span>
          <strong>{getMetricValue(summary.average_ticket, formatMoney)}</strong>
        </article>
        <article className="metric-card">
          <span>Total de corridas</span>
          <strong>{summary.total_trip_count}</strong>
        </article>
        <article className="metric-card">
          <span>Horas trabalhadas</span>
          <strong>{formatWorkTime(summary.total_worked_minutes)}</strong>
        </article>
        <article className="metric-card">
          <span>Km rodados</span>
          <strong>{formatDistance(summary.total_distance_km)} km</strong>
        </article>
      </div>

      <div className="daily-breakdown">
        <div className="list-header">
          <h3>Evolução diária</h3>
        </div>

        {summary.daily.length === 0 ? (
          <p className="empty-state">Nenhum dado no período selecionado.</p>
        ) : (
          summary.daily.map((dailyItem) => {
            const chartMax = getChartMax(summary);
            return (
              <article className="daily-row" key={dailyItem.date}>
                <h4>{formatDate(dailyItem.date)}</h4>
                <div className="bar-line">
                  <span>Faturamento</span>
                  <div>
                    <i
                      style={{
                        width: `${(getChartValue(dailyItem.gross_revenue) / chartMax) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{formatMoney(dailyItem.gross_revenue)}</strong>
                </div>
                <div className="bar-line expense-bar">
                  <span>Despesas</span>
                  <div>
                    <i
                      style={{
                        width: `${(getChartValue(dailyItem.expenses) / chartMax) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{formatMoney(dailyItem.expenses)}</strong>
                </div>
                <div className="bar-line profit-bar">
                  <span>Resultado est.</span>
                  <div>
                    <i
                      style={{
                        width: `${
                          (getChartValue(dailyItem.estimated_net_profit) / chartMax) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <strong>{formatMoney(dailyItem.estimated_net_profit)}</strong>
                </div>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
