import type {
  DashboardPeriod,
  ExpenseCategory,
  FinancialHistoryGrouping,
  HistoryPeriodPreset,
  Vehicle,
} from "../../types/domain";
import type {
  FinancialHistoryResponse,
  FinancialInsight,
  FinancialSummary,
} from "../../types/financial";
import { FinancialSummaryPanel } from "./FinancialSummaryPanel";
import { HistoricalPerformanceSection } from "./HistoricalPerformanceSection";
import { InsightsPanel } from "./InsightsPanel";
import { WorkPatternsSection } from "./WorkPatternsSection";

type DashboardFilters = {
  period: DashboardPeriod;
  customStartDate: string;
  customEndDate: string;
  vehicleId: string;
  onPeriodChange: (period: DashboardPeriod) => void;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onVehicleChange: (vehicleId: string) => void;
};

type HistoryFilters = {
  period: HistoryPeriodPreset;
  startDate: string;
  endDate: string;
  grouping: FinancialHistoryGrouping;
  vehicleId: string;
  onPeriodChange: (period: HistoryPeriodPreset) => void;
  onDateChange: (field: "start" | "end", value: string) => void;
  onGroupingChange: (grouping: FinancialHistoryGrouping) => void;
  onVehicleChange: (vehicleId: string) => void;
};

type ResultSectionProps = {
  vehicles: Vehicle[];
  dashboardFilters: DashboardFilters;
  historyFilters: HistoryFilters;
  summary: FinancialSummary | null;
  insights: FinancialInsight[];
  history: FinancialHistoryResponse | null;
  isSummaryLoading: boolean;
  isInsightsLoading: boolean;
  isHistoryLoading: boolean;
  summaryError: string;
  insightsError: string;
  historyError: string;
  onSummaryRetry: () => void;
  onInsightsRetry: () => void;
  onHistoryRetry: () => void;
  getAuthHeaders: () => Record<string, string>;
  endSession: (message: string) => void;
  getVehicleLabel: (vehicleId: number) => string;
  getExpenseCategoryLabel: (category: ExpenseCategory) => string;
};

export function ResultSection({
  vehicles,
  dashboardFilters,
  historyFilters,
  summary,
  insights,
  history,
  isSummaryLoading,
  isInsightsLoading,
  isHistoryLoading,
  summaryError,
  insightsError,
  historyError,
  onSummaryRetry,
  onInsightsRetry,
  onHistoryRetry,
  getAuthHeaders,
  endSession,
  getVehicleLabel,
  getExpenseCategoryLabel,
}: ResultSectionProps) {
  return (
    <section className="manager-section dashboard-section" id="resultado">
      <div className="section-title">
        <p className="eyebrow">Resultado</p>
        <h3>Resumo financeiro</h3>
        <p className="subtle-note">
          Veja quanto entrou, quanto saiu e como os custos do veículo afetam sua estimativa.
        </p>
      </div>

      <div className="result-context-nav" aria-label="Áreas de resultado">
        <a href="#resultado">Visão geral</a>
        <a href="#metas">Metas</a>
        <a href="#insights">Insights</a>
        <a href="#evolucao">EvoluÃ§Ã£o</a>
        <a href="#padroes">Padrões</a>
      </div>

      <div className="dashboard-filters">
        <label>
          Período
          <select
            onChange={(event) => dashboardFilters.onPeriodChange(event.target.value as DashboardPeriod)}
            value={dashboardFilters.period}
          >
            <option value="today">Hoje</option>
            <option value="last7">Últimos 7 dias</option>
            <option value="month">Este mês</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>

        {dashboardFilters.period === "custom" ? (
          <>
            <label>
              Início
              <input
                onChange={(event) =>
                  dashboardFilters.onCustomStartDateChange(event.target.value)
                }
                type="date"
                value={dashboardFilters.customStartDate}
              />
            </label>
            <label>
              Fim
              <input
                onChange={(event) => dashboardFilters.onCustomEndDateChange(event.target.value)}
                type="date"
                value={dashboardFilters.customEndDate}
              />
            </label>
          </>
        ) : null}

        <label>
          Veículo
          <select
            onChange={(event) => dashboardFilters.onVehicleChange(event.target.value)}
            value={dashboardFilters.vehicleId}
          >
            <option value="">Todos</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name} - {vehicle.brand} {vehicle.model}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isSummaryLoading ? <p className="empty-state">Carregando dashboard...</p> : null}
      {summaryError ? (
        <div className="history-error">
          <p className="form-message compact-message">{summaryError}</p>
          <button
            className="text-button"
            disabled={isSummaryLoading}
            type="button"
            onClick={onSummaryRetry}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!isSummaryLoading && summary ? (
        <>
          <FinancialSummaryPanel
            summary={summary}
            getExpenseCategoryLabel={getExpenseCategoryLabel}
          />

          <InsightsPanel
            insights={insights}
            isLoading={isInsightsLoading}
            error={insightsError}
            onRetry={onInsightsRetry}
          />

          <HistoricalPerformanceSection
            history={history}
            isLoading={isHistoryLoading}
            error={historyError}
            vehicles={vehicles}
            period={historyFilters.period}
            startDate={historyFilters.startDate}
            endDate={historyFilters.endDate}
            grouping={historyFilters.grouping}
            vehicleId={historyFilters.vehicleId}
            onPeriodChange={historyFilters.onPeriodChange}
            onDateChange={historyFilters.onDateChange}
            onGroupingChange={historyFilters.onGroupingChange}
            onVehicleChange={historyFilters.onVehicleChange}
            onRetry={onHistoryRetry}
            getVehicleLabel={getVehicleLabel}
          />

          <WorkPatternsSection
            vehicles={vehicles}
            getAuthHeaders={getAuthHeaders}
            endSession={endSession}
            getVehicleLabel={getVehicleLabel}
          />
        </>
      ) : null}
    </section>
  );
}
