export type AuthMode = "login" | "register";
export type FuelType = "gasoline" | "ethanol" | "flex" | "diesel" | "electric" | "hybrid" | "other";
export type OwnershipType = "owned" | "financed" | "rented";
export type DashboardPeriod = "today" | "last7" | "month" | "custom";
export type HistoryPeriodPreset = "last7" | "last30" | "last90" | "month" | "custom";
export type FinancialHistoryGrouping = "daily" | "weekly" | "monthly";
export type FinancialHistoryTrendDirection = "increased" | "decreased" | "unchanged";
export type HistoryChartMetric =
  | "estimated_result"
  | "estimated_result_per_hour"
  | "estimated_result_per_km";
export type RecurringExpenseFrequency = "weekly" | "monthly" | "yearly";
export type FinancialGoalType = "net" | "projected";
export type FinancialInsightType = "info" | "positive" | "attention";
export type MaintenanceCategory =
  | "oil"
  | "tires"
  | "brakes"
  | "filters"
  | "alignment"
  | "battery"
  | "inspection"
  | "transmission"
  | "cooling"
  | "other";
export type MaintenanceStatusType = "ok" | "due_soon" | "due";
export type WorkSessionImportField =
  | "date"
  | "gross_revenue"
  | "distance_km"
  | "worked_minutes"
  | "trip_count";
export type ExpenseImportField = "expense_date" | "amount" | "category" | "description";
export type CsvImportType = "work_sessions" | "expenses";
export type CsvImportColumnMapping = Partial<
  Record<WorkSessionImportField | ExpenseImportField, string>
>;

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Vehicle = {
  id: number;
  name: string;
  brand: string;
  model: string;
  year: number;
  fuel_type: FuelType;
  created_at: string;
};

export type VehicleCostProfile = {
  id: number;
  vehicle_id: number;
  ownership_type: OwnershipType;
  rental_monthly: string | null;
  financing_monthly: string | null;
  insurance_monthly: string | null;
  ipva_annual: string | null;
  other_fixed_monthly: string | null;
  maintenance_per_km: string | null;
  tires_per_km: string | null;
  oil_per_km: string | null;
  depreciation_per_km: string | null;
  fuel_efficiency_km_per_liter: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkSession = {
  id: number;
  vehicle_id: number;
  work_date: string;
  gross_revenue: string;
  distance_km: string;
  worked_minutes: number;
  trip_count: number;
  created_at: string;
  updated_at: string;
};

export type WorkSessionImportRow = {
  row: number;
  date: string;
  gross_revenue: string;
  distance_km: string;
  worked_minutes: number;
  trip_count: number;
};

export type WorkSessionImportError = {
  row: number;
  field: string;
  message: string;
};

export type WorkSessionImportPreview = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  columns_found: string[];
  suggested_mapping: Partial<Record<WorkSessionImportField, string>>;
  column_mapping: Partial<Record<WorkSessionImportField, string>>;
  rows: WorkSessionImportRow[];
  errors: WorkSessionImportError[];
};

export type WorkSessionImportMapping = Record<WorkSessionImportField, string>;

export type WorkSessionImportResult = {
  imported: number;
  duplicates_skipped: number;
  failed: number;
  errors: WorkSessionImportError[];
};

export type ExpenseCategory =
  | "fuel"
  | "charging"
  | "maintenance"
  | "parking"
  | "toll"
  | "insurance"
  | "rental"
  | "financing"
  | "washing"
  | "other";

export type ExpenseImportRow = {
  row: number;
  expense_date: string;
  amount: string;
  category: ExpenseCategory;
  description: string | null;
};

export type ExpenseImportPreview = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  columns_found: string[];
  suggested_mapping: Partial<Record<ExpenseImportField, string>>;
  column_mapping: Partial<Record<ExpenseImportField, string>>;
  rows: ExpenseImportRow[];
  errors: WorkSessionImportError[];
};

export type ExpenseImportMapping = Record<ExpenseImportField, string>;

export type ExpenseImportResult = {
  imported: number;
  duplicates_skipped: number;
  failed: number;
  errors: WorkSessionImportError[];
};

export type CsvImportProfile = {
  id: number;
  name: string;
  import_type: CsvImportType;
  header_signature: string;
  column_mapping: CsvImportColumnMapping;
  vehicle_id: number | null;
  created_at: string;
  updated_at: string;
};

export type CsvImportProfileMatchResponse = {
  profile: CsvImportProfile | null;
  column_mapping: CsvImportColumnMapping | null;
  vehicle_id: number | null;
};

export type Expense = {
  id: number;
  vehicle_id: number | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringExpense = {
  id: number;
  vehicle_id: number | null;
  category: ExpenseCategory;
  amount: string;
  frequency: RecurringExpenseFrequency;
  start_date: string;
  end_date: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MaintenancePlan = {
  id: number;
  vehicle_id: number;
  name: string;
  category: MaintenanceCategory;
  interval_km: string | null;
  interval_days: number | null;
  estimated_cost: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRecord = {
  id: number;
  maintenance_plan_id: number;
  service_date: string;
  notes: string | null;
  created_at: string;
};

export type MaintenancePlanStatus = {
  status: MaintenanceStatusType;
  km_since_last_service: string | null;
  km_remaining: string | null;
  days_since_last_service: number | null;
  days_remaining: number | null;
  estimated_cost: string | null;
  recommended_reserve_per_km: string | null;
};
