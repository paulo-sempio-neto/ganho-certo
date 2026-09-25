import type {
  ExpenseCategory,
  FinancialGoalType,
  FinancialHistoryGrouping,
  FinancialHistoryTrendDirection,
  FinancialInsightType,
} from "./domain";

export type FinancialGoal = {
  id: number;
  vehicle_id: number | null;
  goal_type: FinancialGoalType;
  target_amount: string;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinancialGoalProgress = {
  target_amount: string;
  current_amount: string;
  remaining_amount: string;
  progress_percentage: string;
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  required_daily_amount: string;
  projected_completion_amount: string;
  on_track: boolean;
  average_net_per_hour: string | null;
  average_projected_per_hour: string | null;
  estimated_hours_remaining: string | null;
};

export type FinancialDailySummary = {
  date: string;
  gross_revenue: string;
  expenses: string;
  estimated_net_profit: string;
};

export type FinancialStructuralCosts = {
  ownership: string;
  insurance: string;
  ipva: string;
  other_fixed: string;
  maintenance: string;
  tires: string;
  oil: string;
  depreciation: string;
};

export type FinancialRecurringExpenseBreakdown = {
  category: ExpenseCategory;
  amount: string;
};

export type FinancialSummary = {
  gross_revenue: string;
  total_expenses: string;
  estimated_net_profit: string;
  estimated_structural_costs: string;
  estimated_economic_costs: string;
  estimated_economic_result: string;
  recurring_expenses_total: string;
  recurring_expenses_breakdown: FinancialRecurringExpenseBreakdown[];
  projected_economic_costs: string;
  projected_economic_result: string;
  structural_costs: FinancialStructuralCosts;
  total_distance_km: string;
  total_worked_minutes: number;
  total_trip_count: number;
  gross_per_hour: string | null;
  net_per_hour: string | null;
  gross_per_km: string | null;
  net_per_km: string | null;
  expense_per_km: string | null;
  average_ticket: string | null;
  daily: FinancialDailySummary[];
};

export type FinancialInsight = {
  code: string;
  type: FinancialInsightType;
  title: string;
  message: string;
};

export type FinancialInsightsResponse = {
  insights: FinancialInsight[];
};

export type FinancialHistoryPeriod = {
  period_start: string;
  period_end: string;
  gross_revenue: string;
  registered_expenses: string;
  estimated_structural_costs: string;
  recurring_projected_expenses: string;
  cash_remaining: string;
  estimated_result: string;
  projected_result: string;
  worked_minutes: number;
  distance_km: string;
  trip_count: number;
  revenue_per_hour: string | null;
  estimated_result_per_hour: string | null;
  revenue_per_km: string | null;
  estimated_result_per_km: string | null;
};

export type FinancialHistoryMetricComparison = {
  current: string | null;
  previous: string | null;
  absolute_delta: string | null;
  percentage_delta: string | null;
};

export type FinancialHistoryComparison = {
  current_period_start: string;
  current_period_end: string;
  previous_period_start: string;
  previous_period_end: string;
  gross_revenue: FinancialHistoryMetricComparison;
  registered_expenses: FinancialHistoryMetricComparison;
  estimated_result: FinancialHistoryMetricComparison;
  projected_result: FinancialHistoryMetricComparison;
  worked_minutes: FinancialHistoryMetricComparison;
  distance_km: FinancialHistoryMetricComparison;
  estimated_result_per_hour: FinancialHistoryMetricComparison;
  estimated_result_per_km: FinancialHistoryMetricComparison;
};

export type FinancialHistoryTrendFact = {
  metric: string;
  direction: FinancialHistoryTrendDirection;
  current: string;
  previous: string;
  absolute_delta: string;
  percentage_delta: string | null;
};

export type FinancialHistoryResponse = {
  start_date: string;
  end_date: string;
  vehicle_id: number | null;
  grouping: FinancialHistoryGrouping;
  periods: FinancialHistoryPeriod[];
  comparison: FinancialHistoryComparison;
  trend_facts: FinancialHistoryTrendFact[];
};
