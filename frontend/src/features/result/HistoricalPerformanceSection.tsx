import { useState } from "react";

import type {
  FinancialHistoryGrouping,
  HistoryChartMetric,
  HistoryPeriodPreset,
  Vehicle,
} from "../../types/domain";
import type {
  FinancialHistoryMetricComparison,
  FinancialHistoryPeriod,
  FinancialHistoryResponse,
  FinancialHistoryTrendFact,
} from "../../types/financial";
import {
  formatDate,
  formatDistance,
  formatPercent,
  formatWorkTime,
} from "../../utils/formatters";
import { formatMoney, formatMoneyPerKm } from "../../utils/money";

const historyPeriodOptions: Array<{ label: string; value: HistoryPeriodPreset }> = [
  { label: "7 dias", value: "last7" },
  { label: "30 dias", value: "last30" },
  { label: "90 dias", value: "last90" },
  { label: "Este mês", value: "month" },
  { label: "Personalizado", value: "custom" },
];

const historyGroupingOptions: Array<{ label: string; value: FinancialHistoryGrouping }> = [
  { label: "Dia", value: "daily" },
  { label: "Semana", value: "weekly" },
  { label: "Mês", value: "monthly" },
];

const historyChartMetricOptions: Array<{ label: string; value: HistoryChartMetric }> = [
  { label: "Resultado estimado", value: "estimated_result" },
  { label: "R$/hora", value: "estimated_result_per_hour" },
  { label: "R$/km", value: "estimated_result_per_km" },
];

type HistoricalPerformanceSectionProps = {
  history: FinancialHistoryResponse | null;
  isLoading: boolean;
  error: string;
  vehicles: Vehicle[];
  period: HistoryPeriodPreset;
  startDate: string;
  endDate: string;
  grouping: FinancialHistoryGrouping;
  vehicleId: string;
  onPeriodChange: (period: HistoryPeriodPreset) => void;
  onDateChange: (field: "start" | "end", value: string) => void;
  onGroupingChange: (grouping: FinancialHistoryGrouping) => void;
  onVehicleChange: (vehicleId: string) => void;
  onRetry: () => void;
  getVehicleLabel: (vehicleId: number) => string;
};

function getMetricValue(value: string | null, formatter: (metric: string) => string): string {
  return value === null ? "—" : formatter(value);
}

function getHistoryMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    gross_revenue: "Faturamento",
    registered_expenses: "Gastos",
    estimated_result: "Resultado estimado",
    projected_result: "Resultado projetado",
    worked_minutes: "Tempo trabalhado",
    distance_km: "Km rodados",
    estimated_result_per_hour: "Resultado por hora",
    estimated_result_per_km: "Resultado por km",
  };

  return labels[metric] ?? metric;
}

function formatHistoryMoneyPerHour(value: string): string {
  return `${formatMoney(value)}/h`;
}

function formatHistoryMetricValue(metric: string, value: string | null): string {
  if (value === null) {
    return "—";
  }

  if (metric === "worked_minutes") {
    return formatWorkTime(Math.round(Number(value)));
  }

  if (metric === "distance_km") {
    return `${formatDistance(value)} km`;
  }

  if (metric.endsWith("_per_km")) {
    return formatMoneyPerKm(value);
  }

  if (metric.endsWith("_per_hour")) {
    return formatHistoryMoneyPerHour(value);
  }

  return formatMoney(value);
}

function getHistoryChartMetricLabel(metric: HistoryChartMetric): string {
  return historyChartMetricOptions.find((option) => option.value === metric)?.label ?? metric;
}

