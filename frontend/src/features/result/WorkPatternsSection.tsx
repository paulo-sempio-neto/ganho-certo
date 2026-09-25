import { useEffect, useState } from "react";

import { getWorkPatterns } from "../../api/financial";
import type { Vehicle } from "../../types/domain";
import type {
  WorkPatternObservation,
  WorkPatternsResponse,
  WorkPatternWeekdayPerformance,
} from "../../types/financial";
import { addDays, toDateInputValue } from "../../utils/dates";
import { formatDistance, formatWorkTime } from "../../utils/formatters";
import { formatMoney, formatMoneyPerKm } from "../../utils/money";

type PatternPeriodPreset = "last30" | "last60" | "last90" | "custom";
type PatternChartMetric =
  | "average_estimated_result_per_active_day"
  | "estimated_result_per_hour"
  | "estimated_result_per_km";

type WorkPatternsSectionProps = {
  vehicles: Vehicle[];
  getAuthHeaders: () => Record<string, string>;
  endSession: (message: string) => void;
  getVehicleLabel: (vehicleId: number) => string;
};

const periodOptions: Array<{ label: string; value: PatternPeriodPreset }> = [
  { label: "30 dias", value: "last30" },
  { label: "60 dias", value: "last60" },
  { label: "90 dias", value: "last90" },
  { label: "Personalizado", value: "custom" },
];

const chartMetricOptions: Array<{ label: string; value: PatternChartMetric }> = [
  { label: "Resultado/dia", value: "average_estimated_result_per_active_day" },
  { label: "R$/hora", value: "estimated_result_per_hour" },
  { label: "R$/km", value: "estimated_result_per_km" },
];

const weekdayLabels: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

const weekdayObservationLabels: Record<string, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

const sampleLabels: Record<string, string> = {
  insufficient: "Poucos dados",
  limited: "Dados iniciais",
  usable: "Base consistente",
};

function getPatternPeriodDates(
  period: PatternPeriodPreset,
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date();

  if (period === "last30") {
    return { startDate: toDateInputValue(addDays(today, -29)), endDate: toDateInputValue(today) };
  }

  if (period === "last60") {
    return { startDate: toDateInputValue(addDays(today, -59)), endDate: toDateInputValue(today) };
  }

  if (period === "last90") {
    return { startDate: toDateInputValue(addDays(today, -89)), endDate: toDateInputValue(today) };
  }

  return { startDate: customStartDate, endDate: customEndDate };
}

