import { requestApi } from "./client";
import type { DashboardPeriod, FinancialHistoryGrouping } from "../types/domain";
import type {
  FinancialHistoryResponse,
  FinancialInsightsResponse,
  FinancialSummary,
  WorkPatternsResponse,
} from "../types/financial";
import { getPeriodDates } from "../utils/dates";

type AuthHeaders = Record<string, string>;

export type DashboardQueryParams = {
  period: DashboardPeriod;
  customStartDate: string;
  customEndDate: string;
  vehicleId: string;
};

export type FinancialHistoryQueryParams = {
  startDate: string;
  endDate: string;
  grouping: FinancialHistoryGrouping;
  vehicleId: string;
};

export type WorkPatternsQueryParams = {
  startDate: string;
  endDate: string;
  vehicleId: string;
};

export function buildDashboardPath(endpoint: string, params: DashboardQueryParams) {
  const { startDate, endDate } = getPeriodDates(
    params.period,
    params.customStartDate,
    params.customEndDate,
  );
  const searchParams = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (params.vehicleId) {
    searchParams.set("vehicle_id", params.vehicleId);
  }

  return `${endpoint}?${searchParams.toString()}`;
}

export function buildFinancialHistoryPath(params: FinancialHistoryQueryParams) {
  const searchParams = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
    grouping: params.grouping,
  });
  if (params.vehicleId) {
    searchParams.set("vehicle_id", params.vehicleId);
  }

  return `/financial-history?${searchParams.toString()}`;
}

export function buildWorkPatternsPath(params: WorkPatternsQueryParams) {
  const searchParams = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  if (params.vehicleId) {
    searchParams.set("vehicle_id", params.vehicleId);
  }

  return `/work-patterns?${searchParams.toString()}`;
}

export function getFinancialSummary(headers: AuthHeaders, params: DashboardQueryParams) {
  return requestApi<FinancialSummary>(buildDashboardPath("/financial-summary", params), {
    headers,
  });
}

export function getFinancialInsights(headers: AuthHeaders, params: DashboardQueryParams) {
  return requestApi<FinancialInsightsResponse>(buildDashboardPath("/financial-insights", params), {
    headers,
  });
}

export function getFinancialHistory(headers: AuthHeaders, params: FinancialHistoryQueryParams) {
  return requestApi<FinancialHistoryResponse>(buildFinancialHistoryPath(params), {
    headers,
  });
}

export function getWorkPatterns(headers: AuthHeaders, params: WorkPatternsQueryParams) {
  return requestApi<WorkPatternsResponse>(buildWorkPatternsPath(params), {
    headers,
  });
}