function getHistoryChartValue(
  period: FinancialHistoryPeriod,
  chartMetric: HistoryChartMetric,
): number {
  const rawValue = period[chartMetric];
  if (rawValue === null) {
    return 0;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatHistoryChartValue(value: string | null, chartMetric: HistoryChartMetric): string {
  if (chartMetric === "estimated_result_per_hour") {
    return getMetricValue(value, formatHistoryMoneyPerHour);
  }

  if (chartMetric === "estimated_result_per_km") {
    return getMetricValue(value, formatMoneyPerKm);
  }

  return getMetricValue(value, formatMoney);
}

function hasHistoryData(history: FinancialHistoryResponse): boolean {
  return history.periods.some(
    (period) =>
      Number(period.gross_revenue) !== 0 ||
      Number(period.registered_expenses) !== 0 ||
      Number(period.estimated_structural_costs) !== 0 ||
      Number(period.recurring_projected_expenses) !== 0 ||
      period.worked_minutes > 0 ||
      Number(period.distance_km) > 0 ||
      period.trip_count > 0,
  );
}

function hasPreviousComparisonData(history: FinancialHistoryResponse): boolean {
  return [
    history.comparison.gross_revenue.previous,
    history.comparison.registered_expenses.previous,
    history.comparison.estimated_result.previous,
    history.comparison.projected_result.previous,
    history.comparison.worked_minutes.previous,
    history.comparison.distance_km.previous,
  ].some((value) => value !== null && Number(value) !== 0);
}

function getComparisonDirectionLabel(comparison: FinancialHistoryMetricComparison): string {
  if (comparison.absolute_delta === null || Number(comparison.absolute_delta) === 0) {
    return "sem mudança";
  }

  return Number(comparison.absolute_delta) > 0 ? "aumentou" : "diminuiu";
}

function getComparisonSummary(metric: string, comparison: FinancialHistoryMetricComparison) {
  if (comparison.current === null || comparison.previous === null) {
    return "Comparação indisponível para esta métrica.";
  }

  const direction = getComparisonDirectionLabel(comparison);
  const percent =
    comparison.percentage_delta === null ? "" : ` ${formatPercent(comparison.percentage_delta)}`;
  return `${getHistoryMetricLabel(metric)} ${direction}${percent}.`;
}

function getHistoryTrendMessage(fact: FinancialHistoryTrendFact): string {
  const direction = fact.direction === "increased" ? "aumentou" : "diminuiu";
  const metric = getHistoryMetricLabel(fact.metric).toLowerCase();

  if (fact.direction === "unchanged") {
    return `${getHistoryMetricLabel(fact.metric)} ficou estável.`;
  }

  if (fact.metric === "registered_expenses") {
    return `Seus gastos ${
      fact.direction === "increased" ? "ficaram maiores" : "ficaram menores"
    } que no período anterior.`;
  }

  if (fact.metric === "worked_minutes") {
    return `Você trabalhou ${
      fact.direction === "increased" ? "mais" : "menos"
    } horas neste período.`;
  }

  return `Seu ${metric} ${direction}.`;
}

function getHistoryPeriodLabel(period: FinancialHistoryPeriod): string {
  if (period.period_start === period.period_end) {
    return formatDate(period.period_start);
  }

  return `${formatDate(period.period_start)}–${formatDate(period.period_end)}`;
}

export function HistoricalPerformanceSection({
  history,
  isLoading,
  error,
  vehicles,
  period,
  startDate,
  endDate,
  grouping,
  vehicleId,
  onPeriodChange,
  onDateChange,
  onGroupingChange,
  onVehicleChange,
  onRetry,
  getVehicleLabel,
}: HistoricalPerformanceSectionProps) {
  const [chartMetric, setChartMetric] = useState<HistoryChartMetric>("estimated_result");
  const comparisonItems: Array<{
    metric: string;
    comparison: FinancialHistoryMetricComparison;
  }> = history
    ? [
        { metric: "estimated_result", comparison: history.comparison.estimated_result },
        {
          metric: "estimated_result_per_hour",
          comparison: history.comparison.estimated_result_per_hour,
        },
        {
          metric: "estimated_result_per_km",
          comparison: history.comparison.estimated_result_per_km,
        },
        {
          metric: "registered_expenses",
          comparison: history.comparison.registered_expenses,
        },
      ]
    : [];
  const chartPeriods = history?.periods ?? [];
  const chartValues = chartPeriods.map((chartPeriod) =>
    getHistoryChartValue(chartPeriod, chartMetric),
  );
  const chartMin = Math.min(0, ...chartValues);
  const chartMax = Math.max(0, ...chartValues);
  const chartRange = chartMax === chartMin ? 1 : chartMax - chartMin;
  const chartWidth = 320;
  const chartHeight = 150;
  const chartTop = 16;
  const chartBottom = 118;
  const chartInnerHeight = chartBottom - chartTop;
  const chartXStep = chartPeriods.length <= 1 ? 0 : 260 / (chartPeriods.length - 1);
  const chartPoints = chartValues
    .map((value, index) => {
      const x = 30 + index * chartXStep;
      const y = chartTop + ((chartMax - value) / chartRange) * chartInnerHeight;
      return `${x},${y}`;
    })
    .join(" ");
  const chartZeroY = chartTop + ((chartMax - 0) / chartRange) * chartInnerHeight;

  return (
    <div className="financial-history" id="evolucao">
      <div className="section-title">
        <p className="eyebrow">EvoluÃ§Ã£o</p>
        <h3>Como seu resultado esta mudando?</h3>
        <p className="subtle-note">
          Veja como seus ganhos e sua eficiÃªncia estÃ£o mudando com o tempo.
        </p>
      </div>

      <div className="dashboard-filters history-filters">
        <label>
          PerÃ­odo
          <select
            onChange={(event) => onPeriodChange(event.target.value as HistoryPeriodPreset)}
            value={period}
          >
            {historyPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {period === "custom" ? (
          <>
            <label>
              InÃ­cio
              <input
                onChange={(event) => onDateChange("start", event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
            <label>
              Fim
              <input
                onChange={(event) => onDateChange("end", event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
          </>
        ) : null}

        {vehicles.length > 1 ? (
          <label>
            VeÃ­culo
            <select onChange={(event) => onVehicleChange(event.target.value)} value={vehicleId}>
              <option value="">Todos os veÃ­culos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.brand} {vehicle.model}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="history-single-vehicle">
            {vehicles[0] ? getVehicleLabel(vehicles[0].id) : "Todos os veÃ­culos"}
          </p>
        )}

        <label>
          Agrupar por
          <select
            onChange={(event) => onGroupingChange(event.target.value as FinancialHistoryGrouping)}
            value={grouping}
          >
            {historyGroupingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="empty-state compact-empty-state">Carregando evoluÃ§Ã£o...</p>
      ) : null}

      {error ? (
        <div className="history-error">
          <p className="form-message compact-message">{error}</p>
          <button className="text-button" type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!isLoading && !error && history ? (
        hasHistoryData(history) ? (
          <>
            <div className="history-comparison">
              <div className="list-header">
                <div>
                  <h3>Como vocÃª estÃ¡ em relaÃ§Ã£o ao perÃ­odo anterior?</h3>
                  {!hasPreviousComparisonData(history) ? (
                    <p className="subtle-note">
                      Continue registrando seus dias para comparar sua evoluÃ§Ã£o com perÃ­odos
                      anteriores.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="metric-grid history-comparison-grid">
                {comparisonItems.map(({ metric, comparison }) => (
                  <article className="metric-card history-comparison-card" key={metric}>
                    <span>{getHistoryMetricLabel(metric)}</span>
                    <strong>{formatHistoryMetricValue(metric, comparison.current)}</strong>
                    <small>Anterior: {formatHistoryMetricValue(metric, comparison.previous)}</small>
                    <small>{getComparisonSummary(metric, comparison)}</small>
                  </article>
                ))}
              </div>
            </div>

            {history.trend_facts.length > 0 ? (
              <div className="history-facts">
                {history.trend_facts.map((fact) => (
                  <article className="financial-insight financial-insight-info" key={fact.metric}>
                    <strong>{getHistoryMetricLabel(fact.metric)}</strong>
                    <p>{getHistoryTrendMessage(fact)}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="history-chart-panel">
              <div className="list-header">
                <div>
                  <h3>{getHistoryChartMetricLabel(chartMetric)}</h3>
                  <p className="subtle-note">
                    Uma visÃ£o simples da evoluÃ§Ã£o no perÃ­odo selecionado.
                  </p>
                  <p className="subtle-note">
                    Faixa: {formatHistoryChartValue(chartMin.toFixed(2), chartMetric)} a{" "}
                    {formatHistoryChartValue(chartMax.toFixed(2), chartMetric)}
                  </p>
                </div>
                <label>
                  MÃ©trica
                  <select
                    onChange={(event) => setChartMetric(event.target.value as HistoryChartMetric)}
                    value={chartMetric}
                  >
                    {historyChartMetricOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="history-chart" aria-label="GrÃ¡fico de evoluÃ§Ã£o">
                <svg role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                  <line
                    className="history-chart-zero"
                    x1="24"
                    x2="304"
                    y1={chartZeroY}
                    y2={chartZeroY}
                  />
                  {chartPoints ? <polyline className="history-chart-line" points={chartPoints} /> : null}
                  {chartValues.map((value, index) => {
                    const x = 30 + index * chartXStep;
                    const y = chartTop + ((chartMax - value) / chartRange) * chartInnerHeight;
                    return (
                      <circle
                        className="history-chart-point"
                        cx={x}
                        cy={y}
                        key={`${chartPeriods[index]?.period_start}-${index}`}
                        r="3.5"
                      />
                    );
                  })}
                </svg>
                <div className="history-chart-labels">
                  {chartPeriods.map((chartPeriod) => (
                    <span key={`${chartPeriod.period_start}-${chartPeriod.period_end}`}>
                      {getHistoryPeriodLabel(chartPeriod)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <details className="calculation-details history-details">
              <summary>Ver detalhes por perÃ­odo</summary>
              <div className="history-period-list">
                {history.periods.map((historyPeriod) => (
                  <article
                    className="dashboard-layer history-period-card"
                    key={`${historyPeriod.period_start}-${historyPeriod.period_end}`}
                  >
                    <h4>{getHistoryPeriodLabel(historyPeriod)}</h4>
                    <dl>
                      <div>
                        <dt>Faturamento</dt>
                        <dd>{formatMoney(historyPeriod.gross_revenue)}</dd>
                      </div>
                      <div>
                        <dt>Gastos</dt>
                        <dd>{formatMoney(historyPeriod.registered_expenses)}</dd>
                      </div>
                      <div>
                        <dt>Resultado estimado</dt>
                        <dd>{formatMoney(historyPeriod.estimated_result)}</dd>
                      </div>
                      <div>
                        <dt>Horas trabalhadas</dt>
                        <dd>{formatWorkTime(historyPeriod.worked_minutes)}</dd>
                      </div>
                      <div>
                        <dt>Km rodados</dt>
                        <dd>{formatDistance(historyPeriod.distance_km)} km</dd>
                      </div>
                      <div>
                        <dt>R$/hora</dt>
                        <dd>
                          {getMetricValue(
                            historyPeriod.estimated_result_per_hour,
                            formatHistoryMoneyPerHour,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>R$/km</dt>
                        <dd>
                          {getMetricValue(historyPeriod.estimated_result_per_km, formatMoneyPerKm)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div className="empty-state history-empty-state">
            <p>VocÃª ainda nÃ£o tem dados suficientes para acompanhar sua evoluÃ§Ã£o.</p>
            <a className="button button-primary" href="#quick-start">
              Registrar meu dia
            </a>
          </div>
        )
      ) : null}
    </div>
  );
}