function parseMetricValue(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNullableMoney(value: string | null): string {
  return value === null ? "—" : formatMoney(value);
}

function formatMoneyPerHour(value: string | null): string {
  return value === null ? "—" : `${formatMoney(value)}/h`;
}

function formatExpenseRatio(value: string | null): string {
  if (value === null) {
    return "—";
  }

  const ratio = Number(value);
  if (!Number.isFinite(ratio)) {
    return "—";
  }

  return `${(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

function getObservationMessage(observation: WorkPatternObservation): string {
  const weekday = weekdayObservationLabels[observation.weekday] ?? observation.weekday;

  if (observation.type === "highest_estimated_result_per_hour_weekday") {
    return `${weekday} teve seu maior resultado estimado por hora.`;
  }

  if (observation.type === "highest_estimated_result_per_km_weekday") {
    return `${weekday} teve seu maior resultado estimado por km.`;
  }

  if (observation.type === "highest_average_estimated_result_per_active_day") {
    return `${weekday} teve seu maior resultado estimado médio por dia ativo.`;
  }

  if (observation.type === "highest_expense_burden_weekday") {
    return `Gastos representaram uma parcela maior do faturamento em ${weekday.toLowerCase()}.`;
  }

  return `${weekday} foi o dia em que você mais trabalhou.`;
}

function getObservationTitle(observation: WorkPatternObservation): string {
  if (observation.type === "highest_estimated_result_per_hour_weekday") {
    return "Resultado por hora";
  }

  if (observation.type === "highest_estimated_result_per_km_weekday") {
    return "Resultado por km";
  }

  if (observation.type === "highest_average_estimated_result_per_active_day") {
    return "Resultado por dia ativo";
  }

  if (observation.type === "highest_expense_burden_weekday") {
    return "Peso dos gastos";
  }

  return "Frequência de trabalho";
}

function hasPatternData(patterns: WorkPatternsResponse): boolean {
  return patterns.weekdays.some(
    (weekday) =>
      weekday.active_days > 0 ||
      Number(weekday.gross_revenue) !== 0 ||
      Number(weekday.registered_expenses) !== 0 ||
      Number(weekday.estimated_result) !== 0,
  );
}

function hasUsableSample(patterns: WorkPatternsResponse): boolean {
  return patterns.weekdays.some((weekday) => weekday.sample_classification === "usable");
}

function getChartMetricValue(
  weekday: WorkPatternWeekdayPerformance,
  metric: PatternChartMetric,
): string | null {
  return weekday[metric];
}

function getChartMetricLabel(metric: PatternChartMetric): string {
  return chartMetricOptions.find((option) => option.value === metric)?.label ?? metric;
}

export function WorkPatternsSection({
  vehicles,
  getAuthHeaders,
  endSession,
  getVehicleLabel,
}: WorkPatternsSectionProps) {
  const initialRange = getPatternPeriodDates("last30", "", "");
  const [period, setPeriod] = useState<PatternPeriodPreset>("last30");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [vehicleId, setVehicleId] = useState("");
  const [chartMetric, setChartMetric] = useState<PatternChartMetric>(
    "estimated_result_per_hour",
  );
  const [patterns, setPatterns] = useState<WorkPatternsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const effectiveRange = getPatternPeriodDates(period, startDate, endDate);

  async function loadPatterns() {
    setIsLoading(true);
    setError("");

    try {
      const response = await getWorkPatterns(getAuthHeaders(), {
        startDate: effectiveRange.startDate,
        endDate: effectiveRange.endDate,
        vehicleId,
      });
      setPatterns(response);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message.includes("Sessao")) {
        endSession(requestError.message);
      } else {
        setPatterns(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível carregar seus padrões agora.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, startDate, endDate, vehicleId]);

  function handlePeriodChange(nextPeriod: PatternPeriodPreset) {
    const nextRange = getPatternPeriodDates(nextPeriod, startDate, endDate);
    setPeriod(nextPeriod);
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
  }

  function handleDateChange(field: "start" | "end", value: string) {
    setPeriod("custom");
    if (field === "start") {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  }

  const hasData = patterns ? hasPatternData(patterns) : false;
  const hasUsableData = patterns ? hasUsableSample(patterns) : false;
  const hasOnlyInsufficientSamples = patterns ? patterns.overall.active_days <= 1 : true;
  const observations = patterns?.observations.slice(0, 3) ?? [];
  const chartWeekdays = patterns?.weekdays ?? [];
  const chartValues = chartWeekdays.map((weekday) =>
    parseMetricValue(getChartMetricValue(weekday, chartMetric)),
  );
  const chartMin = Math.min(0, ...chartValues);
  const chartMax = Math.max(0, ...chartValues);
  const chartRange = chartMax === chartMin ? 1 : chartMax - chartMin;
  const chartWidth = 320;
  const chartHeight = 170;
  const chartTop = 16;
  const chartBottom = 122;
  const chartInnerHeight = chartBottom - chartTop;
  const chartZeroY = chartTop + ((chartMax - 0) / chartRange) * chartInnerHeight;
  const barWidth = 24;
  const barStep = 40;

  return (
    <div className="work-patterns" id="padroes">
      <div className="section-title">
        <p className="eyebrow">Padrões</p>
        <h3>Padrões de trabalho</h3>
        <p className="subtle-note">
          Veja em quais dias seus resultados costumam ser melhores com base no seu próprio
          histórico.
        </p>
      </div>

      <div className="dashboard-filters history-filters pattern-filters">
        <label>
          Período
          <select
            onChange={(event) => handlePeriodChange(event.target.value as PatternPeriodPreset)}
            value={period}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {period === "custom" ? (
          <>
            <label>
              Início
              <input
                onChange={(event) => handleDateChange("start", event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
            <label>
              Fim
              <input
                onChange={(event) => handleDateChange("end", event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
          </>
        ) : null}

        {vehicles.length > 1 ? (
          <label>
            Veículo
            <select onChange={(event) => setVehicleId(event.target.value)} value={vehicleId}>
              <option value="">Todos os veículos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.brand} {vehicle.model}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="history-single-vehicle">
            {vehicles[0] ? getVehicleLabel(vehicles[0].id) : "Todos os veículos"}
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="empty-state compact-empty-state">Carregando padrões...</p>
      ) : null}

      {error ? (
        <div className="history-error">
          <p className="form-message compact-message">{error}</p>
          <button className="text-button" type="button" onClick={() => void loadPatterns()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!isLoading && !error && patterns ? (
        hasData ? (
          <>
            {observations.length > 0 ? (
              <div className="pattern-observations">
                {observations.map((observation) => (
                  <article className="financial-insight financial-insight-info" key={observation.type}>
                    <strong>{getObservationTitle(observation)}</strong>
                    <p>{getObservationMessage(observation)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="pattern-callout">
                <p>
                  {hasOnlyInsufficientSamples || hasUsableData
                    ? "Continue registrando seus dias para descobrir seus padrões de trabalho."
                    : "Seus primeiros padrões já estão aparecendo. Continue registrando para tornar as comparações mais confiáveis."}
                </p>
                <a className="button button-primary" href="#hoje">
                  Registrar meu dia
                </a>
              </div>
            )}

            <div className="metric-grid pattern-summary-grid">
              <article className="metric-card">
                <span>Dias trabalhados</span>
                <strong>{patterns.overall.active_days}</strong>
                <small>No período selecionado</small>
              </article>
              <article className="metric-card">
                <span>Horas trabalhadas</span>
                <strong>{formatWorkTime(patterns.overall.total_worked_minutes)}</strong>
                <small>{patterns.overall.total_trip_count} corridas registradas</small>
              </article>
              <article className="metric-card">
                <span>Km rodados</span>
                <strong>{formatDistance(patterns.overall.total_distance_km)} km</strong>
                <small>Base para comparar R$/km</small>
              </article>
              <article className="metric-card metric-profit">
                <span>Resultado estimado</span>
                <strong>{formatMoney(patterns.overall.estimated_result)}</strong>
                <small>
                  {formatMoneyPerHour(patterns.overall.estimated_result_per_hour)}
                </small>
              </article>
              <article className="metric-card">
                <span>Resultado por km</span>
                <strong>
                  {patterns.overall.estimated_result_per_km === null
                    ? "—"
                    : formatMoneyPerKm(patterns.overall.estimated_result_per_km)}
                </strong>
                <small>Resultado estimado dividido pelos km</small>
              </article>
            </div>

            {!hasUsableData ? (
              <p className="subtle-note pattern-limited-note">
                Seus primeiros padrões já estão aparecendo. Continue registrando para tornar as
                comparações mais confiáveis.
              </p>
            ) : null}

            <div className="history-chart-panel pattern-chart-panel">
              <div className="list-header">
                <div>
                  <h3>{getChartMetricLabel(chartMetric)}</h3>
                  <p className="subtle-note">
                    Comparação simples entre dias da semana no período selecionado.
                  </p>
                </div>
                <label>
                  Métrica
                  <select
                    onChange={(event) => setChartMetric(event.target.value as PatternChartMetric)}
                    value={chartMetric}
                  >
                    {chartMetricOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="history-chart pattern-chart" aria-label="Comparação por dia da semana">
                <svg role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                  <line
                    className="history-chart-zero"
                    x1="24"
                    x2="304"
                    y1={chartZeroY}
                    y2={chartZeroY}
                  />
                  {chartWeekdays.map((weekday, index) => {
                    const value = chartValues[index] ?? 0;
                    const x = 28 + index * barStep;
                    const valueY = chartTop + ((chartMax - value) / chartRange) * chartInnerHeight;
                    const y = Math.min(valueY, chartZeroY);
                    const height = Math.max(1, Math.abs(chartZeroY - valueY));
                    const isWeakSample = weekday.sample_classification === "insufficient";

                    return (
                      <rect
                        className={
                          isWeakSample
                            ? "pattern-chart-bar pattern-chart-bar-muted"
                            : "pattern-chart-bar"
                        }
                        height={height}
                        key={weekday.weekday}
                        rx="4"
                        width={barWidth}
                        x={x}
                        y={y}
                      />
                    );
                  })}
                </svg>
                <div className="history-chart-labels pattern-chart-labels">
                  {chartWeekdays.map((weekday) => (
                    <span key={weekday.weekday}>{weekdayLabels[weekday.weekday]}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="weekday-card-grid">
              {patterns.weekdays.map((weekday) => (
                <article
                  className={
                    weekday.sample_classification === "insufficient"
                      ? "weekday-card weekday-card-muted"
                      : "weekday-card"
                  }
                  key={weekday.weekday}
                >
                  <div className="weekday-card-header">
                    <div>
                      <h4>{weekdayLabels[weekday.weekday]}</h4>
                      <span>{sampleLabels[weekday.sample_classification]}</span>
                    </div>
                    <strong>{weekday.active_days}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Resultado/dia ativo</dt>
                      <dd>{formatNullableMoney(weekday.average_estimated_result_per_active_day)}</dd>
                    </div>
                    <div>
                      <dt>R$/hora</dt>
                      <dd>{formatMoneyPerHour(weekday.estimated_result_per_hour)}</dd>
                    </div>
                    <div>
                      <dt>R$/km</dt>
                      <dd>
                        {weekday.estimated_result_per_km === null
                          ? "—"
                          : formatMoneyPerKm(weekday.estimated_result_per_km)}
                      </dd>
                    </div>
                    <div>
                      <dt>Dias registrados</dt>
                      <dd>{weekday.active_days}</dd>
                    </div>
                  </dl>

                  {weekday.sample_classification === "insufficient" ? (
                    <p className="subtle-note">Poucos dados para comparar este dia.</p>
                  ) : (
                    <details className="weekday-card-details">
                      <summary>Detalhes</summary>
                      <dl>
                        <div>
                          <dt>Faturamento</dt>
                          <dd>{formatMoney(weekday.gross_revenue)}</dd>
                        </div>
                        <div>
                          <dt>Gastos</dt>
                          <dd>{formatMoney(weekday.registered_expenses)}</dd>
                        </div>
                        <div>
                          <dt>Horas</dt>
                          <dd>{formatWorkTime(weekday.total_worked_minutes)}</dd>
                        </div>
                        <div>
                          <dt>Km</dt>
                          <dd>{formatDistance(weekday.total_distance_km)} km</dd>
                        </div>
                        <div>
                          <dt>Corridas</dt>
                          <dd>{weekday.total_trip_count}</dd>
                        </div>
                        <div>
                          <dt>Gastos/faturamento</dt>
                          <dd>{formatExpenseRatio(weekday.expense_ratio)}</dd>
                        </div>
                      </dl>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state history-empty-state">
            <p>Você ainda não tem histórico suficiente para identificar padrões.</p>
            <a className="button button-primary" href="#hoje">
              Registrar meu dia
            </a>
          </div>
        )
      ) : null}
    </div>
  );
}
