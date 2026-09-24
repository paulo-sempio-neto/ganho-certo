import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";

import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";

type AuthMode = "login" | "register";
type FuelType = "gasoline" | "ethanol" | "flex" | "diesel" | "electric" | "hybrid" | "other";
type OwnershipType = "owned" | "financed" | "rented";
type DashboardPeriod = "today" | "last7" | "month" | "custom";
type RecurringExpenseFrequency = "weekly" | "monthly" | "yearly";
type FinancialGoalType = "net" | "projected";
type FinancialInsightType = "info" | "positive" | "attention";
type MaintenanceCategory =
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
type MaintenanceStatusType = "ok" | "due_soon" | "due";
type WorkSessionImportField =
  | "date"
  | "gross_revenue"
  | "distance_km"
  | "worked_minutes"
  | "trip_count";
type ExpenseImportField = "expense_date" | "amount" | "category" | "description";
type CsvImportType = "work_sessions" | "expenses";
type CsvImportColumnMapping = Partial<
  Record<WorkSessionImportField | ExpenseImportField, string>
>;

type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
};

type Vehicle = {
  id: number;
  name: string;
  brand: string;
  model: string;
  year: number;
  fuel_type: FuelType;
  created_at: string;
};

type WorkSession = {
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

type WorkSessionImportRow = {
  row: number;
  date: string;
  gross_revenue: string;
  distance_km: string;
  worked_minutes: number;
  trip_count: number;
};

type WorkSessionImportError = {
  row: number;
  field: string;
  message: string;
};

type WorkSessionImportPreview = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  columns_found: string[];
  suggested_mapping: Partial<Record<WorkSessionImportField, string>>;
  column_mapping: Partial<Record<WorkSessionImportField, string>>;
  rows: WorkSessionImportRow[];
  errors: WorkSessionImportError[];
};

type WorkSessionImportMapping = Record<WorkSessionImportField, string>;

type WorkSessionImportResult = {
  imported: number;
  duplicates_skipped: number;
  failed: number;
  errors: WorkSessionImportError[];
};

type ExpenseImportRow = {
  row: number;
  expense_date: string;
  amount: string;
  category: ExpenseCategory;
  description: string | null;
};

type ExpenseImportPreview = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  columns_found: string[];
  suggested_mapping: Partial<Record<ExpenseImportField, string>>;
  column_mapping: Partial<Record<ExpenseImportField, string>>;
  rows: ExpenseImportRow[];
  errors: WorkSessionImportError[];
};

type ExpenseImportMapping = Record<ExpenseImportField, string>;

type ExpenseImportResult = {
  imported: number;
  duplicates_skipped: number;
  failed: number;
  errors: WorkSessionImportError[];
};

type CsvImportProfile = {
  id: number;
  name: string;
  import_type: CsvImportType;
  header_signature: string;
  column_mapping: CsvImportColumnMapping;
  vehicle_id: number | null;
  created_at: string;
  updated_at: string;
};

type CsvImportProfileMatchResponse = {
  profile: CsvImportProfile | null;
  column_mapping: CsvImportColumnMapping | null;
  vehicle_id: number | null;
};

type ExpenseCategory =
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

type Expense = {
  id: number;
  vehicle_id: number | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type RecurringExpense = {
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

type FinancialGoal = {
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

type FinancialGoalProgress = {
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

type MaintenancePlan = {
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

type MaintenanceRecord = {
  id: number;
  maintenance_plan_id: number;
  service_date: string;
  notes: string | null;
  created_at: string;
};

type MaintenancePlanStatus = {
  status: MaintenanceStatusType;
  km_since_last_service: string | null;
  km_remaining: string | null;
  days_since_last_service: number | null;
  days_remaining: number | null;
  estimated_cost: string | null;
  recommended_reserve_per_km: string | null;
};

type VehicleForm = {
  name: string;
  brand: string;
  model: string;
  year: string;
  fuel_type: FuelType;
};

type VehicleCostProfile = {
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

type VehicleCostProfileForm = {
  ownership_type: OwnershipType;
  rental_monthly: string;
  financing_monthly: string;
  insurance_monthly: string;
  ipva_annual: string;
  other_fixed_monthly: string;
  maintenance_per_km: string;
  tires_per_km: string;
  oil_per_km: string;
  depreciation_per_km: string;
  fuel_efficiency_km_per_liter: string;
};

type WorkSessionForm = {
  work_date: string;
  vehicle_id: string;
  gross_revenue: string;
  distance_km: string;
  worked_hours: string;
  worked_minutes: string;
  trip_count: string;
};

type ExpenseForm = {
  expense_date: string;
  category: ExpenseCategory;
  amount: string;
  vehicle_id: string;
  description: string;
};

type RecurringExpenseForm = {
  category: ExpenseCategory;
  amount: string;
  frequency: RecurringExpenseFrequency;
  start_date: string;
  end_date: string;
  vehicle_id: string;
  description: string;
  active: boolean;
};

type FinancialGoalForm = {
  goal_type: FinancialGoalType;
  target_amount: string;
  start_date: string;
  end_date: string;
  vehicle_id: string;
};

type MaintenancePlanForm = {
  name: string;
  category: MaintenanceCategory;
  interval_km: string;
  interval_days: string;
  estimated_cost: string;
  vehicle_id: string;
  active: boolean;
};

type MaintenanceRecordForm = {
  service_date: string;
  notes: string;
};

type QuickStartForm = {
  gross_revenue: string;
  distance_km: string;
  worked_hours: string;
  worked_minutes: string;
  fuel_expense: string;
  expense_category: "fuel" | "charging";
  ownership_type: OwnershipType;
  trip_count: string;
  rental_monthly: string;
  financing_monthly: string;
};

type QuickStartResult = {
  grossRevenueCents: bigint;
  fuelExpenseCents: bigint;
  remainingCents: bigint;
  remainingPerHourCents: bigint | null;
  remainingPerKmCents: bigint | null;
  averageTicketCents: bigint | null;
};

type QuickDailyEntryForm = {
  gross_revenue: string;
  distance_km: string;
  worked_hours: string;
  worked_minutes: string;
  trip_count: string;
  vehicle_id: string;
  work_date: string;
};

type QuickDailyEntryResult = {
  grossRevenueCents: bigint;
  grossPerHourCents: bigint | null;
  grossPerKmCents: bigint | null;
  tripCount: number;
  vehicle: Vehicle;
  workDate: string;
};

type FinancialDailySummary = {
  date: string;
  gross_revenue: string;
  expenses: string;
  estimated_net_profit: string;
};

type FinancialStructuralCosts = {
  ownership: string;
  insurance: string;
  ipva: string;
  other_fixed: string;
  maintenance: string;
  tires: string;
  oil: string;
  depreciation: string;
};

type FinancialRecurringExpenseBreakdown = {
  category: ExpenseCategory;
  amount: string;
};

type FinancialSummary = {
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

type FinancialInsight = {
  code: string;
  type: FinancialInsightType;
  title: string;
  message: string;
};

type FinancialInsightsResponse = {
  insights: FinancialInsight[];
};

const fuelOptions: Array<{ label: string; value: FuelType }> = [
  { label: "Gasolina", value: "gasoline" },
  { label: "Etanol", value: "ethanol" },
  { label: "Flex", value: "flex" },
  { label: "Diesel", value: "diesel" },
  { label: "Elétrico", value: "electric" },
  { label: "Híbrido", value: "hybrid" },
  { label: "Outro", value: "other" },
];

const ownershipOptions: Array<{ label: string; value: OwnershipType }> = [
  { label: "Proprio", value: "owned" },
  { label: "Financiado", value: "financed" },
  { label: "Alugado", value: "rented" },
];

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

const expenseCategoryOptions: Array<{ label: string; value: ExpenseCategory }> = [
  { label: "Combustível", value: "fuel" },
  { label: "Recarga elétrica", value: "charging" },
  { label: "Manutenção", value: "maintenance" },
  { label: "Estacionamento", value: "parking" },
  { label: "Pedágio", value: "toll" },
  { label: "Seguro", value: "insurance" },
  { label: "Aluguel", value: "rental" },
  { label: "Financiamento", value: "financing" },
  { label: "Lavagem", value: "washing" },
  { label: "Outros", value: "other" },
];

const recurringFrequencyOptions: Array<{ label: string; value: RecurringExpenseFrequency }> = [
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
  { label: "Anual", value: "yearly" },
];

const financialGoalTypeOptions: Array<{ label: string; value: FinancialGoalType }> = [
  { label: "Meta de sobra apos despesas", value: "net" },
  { label: "Meta de resultado projetado", value: "projected" },
];

const maintenanceCategoryOptions: Array<{ label: string; value: MaintenanceCategory }> = [
  { label: "Oleo", value: "oil" },
  { label: "Pneus", value: "tires" },
  { label: "Freios", value: "brakes" },
  { label: "Filtros", value: "filters" },
  { label: "Alinhamento", value: "alignment" },
  { label: "Bateria", value: "battery" },
  { label: "Revisao", value: "inspection" },
  { label: "Transmissao", value: "transmission" },
  { label: "Arrefecimento", value: "cooling" },
  { label: "Outros", value: "other" },
];

const emptyVehicleForm: VehicleForm = {
  name: "",
  brand: "",
  model: "",
  year: "",
  fuel_type: "flex",
};

const emptyCostProfileForm: VehicleCostProfileForm = {
  ownership_type: "owned",
  rental_monthly: "",
  financing_monthly: "",
  insurance_monthly: "",
  ipva_annual: "",
  other_fixed_monthly: "",
  maintenance_per_km: "",
  tires_per_km: "",
  oil_per_km: "",
  depreciation_per_km: "",
  fuel_efficiency_km_per_liter: "",
};

const emptyWorkSessionForm: WorkSessionForm = {
  work_date: toDateInputValue(new Date()),
  vehicle_id: "",
  gross_revenue: "",
  distance_km: "",
  worked_hours: "",
  worked_minutes: "",
  trip_count: "",
};

const emptyWorkSessionImportMapping: WorkSessionImportMapping = {
  date: "",
  gross_revenue: "",
  distance_km: "",
  worked_minutes: "",
  trip_count: "",
};

const emptyExpenseImportMapping: ExpenseImportMapping = {
  expense_date: "",
  amount: "",
  category: "",
  description: "",
};

const workSessionImportMappingFields: Array<{
  field: WorkSessionImportField;
  label: string;
  optional?: boolean;
}> = [
  { field: "date", label: "Data" },
  { field: "gross_revenue", label: "Faturamento" },
  { field: "distance_km", label: "Km" },
  { field: "worked_minutes", label: "Tempo trabalhado" },
  { field: "trip_count", label: "Corridas", optional: true },
];

const expenseImportMappingFields: Array<{
  field: ExpenseImportField;
  label: string;
  optional?: boolean;
}> = [
  { field: "expense_date", label: "Data" },
  { field: "amount", label: "Valor" },
  { field: "category", label: "Categoria", optional: true },
  { field: "description", label: "Descricao", optional: true },
];

const emptyExpenseForm: ExpenseForm = {
  expense_date: toDateInputValue(new Date()),
  category: "fuel",
  amount: "",
  vehicle_id: "",
  description: "",
};

const emptyRecurringExpenseForm: RecurringExpenseForm = {
  category: "insurance",
  amount: "",
  frequency: "monthly",
  start_date: toDateInputValue(new Date()),
  end_date: "",
  vehicle_id: "",
  description: "",
  active: true,
};

const emptyFinancialGoalForm: FinancialGoalForm = {
  goal_type: "net",
  target_amount: "",
  start_date: toDateInputValue(new Date()),
  end_date: toDateInputValue(new Date()),
  vehicle_id: "",
};

const emptyMaintenancePlanForm: MaintenancePlanForm = {
  name: "",
  category: "oil",
  interval_km: "",
  interval_days: "",
  estimated_cost: "",
  vehicle_id: "",
  active: true,
};

const emptyMaintenanceRecordForm: MaintenanceRecordForm = {
  service_date: toDateInputValue(new Date()),
  notes: "",
};

const emptyQuickStartForm: QuickStartForm = {
  gross_revenue: "",
  distance_km: "",
  worked_hours: "",
  worked_minutes: "",
  fuel_expense: "",
  expense_category: "fuel",
  ownership_type: "owned",
  trip_count: "",
  rental_monthly: "",
  financing_monthly: "",
};

const emptyQuickDailyEntryForm: QuickDailyEntryForm = {
  gross_revenue: "",
  distance_km: "",
  worked_hours: "",
  worked_minutes: "",
  trip_count: "",
  vehicle_id: "",
  work_date: toDateInputValue(new Date()),
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodDates(period: DashboardPeriod, customStartDate: string, customEndDate: string) {
  const today = new Date();

  if (period === "today") {
    const todayValue = toDateInputValue(today);
    return { startDate: todayValue, endDate: todayValue };
  }

  if (period === "last7") {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(today) };
  }

  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(today) };
  }

  return { startDate: customStartDate, endDate: customEndDate };
}

function getFuelLabel(value: FuelType): string {
  return fuelOptions.find((option) => option.value === value)?.label ?? value;
}

function getExpenseCategoryLabel(value: ExpenseCategory): string {
  return expenseCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function getRecurringFrequencyLabel(value: RecurringExpenseFrequency): string {
  return recurringFrequencyOptions.find((option) => option.value === value)?.label ?? value;
}

function getFinancialGoalTypeLabel(value: FinancialGoalType): string {
  return financialGoalTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function getMaintenanceCategoryLabel(value: MaintenanceCategory): string {
  return maintenanceCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function getMaintenanceStatusLabel(value: MaintenanceStatusType): string {
  if (value === "due") {
    return "Manutencao necessaria";
  }

  if (value === "due_soon") {
    return "Proxima manutencao";
  }

  return "Em dia";
}

function getMaintenanceStatusClass(value: MaintenanceStatusType): string {
  if (value === "due") {
    return "status-pill status-inactive";
  }

  if (value === "due_soon") {
    return "status-pill status-warning";
  }

  return "status-pill status-active";
}

function getDefaultErrorMessage(status: number): string {
  if (status === 401) {
    return "Sessao expirada ou invalida. Entre novamente.";
  }

  if (status === 409) {
    return "Conflito ao concluir a solicitacao.";
  }

  if (status === 422) {
    return "Verifique os campos informados.";
  }

  if (status === 404) {
    return "Registro nao encontrado.";
  }

  return "Nao foi possivel concluir a solicitacao.";
}

async function getErrorMessage(response: Response): Promise<string> {
  if (response.status !== 409) {
    return getDefaultErrorMessage(response.status);
  }

  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
    ) {
      return payload.detail === "Email already registered."
        ? "Este email ja esta cadastrado."
        : payload.detail;
    }
  } catch {
    // Fall back to a generic message when the API does not return JSON.
  }

  return getDefaultErrorMessage(response.status);
}

function normalizeDecimalInput(value: string): string {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Verifique os campos numericos informados.");
  }

  return normalized;
}

function moneyInputToApi(value: string): string {
  const cleaned = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  let normalized = cleaned;

  if (decimalIndex >= 0) {
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimalPart = cleaned.slice(decimalIndex + 1);
    if (!integerPart || !decimalPart) {
      throw new Error("Informe um valor em reais, por exemplo 250,50.");
    }

    if (decimalPart.length <= 2) {
      normalized = `${integerPart}.${decimalPart}`;
    } else if (
      decimalPart.length === 3 &&
      (lastComma < 0 || lastDot < 0) &&
      /^[\d.]+$/.test(cleaned)
    ) {
      normalized = `${cleaned.replace(/[.,]/g, "")}.00`;
    }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe um valor em reais, por exemplo 250,50.");
  }

  const [reais, cents = ""] = normalized.split(".");
  const safeReais = reais.replace(/^0+(?=\d)/, "") || "0";
  const safeCents = `${cents}00`.slice(0, 2);
  return `${safeReais}.${safeCents}`;
}

function optionalMoneyInputToApi(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return moneyInputToApi(value);
}

function optionalDecimalInputToApi(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return normalizeDecimalInput(value);
}

function formatMoney(value: string): string {
  const [reais, cents = "00"] = value.split(".");
  const groupedReais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${groupedReais},${`${cents}00`.slice(0, 2)}`;
}

function formatMoneyPerKm(value: string): string {
  const [reais, fraction = ""] = value.split(".");
  const groupedReais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const safeFraction = fraction ? `,${fraction}` : "";
  return `R$ ${groupedReais}${safeFraction}/km`;
}

function formatOptionalMoneyForInput(value: string | null): string {
  return value ? formatMoney(value).replace("R$ ", "") : "";
}

function formatOptionalDecimalForInput(value: string | null): string {
  return value ? value.replace(".", ",") : "";
}

function formatDistance(value: string): string {
  return value.replace(".", ",");
}

function formatWorkTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} bytes`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1).replace(".", ",")} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function getImportFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    date: "Data",
    gross_revenue: "Faturamento",
    distance_km: "Km rodados",
    worked_minutes: "Minutos trabalhados",
    trip_count: "Corridas",
    expense_date: "Data",
    amount: "Valor",
    category: "Categoria",
    description: "Descricao",
    header: "Cabeçalho",
    file: "Arquivo",
  };

  return labels[field] ?? field;
}

function getImportProfileTypeLabel(importType: CsvImportType): string {
  return importType === "expenses" ? "Despesas" : "Jornadas";
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatPercent(value: string | null): string {
  if (value === null) {
    return "—";
  }

  const normalized = value.replace(".", ",");
  return normalized.endsWith(",00") ? `${normalized.slice(0, -3)}%` : `${normalized}%`;
}

function getProgressWidth(value: string | null): string {
  if (value === null) {
    return "0%";
  }

  const percentage = Number(value);
  if (!Number.isFinite(percentage)) {
    return "0%";
  }

  return `${Math.min(100, Math.max(0, percentage))}%`;
}

function formatHours(value: string | null): string {
  if (value === null) {
    return "—";
  }

  return `${value.replace(".", ",")} h`;
}

function moneyInputToCents(value: string): bigint {
  return BigInt(moneyInputToApi(value).replace(".", ""));
}

function parseNonNegativeDecimal(value: string, fieldName: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Informe ${fieldName} corretamente.`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  return {
    units: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function divideAndRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("Não é possível dividir por zero.");
  }

  const isNegative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return isNegative ? -rounded : rounded;
}

function formatCents(value: bigint): string {
  const isNegative = value < 0n;
  const absolute = isNegative ? -value : value;
  const reais = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = (absolute % 100n).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}R$ ${reais},${cents}`;
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("Configure VITE_API_BASE_URL para conectar ao backend.");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Backend indisponivel. Tente novamente em instantes.");
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [importProfiles, setImportProfiles] = useState<CsvImportProfile[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [financialGoalProgressById, setFinancialGoalProgressById] = useState<
    Record<number, FinancialGoalProgress>
  >({});
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>([]);
  const [maintenanceStatusesById, setMaintenanceStatusesById] = useState<
    Record<number, MaintenancePlanStatus>
  >({});
  const [maintenanceRecordsByPlanId, setMaintenanceRecordsByPlanId] = useState<
    Record<number, MaintenanceRecord[]>
  >({});
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [financialInsights, setFinancialInsights] = useState<FinancialInsight[]>([]);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [costProfileForm, setCostProfileForm] =
    useState<VehicleCostProfileForm>(emptyCostProfileForm);
  const [workSessionForm, setWorkSessionForm] =
    useState<WorkSessionForm>(emptyWorkSessionForm);
  const [workSessionImportVehicleId, setWorkSessionImportVehicleId] = useState("");
  const [workSessionImportFile, setWorkSessionImportFile] = useState<File | null>(null);
  const [workSessionImportPreview, setWorkSessionImportPreview] =
    useState<WorkSessionImportPreview | null>(null);
  const [workSessionImportColumns, setWorkSessionImportColumns] = useState<string[]>([]);
  const [workSessionImportMapping, setWorkSessionImportMapping] =
    useState<WorkSessionImportMapping>(emptyWorkSessionImportMapping);
  const [workSessionImportResult, setWorkSessionImportResult] =
    useState<WorkSessionImportResult | null>(null);
  const [workSessionImportError, setWorkSessionImportError] = useState("");
  const [workSessionImportProfileName, setWorkSessionImportProfileName] = useState("");
  const [matchedWorkSessionImportProfile, setMatchedWorkSessionImportProfile] =
    useState<CsvImportProfile | null>(null);
  const [isWorkSessionImportVisible, setIsWorkSessionImportVisible] = useState(false);
  const [isWorkSessionImportDragging, setIsWorkSessionImportDragging] = useState(false);
  const [expenseImportVehicleId, setExpenseImportVehicleId] = useState("");
  const [expenseImportFile, setExpenseImportFile] = useState<File | null>(null);
  const [expenseImportPreview, setExpenseImportPreview] =
    useState<ExpenseImportPreview | null>(null);
  const [expenseImportColumns, setExpenseImportColumns] = useState<string[]>([]);
  const [expenseImportMapping, setExpenseImportMapping] =
    useState<ExpenseImportMapping>(emptyExpenseImportMapping);
  const [expenseImportResult, setExpenseImportResult] = useState<ExpenseImportResult | null>(null);
  const [expenseImportError, setExpenseImportError] = useState("");
  const [expenseImportProfileName, setExpenseImportProfileName] = useState("");
  const [matchedExpenseImportProfile, setMatchedExpenseImportProfile] =
    useState<CsvImportProfile | null>(null);
  const [isExpenseImportVisible, setIsExpenseImportVisible] = useState(false);
  const [isExpenseImportDragging, setIsExpenseImportDragging] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [recurringExpenseForm, setRecurringExpenseForm] =
    useState<RecurringExpenseForm>(emptyRecurringExpenseForm);
  const [financialGoalForm, setFinancialGoalForm] =
    useState<FinancialGoalForm>(emptyFinancialGoalForm);
  const [maintenancePlanForm, setMaintenancePlanForm] =
    useState<MaintenancePlanForm>(emptyMaintenancePlanForm);
  const [maintenanceRecordForm, setMaintenanceRecordForm] =
    useState<MaintenanceRecordForm>(emptyMaintenanceRecordForm);
  const [recordingMaintenancePlanId, setRecordingMaintenancePlanId] = useState<number | null>(null);
  const [quickStartForm, setQuickStartForm] = useState<QuickStartForm>(emptyQuickStartForm);
  const [quickStartResult, setQuickStartResult] = useState<QuickStartResult | null>(null);
  const [quickStartVisible, setQuickStartVisible] = useState(false);
  const [quickDailyEntryForm, setQuickDailyEntryForm] =
    useState<QuickDailyEntryForm>(emptyQuickDailyEntryForm);
  const [quickDailyEntryResult, setQuickDailyEntryResult] =
    useState<QuickDailyEntryResult | null>(null);
  const [quickDailyEntryShowDate, setQuickDailyEntryShowDate] = useState(false);
  const [pendingQuickDailyEntry, setPendingQuickDailyEntry] = useState(false);
  const [dailyExpenseForm, setDailyExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [dailyExpenseVisible, setDailyExpenseVisible] = useState(false);
  const [pendingQuickStartAction, setPendingQuickStartAction] = useState<
    "register" | "configure" | null
  >(null);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [costProfileVehicleId, setCostProfileVehicleId] = useState<number | null>(null);
  const [editingWorkSessionId, setEditingWorkSessionId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingRecurringExpenseId, setEditingRecurringExpenseId] = useState<number | null>(null);
  const [editingFinancialGoalId, setEditingFinancialGoalId] = useState<number | null>(null);
  const [editingMaintenancePlanId, setEditingMaintenancePlanId] = useState<number | null>(null);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("last7");
  const [dashboardVehicleId, setDashboardVehicleId] = useState("");
  const [customStartDate, setCustomStartDate] = useState(toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(toDateInputValue(new Date()));
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [financialInsightsError, setFinancialInsightsError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isWorkSessionsLoading, setIsWorkSessionsLoading] = useState(false);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [isRecurringExpensesLoading, setIsRecurringExpensesLoading] = useState(false);
  const [isFinancialGoalsLoading, setIsFinancialGoalsLoading] = useState(false);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isFinancialInsightsLoading, setIsFinancialInsightsLoading] = useState(false);
  const [isCostProfileLoading, setIsCostProfileLoading] = useState(false);
  const [isVehicleSaving, setIsVehicleSaving] = useState(false);
  const [isCostProfileSaving, setIsCostProfileSaving] = useState(false);
  const [isWorkSessionSaving, setIsWorkSessionSaving] = useState(false);
  const [isWorkSessionImportPreviewLoading, setIsWorkSessionImportPreviewLoading] =
    useState(false);
  const [isWorkSessionImportSaving, setIsWorkSessionImportSaving] = useState(false);
  const [isExpenseImportPreviewLoading, setIsExpenseImportPreviewLoading] = useState(false);
  const [isExpenseImportSaving, setIsExpenseImportSaving] = useState(false);
  const [isImportProfilesLoading, setIsImportProfilesLoading] = useState(false);
  const [isImportProfileSaving, setIsImportProfileSaving] = useState(false);
  const [isExpenseSaving, setIsExpenseSaving] = useState(false);
  const [isRecurringExpenseSaving, setIsRecurringExpenseSaving] = useState(false);
  const [isFinancialGoalSaving, setIsFinancialGoalSaving] = useState(false);
  const [isMaintenanceSaving, setIsMaintenanceSaving] = useState(false);
  const [isMaintenanceRecordSaving, setIsMaintenanceRecordSaving] = useState(false);
  const [isQuickDailyEntrySaving, setIsQuickDailyEntrySaving] = useState(false);
  const [isDailyExpenseSaving, setIsDailyExpenseSaving] = useState(false);

  function endSession(nextMessage = "") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setVehicles([]);
    setWorkSessions([]);
    setExpenses([]);
    setRecurringExpenses([]);
    setImportProfiles([]);
    setFinancialGoals([]);
    setFinancialGoalProgressById({});
    setMaintenancePlans([]);
    setMaintenanceStatusesById({});
    setMaintenanceRecordsByPlanId({});
    setFinancialSummary(null);
    setFinancialInsights([]);
    setEditingVehicleId(null);
    setCostProfileVehicleId(null);
    setEditingWorkSessionId(null);
    setEditingExpenseId(null);
    setEditingRecurringExpenseId(null);
    setEditingFinancialGoalId(null);
    setEditingMaintenancePlanId(null);
    setVehicleForm(emptyVehicleForm);
    setCostProfileForm(emptyCostProfileForm);
    setWorkSessionForm(emptyWorkSessionForm);
    setWorkSessionImportVehicleId("");
    setWorkSessionImportFile(null);
    setWorkSessionImportPreview(null);
    setWorkSessionImportColumns([]);
    setWorkSessionImportMapping(emptyWorkSessionImportMapping);
    setWorkSessionImportResult(null);
    setWorkSessionImportError("");
    setWorkSessionImportProfileName("");
    setMatchedWorkSessionImportProfile(null);
    setIsWorkSessionImportVisible(false);
    setIsWorkSessionImportDragging(false);
    setExpenseImportVehicleId("");
    setExpenseImportFile(null);
    setExpenseImportPreview(null);
    setExpenseImportColumns([]);
    setExpenseImportMapping(emptyExpenseImportMapping);
    setExpenseImportResult(null);
    setExpenseImportError("");
    setExpenseImportProfileName("");
    setMatchedExpenseImportProfile(null);
    setIsExpenseImportVisible(false);
    setIsExpenseImportDragging(false);
    setExpenseForm(emptyExpenseForm);
    setRecurringExpenseForm(emptyRecurringExpenseForm);
    setFinancialGoalForm(emptyFinancialGoalForm);
    setMaintenancePlanForm(emptyMaintenancePlanForm);
    setMaintenanceRecordForm(emptyMaintenanceRecordForm);
    setRecordingMaintenancePlanId(null);
    setQuickStartForm(emptyQuickStartForm);
    setQuickStartResult(null);
    setQuickStartVisible(false);
    setQuickDailyEntryForm(emptyQuickDailyEntryForm);
    setQuickDailyEntryResult(null);
    setQuickDailyEntryShowDate(false);
    setPendingQuickDailyEntry(false);
    setDailyExpenseForm(emptyExpenseForm);
    setDailyExpenseVisible(false);
    setPendingQuickStartAction(null);
    setMode("login");
    setPassword("");
    setSuccessMessage("");
    setDashboardError("");
    setFinancialInsightsError("");
    setMessage(nextMessage);
  }

  function getAuthHeaders(currentToken = token): Record<string, string> {
    return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
  }

  function getVehicleLabel(vehicleId: number): string {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle ? `${vehicle.name} · ${vehicle.brand} ${vehicle.model}` : "Veiculo removido";
  }

  function getCostProfileVehicle(): Vehicle | null {
    return vehicles.find((vehicle) => vehicle.id === costProfileVehicleId) ?? null;
  }

  function costProfileToForm(profile: VehicleCostProfile): VehicleCostProfileForm {
    return {
      ownership_type: profile.ownership_type,
      rental_monthly: formatOptionalMoneyForInput(profile.rental_monthly),
      financing_monthly: formatOptionalMoneyForInput(profile.financing_monthly),
      insurance_monthly: formatOptionalMoneyForInput(profile.insurance_monthly),
      ipva_annual: formatOptionalMoneyForInput(profile.ipva_annual),
      other_fixed_monthly: formatOptionalMoneyForInput(profile.other_fixed_monthly),
      maintenance_per_km: formatOptionalDecimalForInput(profile.maintenance_per_km),
      tires_per_km: formatOptionalDecimalForInput(profile.tires_per_km),
      oil_per_km: formatOptionalDecimalForInput(profile.oil_per_km),
      depreciation_per_km: formatOptionalDecimalForInput(profile.depreciation_per_km),
      fuel_efficiency_km_per_liter: formatOptionalDecimalForInput(
        profile.fuel_efficiency_km_per_liter,
      ),
    };
  }

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

  function buildDashboardPath(endpoint: string) {
    const params = new URLSearchParams();
    const { startDate, endDate } = getPeriodDates(
      dashboardPeriod,
      customStartDate,
      customEndDate,
    );

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    if (dashboardVehicleId) {
      params.set("vehicle_id", dashboardVehicleId);
    }

    const query = params.toString();
    return `${endpoint}${query ? `?${query}` : ""}`;
  }

  function buildFinancialSummaryPath() {
    return buildDashboardPath("/financial-summary");
  }

  function buildFinancialInsightsPath() {
    return buildDashboardPath("/financial-insights");
  }

  async function loadVehicles(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsVehiclesLoading(true);
    try {
      const nextVehicles = await requestApi<Vehicle[]>("/vehicles", {
        headers: getAuthHeaders(currentToken),
      });
      setVehicles(nextVehicles);
      setWorkSessionForm((currentForm) => ({
        ...currentForm,
        vehicle_id: currentForm.vehicle_id || String(nextVehicles[0]?.id ?? ""),
      }));
      setQuickDailyEntryForm((currentForm) => ({
        ...currentForm,
        vehicle_id:
          currentForm.vehicle_id ||
          (nextVehicles.length === 1 ? String(nextVehicles[0].id) : ""),
      }));
      setDailyExpenseForm((currentForm) => ({
        ...currentForm,
        vehicle_id:
          currentForm.vehicle_id ||
          (nextVehicles.length === 1 ? String(nextVehicles[0].id) : ""),
      }));
      setMaintenancePlanForm((currentForm) => ({
        ...currentForm,
        vehicle_id:
          currentForm.vehicle_id ||
          (nextVehicles.length === 1 ? String(nextVehicles[0].id) : ""),
      }));
      setWorkSessionImportVehicleId((currentVehicleId) => {
        if (nextVehicles.length === 1) {
          return String(nextVehicles[0].id);
        }

        if (nextVehicles.some((vehicle) => String(vehicle.id) === currentVehicleId)) {
          return currentVehicleId;
        }

        return "";
      });
      setExpenseImportVehicleId((currentVehicleId) => {
        if (nextVehicles.some((vehicle) => String(vehicle.id) === currentVehicleId)) {
          return currentVehicleId;
        }

        return "";
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao carregar veiculos.");
      }
    } finally {
      setIsVehiclesLoading(false);
    }
  }

  async function loadWorkSessions(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsWorkSessionsLoading(true);
    try {
      const nextWorkSessions = await requestApi<WorkSession[]>("/work-sessions", {
        headers: getAuthHeaders(currentToken),
      });
      setWorkSessions(nextWorkSessions);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao carregar jornadas.");
      }
    } finally {
      setIsWorkSessionsLoading(false);
    }
  }

  async function loadExpenses(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsExpensesLoading(true);
    try {
      const nextExpenses = await requestApi<Expense[]>("/expenses", {
        headers: getAuthHeaders(currentToken),
      });
      setExpenses(nextExpenses);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao carregar despesas.");
      }
    } finally {
      setIsExpensesLoading(false);
    }
  }

  async function loadRecurringExpenses(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsRecurringExpensesLoading(true);
    try {
      const nextRecurringExpenses = await requestApi<RecurringExpense[]>("/recurring-expenses", {
        headers: getAuthHeaders(currentToken),
      });
      setRecurringExpenses(nextRecurringExpenses);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Erro ao carregar despesas recorrentes.",
        );
      }
    } finally {
      setIsRecurringExpensesLoading(false);
    }
  }

  async function loadImportProfiles(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsImportProfilesLoading(true);
    try {
      const nextProfiles = await requestApi<CsvImportProfile[]>("/import-profiles", {
        headers: getAuthHeaders(currentToken),
      });
      setImportProfiles(nextProfiles);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "Erro ao carregar configuracoes de importacao.",
        );
      }
    } finally {
      setIsImportProfilesLoading(false);
    }
  }

  async function loadFinancialGoals(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsFinancialGoalsLoading(true);
    try {
      const nextFinancialGoals = await requestApi<FinancialGoal[]>("/financial-goals", {
        headers: getAuthHeaders(currentToken),
      });
      const progressEntries = await Promise.all(
        nextFinancialGoals.map(async (goal) => {
          const progress = await requestApi<FinancialGoalProgress>(
            `/financial-goals/${goal.id}/progress`,
            {
              headers: getAuthHeaders(currentToken),
            },
          );
          return [goal.id, progress] as const;
        }),
      );
      setFinancialGoals(nextFinancialGoals);
      setFinancialGoalProgressById(Object.fromEntries(progressEntries));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao carregar metas.");
      }
    } finally {
      setIsFinancialGoalsLoading(false);
    }
  }

  async function loadMaintenancePlans(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsMaintenanceLoading(true);
    try {
      const nextPlans = await requestApi<MaintenancePlan[]>("/maintenance-plans", {
        headers: getAuthHeaders(currentToken),
      });
      const statusEntries = await Promise.all(
        nextPlans.map(async (plan) => {
          const statusResponse = await requestApi<MaintenancePlanStatus>(
            `/maintenance-plans/${plan.id}/status`,
            {
              headers: getAuthHeaders(currentToken),
            },
          );
          return [plan.id, statusResponse] as const;
        }),
      );
      const recordEntries = await Promise.all(
        nextPlans.map(async (plan) => {
          const records = await requestApi<MaintenanceRecord[]>(
            `/maintenance-plans/${plan.id}/records`,
            {
              headers: getAuthHeaders(currentToken),
            },
          );
          return [plan.id, records] as const;
        }),
      );
      setMaintenancePlans(nextPlans);
      setMaintenanceStatusesById(Object.fromEntries(statusEntries));
      setMaintenanceRecordsByPlanId(Object.fromEntries(recordEntries));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao carregar manutencoes.");
      }
    } finally {
      setIsMaintenanceLoading(false);
    }
  }

  async function loadFinancialSummary(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsDashboardLoading(true);
    setDashboardError("");
    try {
      const summary = await requestApi<FinancialSummary>(buildFinancialSummaryPath(), {
        headers: getAuthHeaders(currentToken),
      });
      setFinancialSummary(summary);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setDashboardError(
          error instanceof Error ? error.message : "Erro ao carregar resumo financeiro.",
        );
      }
    } finally {
      setIsDashboardLoading(false);
    }
  }

  async function loadFinancialInsights(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsFinancialInsightsLoading(true);
    setFinancialInsightsError("");
    try {
      const response = await requestApi<FinancialInsightsResponse>(buildFinancialInsightsPath(), {
        headers: getAuthHeaders(currentToken),
      });
      setFinancialInsights(response.insights);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setFinancialInsights([]);
        setFinancialInsightsError("Não foi possível carregar os insights agora.");
      }
    } finally {
      setIsFinancialInsightsLoading(false);
    }
  }

  async function refreshDashboardData(currentToken = token) {
    await loadFinancialSummary(currentToken);
    await loadFinancialInsights(currentToken);
  }

  async function loadVehicleCostProfile(vehicleId: number, currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsCostProfileLoading(true);
    setMessage("");
    try {
      const profile = await requestApi<VehicleCostProfile>(
        `/vehicles/${vehicleId}/cost-profile`,
        {
          headers: getAuthHeaders(currentToken),
        },
      );
      setCostProfileForm(costProfileToForm(profile));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else if (error instanceof Error && error.message.includes("Registro nao encontrado")) {
        setCostProfileForm(emptyCostProfileForm);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Erro ao carregar perfil de custos.",
        );
      }
    } finally {
      setIsCostProfileLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setVehicles([]);
      setWorkSessions([]);
      setExpenses([]);
      setRecurringExpenses([]);
      setImportProfiles([]);
      setFinancialGoals([]);
      setFinancialGoalProgressById({});
      setMaintenancePlans([]);
      setMaintenanceStatusesById({});
      setMaintenanceRecordsByPlanId({});
      setFinancialSummary(null);
      setFinancialInsights([]);
      setCostProfileVehicleId(null);
      setCostProfileForm(emptyCostProfileForm);
      setWorkSessionImportVehicleId("");
      setWorkSessionImportFile(null);
      setWorkSessionImportPreview(null);
      setWorkSessionImportColumns([]);
      setWorkSessionImportMapping(emptyWorkSessionImportMapping);
      setWorkSessionImportResult(null);
      setWorkSessionImportError("");
      setWorkSessionImportProfileName("");
      setMatchedWorkSessionImportProfile(null);
      setIsWorkSessionImportVisible(false);
      setIsWorkSessionImportDragging(false);
      setExpenseImportVehicleId("");
      setExpenseImportFile(null);
      setExpenseImportPreview(null);
      setExpenseImportColumns([]);
      setExpenseImportMapping(emptyExpenseImportMapping);
      setExpenseImportResult(null);
      setExpenseImportError("");
      setExpenseImportProfileName("");
      setMatchedExpenseImportProfile(null);
      setIsExpenseImportVisible(false);
      setIsExpenseImportDragging(false);
      setMaintenancePlanForm(emptyMaintenancePlanForm);
      setMaintenanceRecordForm(emptyMaintenanceRecordForm);
      setRecordingMaintenancePlanId(null);
      setEditingMaintenancePlanId(null);
      return;
    }

    async function loadSession() {
      try {
        const currentUser = await requestApi<User>("/auth/me", {
          headers: getAuthHeaders(token),
        });
        setUser(currentUser);
        setMessage("");
        await loadVehicles(token);
        await loadImportProfiles(token);
        await loadWorkSessions(token);
        await loadExpenses(token);
        await loadRecurringExpenses(token);
        await loadFinancialGoals(token);
        await loadMaintenancePlans(token);
        await refreshDashboardData(token);
      } catch {
        endSession("Sessao expirada ou invalida. Entre novamente.");
      }
    }

    void loadSession();
  }, [token]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    void refreshDashboardData(token);
  }, [dashboardPeriod, dashboardVehicleId, customStartDate, customEndDate]);

  function resetForm(nextMode: AuthMode) {
    setMode(nextMode);
    setName("");
    setEmail("");
    setPassword("");
    setMessage("");
    setSuccessMessage("");
  }

  async function handleRegister() {
    await requestApi<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    setMode("login");
    setPassword("");
    setSuccessMessage("Cadastro realizado. Agora entre com seu email e senha.");
  }

  async function handleLogin() {
    const login = await requestApi<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem(TOKEN_STORAGE_KEY, login.access_token);
    setToken(login.access_token);
    setPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      if (mode === "register") {
        await handleRegister();
      } else {
        await handleLogin();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    endSession();
  }

  function handleEditVehicle(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      name: vehicle.name,
      brand: vehicle.brand,
      model: vehicle.model,
      year: String(vehicle.year),
      fuel_type: vehicle.fuel_type,
    });
    setMessage("");
    setSuccessMessage("");
  }

  function resetVehicleForm() {
    setEditingVehicleId(null);
    setVehicleForm(emptyVehicleForm);
  }

  function closeCostProfileForm() {
    setCostProfileVehicleId(null);
    setCostProfileForm(emptyCostProfileForm);
    setMessage("");
  }

  async function handleOpenCostProfile(vehicle: Vehicle) {
    setCostProfileVehicleId(vehicle.id);
    setCostProfileForm(emptyCostProfileForm);
    setMessage("");
    setSuccessMessage("");
    await loadVehicleCostProfile(vehicle.id);
  }

  function getWorkedMinutesFromFields(hoursValue: string, minutesValue: string): number {
    if (!/^\d+$/.test(hoursValue) || !/^\d+$/.test(minutesValue)) {
      throw new Error("Informe as horas e os minutos trabalhados.");
    }

    const hours = Number(hoursValue);
    const minutes = Number(minutesValue);
    if (!Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes) || minutes > 59) {
      throw new Error("Verifique o tempo trabalhado.");
    }

    const totalMinutes = hours * 60 + minutes;
    if (!Number.isSafeInteger(totalMinutes) || totalMinutes <= 0) {
      throw new Error("Informe um tempo trabalhado maior que zero.");
    }

    return totalMinutes;
  }

  function getOptionalTripCount(value: string): number {
    if (!value.trim()) {
      return 0;
    }

    if (!/^\d+$/.test(value)) {
      throw new Error("Informe o número de corridas corretamente.");
    }

    const tripCount = Number(value);
    if (!Number.isSafeInteger(tripCount)) {
      throw new Error("Informe o número de corridas corretamente.");
    }

    return tripCount;
  }

  function getQuickStartWorkedMinutes(): number {
    return getWorkedMinutesFromFields(quickStartForm.worked_hours, quickStartForm.worked_minutes);
  }

  function getQuickStartTripCount(): number {
    return getOptionalTripCount(quickStartForm.trip_count);
  }

  function getQuickDailyVehicle(): Vehicle | null {
    if (vehicles.length === 1) {
      return vehicles[0];
    }

    return vehicles.find((vehicle) => String(vehicle.id) === quickDailyEntryForm.vehicle_id) ?? null;
  }

  function getQuickDailyWorkedMinutes(): number {
    return getWorkedMinutesFromFields(
      quickDailyEntryForm.worked_hours,
      quickDailyEntryForm.worked_minutes,
    );
  }

  function getQuickDailyTripCount(): number {
    return getOptionalTripCount(quickDailyEntryForm.trip_count);
  }

  function calculateQuickStart(): QuickStartResult {
    const grossRevenueCents = moneyInputToCents(quickStartForm.gross_revenue);
    const fuelExpenseCents = moneyInputToCents(quickStartForm.fuel_expense);
    const distance = parseNonNegativeDecimal(quickStartForm.distance_km, "os km rodados");
    const workedMinutes = getQuickStartWorkedMinutes();
    const tripCount = getQuickStartTripCount();

    if (distance.scale > 3 || distance.units <= 0n || grossRevenueCents < 0n || fuelExpenseCents < 0n) {
      throw new Error("Informe valores possíveis para a simulação.");
    }

    const remainingCents = grossRevenueCents - fuelExpenseCents;
    return {
      grossRevenueCents,
      fuelExpenseCents,
      remainingCents,
      remainingPerHourCents: divideAndRound(remainingCents * 60n, BigInt(workedMinutes)),
      remainingPerKmCents: divideAndRound(
        remainingCents * 10n ** BigInt(distance.scale),
        distance.units,
      ),
      averageTicketCents:
        tripCount > 0 ? divideAndRound(grossRevenueCents, BigInt(tripCount)) : null,
    };
  }

  function calculateQuickDailyEntry(vehicle: Vehicle): QuickDailyEntryResult {
    const grossRevenueCents = moneyInputToCents(quickDailyEntryForm.gross_revenue);
    const distance = parseNonNegativeDecimal(quickDailyEntryForm.distance_km, "os km rodados");
    const workedMinutes = getQuickDailyWorkedMinutes();
    const tripCount = getQuickDailyTripCount();

    if (distance.scale > 3 || distance.units <= 0n || grossRevenueCents < 0n) {
      throw new Error("Informe valores possiveis para registrar o dia.");
    }

    return {
      grossRevenueCents,
      grossPerHourCents: divideAndRound(grossRevenueCents * 60n, BigInt(workedMinutes)),
      grossPerKmCents: divideAndRound(
        grossRevenueCents * 10n ** BigInt(distance.scale),
        distance.units,
      ),
      tripCount,
      vehicle,
      workDate: quickDailyEntryForm.work_date || toDateInputValue(new Date()),
    };
  }

  async function saveQuickDailyEntry(vehicle: Vehicle) {
    const result = calculateQuickDailyEntry(vehicle);
    const workedMinutes = getQuickDailyWorkedMinutes();
    const tripCount = getQuickDailyTripCount();

    await requestApi<WorkSession>("/work-sessions", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        work_date: result.workDate,
        gross_revenue: moneyInputToApi(quickDailyEntryForm.gross_revenue),
        distance_km: normalizeDecimalInput(quickDailyEntryForm.distance_km),
        worked_minutes: workedMinutes,
        trip_count: tripCount,
      }),
    });

    setPendingQuickDailyEntry(false);
    setQuickDailyEntryResult(result);
    setDailyExpenseForm({
      ...emptyExpenseForm,
      expense_date: result.workDate,
      vehicle_id: String(vehicle.id),
    });
    setDailyExpenseVisible(false);
    setQuickDailyEntryForm({
      ...emptyQuickDailyEntryForm,
      work_date: toDateInputValue(new Date()),
      vehicle_id: String(vehicle.id),
    });
    setQuickDailyEntryShowDate(false);
    setSuccessMessage("Dia registrado com sucesso.");
    await loadWorkSessions();
    await refreshDashboardData();
    requestAnimationFrame(() =>
      document.getElementById("registro-rapido")?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  async function handleQuickDailyEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsQuickDailyEntrySaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const vehicle = getQuickDailyVehicle();
      if (!vehicle) {
        setPendingQuickDailyEntry(true);
        setMessage("Cadastre seu veiculo para salvar o dia. Seus dados foram mantidos.");
        document.getElementById("veiculos")?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      await saveQuickDailyEntry(vehicle);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar seu dia.");
      }
    } finally {
      setIsQuickDailyEntrySaving(false);
    }
  }

  function handleViewCompleteResult() {
    if (quickDailyEntryResult) {
      const today = toDateInputValue(new Date());
      setDashboardPeriod(quickDailyEntryResult.workDate === today ? "today" : "custom");
      setDashboardVehicleId(String(quickDailyEntryResult.vehicle.id));
      setCustomStartDate(quickDailyEntryResult.workDate);
      setCustomEndDate(quickDailyEntryResult.workDate);
    }

    requestAnimationFrame(() =>
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  function openDailyExpenseShortcut() {
    if (!quickDailyEntryResult) {
      return;
    }

    setDailyExpenseForm({
      ...emptyExpenseForm,
      expense_date: quickDailyEntryResult.workDate,
      vehicle_id: String(quickDailyEntryResult.vehicle.id),
    });
    setDailyExpenseVisible(true);
  }

  async function handleDailyExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDailyExpenseSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<Expense>("/expenses", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          expense_date: dailyExpenseForm.expense_date,
          category: dailyExpenseForm.category,
          amount: moneyInputToApi(dailyExpenseForm.amount),
          description: dailyExpenseForm.description.trim() || null,
          ...(dailyExpenseForm.vehicle_id ? { vehicle_id: Number(dailyExpenseForm.vehicle_id) } : {}),
        }),
      });

      setDailyExpenseVisible(false);
      setDailyExpenseForm(emptyExpenseForm);
      setSuccessMessage("Gasto de hoje adicionado com sucesso.");
      await loadExpenses();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o gasto.");
      }
    } finally {
      setIsDailyExpenseSaving(false);
    }
  }

  function handleQuickStartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccessMessage("");

    try {
      setQuickStartResult(calculateQuickStart());
    } catch (error) {
      setQuickStartResult(null);
      setMessage(error instanceof Error ? error.message : "Não foi possível calcular a estimativa.");
    }
  }

  async function handleQuickStartConfigure(vehicle = vehicles[0]) {
    if (!vehicle) {
      setPendingQuickStartAction("configure");
      setMessage("Cadastre seu veículo primeiro. Seus dados da simulação foram mantidos.");
      document.getElementById("veiculos")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setPendingQuickStartAction(null);
    await handleOpenCostProfile(vehicle);
    setCostProfileForm((currentForm) => ({
      ...currentForm,
      ownership_type: quickStartForm.ownership_type,
      rental_monthly:
        quickStartForm.ownership_type === "rented" ? quickStartForm.rental_monthly : "",
      financing_monthly:
        quickStartForm.ownership_type === "financed" ? quickStartForm.financing_monthly : "",
    }));
    document.getElementById("veiculos")?.scrollIntoView({ behavior: "smooth" });
  }

  async function registerQuickStartDay(vehicle: Vehicle) {
    const workedMinutes = getQuickStartWorkedMinutes();
    const tripCount = getQuickStartTripCount();
    const fuelExpenseCents = moneyInputToCents(quickStartForm.fuel_expense);
    const workDate = toDateInputValue(new Date());

    await requestApi<WorkSession>("/work-sessions/quick-start", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        work_date: workDate,
        gross_revenue: moneyInputToApi(quickStartForm.gross_revenue),
        distance_km: normalizeDecimalInput(quickStartForm.distance_km),
        worked_minutes: workedMinutes,
        trip_count: tripCount,
        ...(fuelExpenseCents > 0n
          ? {
              expense_amount: moneyInputToApi(quickStartForm.fuel_expense),
              expense_category: quickStartForm.expense_category,
            }
          : {}),
      }),
    });

    setPendingQuickStartAction(null);
    setSuccessMessage("Seu primeiro dia foi registrado com os dados da simulação.");
    await loadWorkSessions();
    await loadExpenses();
    await refreshDashboardData();
    document.getElementById("jornadas")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleQuickStartRegister() {
    if (!quickStartResult) {
      return;
    }

    setMessage("");
    setSuccessMessage("");
    if (!vehicles[0]) {
      setPendingQuickStartAction("register");
      setMessage("Cadastre seu veículo para registrar o dia. Seus dados da simulação foram mantidos.");
      document.getElementById("veiculos")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    try {
      await registerQuickStartDay(vehicles[0]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar o dia.");
    }
  }

  async function handleVehicleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVehicleSaving(true);
    setMessage("");
    setSuccessMessage("");

    const payload = {
      name: vehicleForm.name,
      brand: vehicleForm.brand,
      model: vehicleForm.model,
      year: Number(vehicleForm.year),
      fuel_type: vehicleForm.fuel_type,
    };

    try {
      let savedVehicle: Vehicle | null = null;
      if (editingVehicleId) {
        await requestApi<Vehicle>(`/vehicles/${editingVehicleId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Veiculo atualizado com sucesso.");
      } else {
        savedVehicle = await requestApi<Vehicle>("/vehicles", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Veiculo cadastrado com sucesso.");
      }

      resetVehicleForm();
      await loadVehicles();
      if (savedVehicle && pendingQuickStartAction === "register") {
        await registerQuickStartDay(savedVehicle);
      }
      if (savedVehicle && pendingQuickStartAction === "configure") {
        await handleQuickStartConfigure(savedVehicle);
      }
      if (savedVehicle && pendingQuickDailyEntry) {
        await saveQuickDailyEntry(savedVehicle);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar veiculo.");
      }
    } finally {
      setIsVehicleSaving(false);
    }
  }

  async function handleDeleteVehicle(vehicle: Vehicle) {
    const shouldDelete = window.confirm(`Excluir o veiculo "${vehicle.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/vehicles/${vehicle.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Veiculo excluido com sucesso.");
      if (costProfileVehicleId === vehicle.id) {
        closeCostProfileForm();
      }
      await loadVehicles();
      await loadWorkSessions();
      await loadExpenses();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir veiculo.");
      }
    }
  }

  async function handleCostProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!costProfileVehicleId) {
      return;
    }

    setIsCostProfileSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        ownership_type: costProfileForm.ownership_type,
        rental_monthly: optionalMoneyInputToApi(costProfileForm.rental_monthly),
        financing_monthly: optionalMoneyInputToApi(costProfileForm.financing_monthly),
        insurance_monthly: optionalMoneyInputToApi(costProfileForm.insurance_monthly),
        ipva_annual: optionalMoneyInputToApi(costProfileForm.ipva_annual),
        other_fixed_monthly: optionalMoneyInputToApi(costProfileForm.other_fixed_monthly),
        maintenance_per_km: optionalDecimalInputToApi(costProfileForm.maintenance_per_km),
        tires_per_km: optionalDecimalInputToApi(costProfileForm.tires_per_km),
        oil_per_km: optionalDecimalInputToApi(costProfileForm.oil_per_km),
        depreciation_per_km: optionalDecimalInputToApi(costProfileForm.depreciation_per_km),
        fuel_efficiency_km_per_liter: optionalDecimalInputToApi(
          costProfileForm.fuel_efficiency_km_per_liter,
        ),
      };

      const profile = await requestApi<VehicleCostProfile>(
        `/vehicles/${costProfileVehicleId}/cost-profile`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );
      setCostProfileForm(costProfileToForm(profile));
      setSuccessMessage("Perfil de custos salvo com sucesso.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar perfil de custos.");
      }
    } finally {
      setIsCostProfileSaving(false);
    }
  }

  function resetWorkSessionForm() {
    setEditingWorkSessionId(null);
    setWorkSessionForm({
      ...emptyWorkSessionForm,
      vehicle_id: String(vehicles[0]?.id ?? ""),
    });
  }

  function handleEditWorkSession(workSession: WorkSession) {
    setEditingWorkSessionId(workSession.id);
    setWorkSessionForm({
      work_date: workSession.work_date,
      vehicle_id: String(workSession.vehicle_id),
      gross_revenue: formatMoney(workSession.gross_revenue).replace("R$ ", ""),
      distance_km: formatDistance(workSession.distance_km),
      worked_hours: String(Math.floor(workSession.worked_minutes / 60)),
      worked_minutes: String(workSession.worked_minutes % 60),
      trip_count: String(workSession.trip_count),
    });
    setMessage("");
    setSuccessMessage("");
  }

  async function handleWorkSessionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorkSessionSaving(true);
    setMessage("");
    setSuccessMessage("");

    const workedHours = Number(workSessionForm.worked_hours || "0");
    const workedMinutes = Number(workSessionForm.worked_minutes || "0");
    const totalWorkedMinutes = workedHours * 60 + workedMinutes;

    try {
      const payload = {
        vehicle_id: Number(workSessionForm.vehicle_id),
        work_date: workSessionForm.work_date,
        gross_revenue: moneyInputToApi(workSessionForm.gross_revenue),
        distance_km: normalizeDecimalInput(workSessionForm.distance_km),
        worked_minutes: totalWorkedMinutes,
        trip_count: Number(workSessionForm.trip_count),
      };

      if (editingWorkSessionId) {
        await requestApi<WorkSession>(`/work-sessions/${editingWorkSessionId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Jornada atualizada com sucesso.");
      } else {
        await requestApi<WorkSession>("/work-sessions", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Jornada cadastrada com sucesso.");
      }

      resetWorkSessionForm();
      await loadWorkSessions();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar jornada.");
      }
    } finally {
      setIsWorkSessionSaving(false);
    }
  }

  async function handleDeleteWorkSession(workSession: WorkSession) {
    const shouldDelete = window.confirm(`Excluir a jornada de ${formatDate(workSession.work_date)}?`);
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/work-sessions/${workSession.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Jornada excluida com sucesso.");
      await loadWorkSessions();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir jornada.");
      }
    }
  }

  function getWorkSessionImportVehicleLabel(): string {
    const vehicle = vehicles.find((item) => String(item.id) === workSessionImportVehicleId);
    return vehicle ? `${vehicle.name} - ${vehicle.brand} ${vehicle.model}` : "veículo selecionado";
  }

  function buildWorkSessionImportMappingParam(
    mapping: Partial<WorkSessionImportMapping>,
  ): string | null {
    const entries = Object.entries(mapping).filter(([, value]) => value);
    if (entries.length === 0) {
      return null;
    }

    return JSON.stringify(Object.fromEntries(entries));
  }

  function previewToImportMapping(preview: WorkSessionImportPreview): WorkSessionImportMapping {
    return {
      ...emptyWorkSessionImportMapping,
      ...preview.suggested_mapping,
      ...preview.column_mapping,
    };
  }

  function profileToWorkSessionImportMapping(
    mapping: CsvImportColumnMapping | null,
  ): WorkSessionImportMapping {
    return {
      ...emptyWorkSessionImportMapping,
      date: mapping?.date ?? "",
      gross_revenue: mapping?.gross_revenue ?? "",
      distance_km: mapping?.distance_km ?? "",
      worked_minutes: mapping?.worked_minutes ?? "",
      trip_count: mapping?.trip_count ?? "",
    };
  }

  function profileToExpenseImportMapping(
    mapping: CsvImportColumnMapping | null,
  ): ExpenseImportMapping {
    return {
      ...emptyExpenseImportMapping,
      expense_date: mapping?.expense_date ?? "",
      amount: mapping?.amount ?? "",
      category: mapping?.category ?? "",
      description: mapping?.description ?? "",
    };
  }

  function areImportMappingsEqual(
    first: Partial<Record<WorkSessionImportField, string>>,
    second: CsvImportColumnMapping,
  ): boolean {
    return workSessionImportMappingFields.every(
      (item) => (first[item.field] ?? "") === (second[item.field] ?? ""),
    );
  }

  function areExpenseImportMappingsEqual(
    first: Partial<Record<ExpenseImportField, string>>,
    second: CsvImportColumnMapping,
  ): boolean {
    return expenseImportMappingFields.every(
      (item) => (first[item.field] ?? "") === (second[item.field] ?? ""),
    );
  }

  function getImportProfileVehicleLabel(profile: CsvImportProfile): string {
    if (!profile.vehicle_id) {
      return "Sem veiculo salvo";
    }

    return getVehicleLabel(profile.vehicle_id);
  }

  function getWorkSessionImportPath(
    preview = false,
    mapping: Partial<WorkSessionImportMapping> = {},
  ): string {
    const params = new URLSearchParams({ vehicle_id: workSessionImportVehicleId });
    const mappingParam = buildWorkSessionImportMappingParam(mapping);
    if (mappingParam) {
      params.set("column_mapping", mappingParam);
    }

    return `/imports/work-sessions${preview ? "/preview" : ""}?${params.toString()}`;
  }

  function clearWorkSessionImportFile() {
    setWorkSessionImportFile(null);
    setWorkSessionImportPreview(null);
    setWorkSessionImportColumns([]);
    setWorkSessionImportMapping(emptyWorkSessionImportMapping);
    setWorkSessionImportResult(null);
    setWorkSessionImportError("");
    setWorkSessionImportProfileName("");
    setMatchedWorkSessionImportProfile(null);
    setIsWorkSessionImportDragging(false);
  }

  function handleWorkSessionImportFile(file: File | null) {
    if (!file) {
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    if (!isCsv) {
      clearWorkSessionImportFile();
      setWorkSessionImportError("Selecione um arquivo CSV.");
      return;
    }

    setWorkSessionImportFile(file);
    setWorkSessionImportPreview(null);
    setWorkSessionImportColumns([]);
    setWorkSessionImportMapping(emptyWorkSessionImportMapping);
    setWorkSessionImportResult(null);
    setWorkSessionImportError("");
    setWorkSessionImportProfileName("");
    setMatchedWorkSessionImportProfile(null);
  }

  function handleWorkSessionImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleWorkSessionImportFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleWorkSessionImportDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsWorkSessionImportDragging(false);
    handleWorkSessionImportFile(event.dataTransfer.files[0] ?? null);
  }

  function downloadWorkSessionImportTemplate() {
    const csvTemplate =
      "date,gross_revenue,distance_km,worked_minutes,trip_count\n" +
      "2026-09-20,350.50,180.4,480,22\n" +
      "2026-09-21,410.00,205.0,530,25\n";
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-jornadas-ganhocerto.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function matchWorkSessionImportProfile(
    headers: string[],
    preview: WorkSessionImportPreview,
  ) {
    if (!headers.length) {
      setMatchedWorkSessionImportProfile(null);
      return;
    }

    try {
      const match = await requestApi<CsvImportProfileMatchResponse>("/import-profiles/match", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ import_type: "work_sessions", headers }),
      });

      if (!match.profile) {
        setMatchedWorkSessionImportProfile(null);
        return;
      }

      setMatchedWorkSessionImportProfile(match.profile);
      setWorkSessionImportMapping(profileToWorkSessionImportMapping(match.column_mapping));
      if (
        match.column_mapping &&
        !areImportMappingsEqual(preview.column_mapping, match.column_mapping)
      ) {
        setWorkSessionImportPreview(null);
      }
      if (
        match.vehicle_id &&
        vehicles.some((vehicle) => vehicle.id === match.vehicle_id)
      ) {
        setWorkSessionImportVehicleId(String(match.vehicle_id));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      }
    }
  }

  async function handleSaveWorkSessionImportProfile() {
    if (
      !workSessionImportPreview ||
      workSessionImportPreview.invalid_rows > 0 ||
      !workSessionImportColumns.length ||
      !workSessionImportProfileName.trim()
    ) {
      return;
    }

    setIsImportProfileSaving(true);
    setWorkSessionImportError("");
    setExpenseImportError("");

    try {
      const profile = await requestApi<CsvImportProfile>("/import-profiles", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: workSessionImportProfileName,
          import_type: "work_sessions",
          headers: workSessionImportColumns,
          column_mapping: workSessionImportPreview.column_mapping,
          vehicle_id: workSessionImportVehicleId ? Number(workSessionImportVehicleId) : null,
        }),
      });
      setMatchedWorkSessionImportProfile(profile);
      setWorkSessionImportProfileName("");
      setSuccessMessage("Configuracao de importacao salva.");
      await loadImportProfiles();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setWorkSessionImportError(
          error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao.",
        );
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleRenameImportProfile(profile: CsvImportProfile) {
    const nextName = window.prompt("Novo nome da configuracao", profile.name)?.trim();
    if (!nextName || nextName === profile.name) {
      return;
    }

    setIsImportProfileSaving(true);
    setWorkSessionImportError("");

    try {
      const updatedProfile = await requestApi<CsvImportProfile>(
        `/import-profiles/${profile.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ name: nextName }),
        },
      );
      setImportProfiles((currentProfiles) =>
        currentProfiles.map((item) => (item.id === updatedProfile.id ? updatedProfile : item)),
      );
      if (matchedWorkSessionImportProfile?.id === updatedProfile.id) {
        setMatchedWorkSessionImportProfile(updatedProfile);
      }
      if (matchedExpenseImportProfile?.id === updatedProfile.id) {
        setMatchedExpenseImportProfile(updatedProfile);
      }
      setSuccessMessage("Configuracao renomeada.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Nao foi possivel renomear a configuracao.";
        setWorkSessionImportError(errorMessage);
        setExpenseImportError(errorMessage);
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleDeleteImportProfile(profile: CsvImportProfile) {
    const shouldDelete = window.confirm(`Excluir configuracao "${profile.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setIsImportProfileSaving(true);
    setWorkSessionImportError("");
    setExpenseImportError("");

    try {
      await requestApi<void>(`/import-profiles/${profile.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setImportProfiles((currentProfiles) =>
        currentProfiles.filter((item) => item.id !== profile.id),
      );
      if (matchedWorkSessionImportProfile?.id === profile.id) {
        setMatchedWorkSessionImportProfile(null);
      }
      if (matchedExpenseImportProfile?.id === profile.id) {
        setMatchedExpenseImportProfile(null);
      }
      setSuccessMessage("Configuracao excluida.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Nao foi possivel excluir a configuracao.";
        setWorkSessionImportError(errorMessage);
        setExpenseImportError(errorMessage);
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleWorkSessionImportPreview() {
    if (!workSessionImportVehicleId) {
      setWorkSessionImportError("Selecione um veículo para importar as jornadas.");
      return;
    }

    if (!workSessionImportFile) {
      setWorkSessionImportError("Selecione um arquivo CSV para continuar.");
      return;
    }

    setIsWorkSessionImportPreviewLoading(true);
    setWorkSessionImportError("");
    setWorkSessionImportResult(null);

    try {
      const preview = await requestApi<WorkSessionImportPreview>(
        getWorkSessionImportPath(true, workSessionImportMapping),
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "text/csv",
          },
          body: workSessionImportFile,
        },
      );
      setWorkSessionImportPreview(preview);
      setWorkSessionImportColumns(preview.columns_found);
      setWorkSessionImportMapping(previewToImportMapping(preview));
      await matchWorkSessionImportProfile(preview.columns_found, preview);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setWorkSessionImportPreview(null);
        setWorkSessionImportError(
          error instanceof Error ? error.message : "Não foi possível validar o CSV.",
        );
      }
    } finally {
      setIsWorkSessionImportPreviewLoading(false);
    }
  }

  async function handleConfirmWorkSessionImport() {
    if (!workSessionImportPreview || !workSessionImportFile || !workSessionImportVehicleId) {
      return;
    }

    if (workSessionImportPreview.invalid_rows > 0 || workSessionImportPreview.valid_rows === 0) {
      return;
    }

    const shouldImport = window.confirm(
      `Confirmar importação de ${workSessionImportPreview.valid_rows} jornadas para ${getWorkSessionImportVehicleLabel()}?`,
    );
    if (!shouldImport) {
      return;
    }

    setIsWorkSessionImportSaving(true);
    setWorkSessionImportError("");
    setWorkSessionImportResult(null);

    try {
      const result = await requestApi<WorkSessionImportResult>(
        getWorkSessionImportPath(false, workSessionImportPreview.column_mapping),
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "text/csv",
          },
          body: workSessionImportFile,
        },
      );
      setWorkSessionImportResult(result);
      setWorkSessionImportPreview(null);
      setWorkSessionImportFile(null);
      setWorkSessionImportColumns([]);
      setWorkSessionImportMapping(emptyWorkSessionImportMapping);
      setMatchedWorkSessionImportProfile(null);
      setWorkSessionImportProfileName("");
      setSuccessMessage("Importação concluída.");
      await loadWorkSessions();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setWorkSessionImportError(
          error instanceof Error ? error.message : "Não foi possível importar o CSV.",
        );
      }
    } finally {
      setIsWorkSessionImportSaving(false);
    }
  }

  function buildExpenseImportMappingParam(
    mapping: Partial<ExpenseImportMapping>,
  ): string | null {
    const entries = Object.entries(mapping).filter(([, value]) => value);
    if (entries.length === 0) {
      return null;
    }

    return JSON.stringify(Object.fromEntries(entries));
  }

  function expensePreviewToImportMapping(preview: ExpenseImportPreview): ExpenseImportMapping {
    return {
      ...emptyExpenseImportMapping,
      ...preview.suggested_mapping,
      ...preview.column_mapping,
    };
  }

  function getExpenseImportPath(
    preview = false,
    mapping: Partial<ExpenseImportMapping> = {},
  ): string {
    const params = new URLSearchParams();
    if (expenseImportVehicleId) {
      params.set("vehicle_id", expenseImportVehicleId);
    }

    const mappingParam = buildExpenseImportMappingParam(mapping);
    if (mappingParam) {
      params.set("column_mapping", mappingParam);
    }

    const query = params.toString();
    return `/imports/expenses${preview ? "/preview" : ""}${query ? `?${query}` : ""}`;
  }

  function clearExpenseImportFile() {
    setExpenseImportFile(null);
    setExpenseImportPreview(null);
    setExpenseImportColumns([]);
    setExpenseImportMapping(emptyExpenseImportMapping);
    setExpenseImportResult(null);
    setExpenseImportError("");
    setExpenseImportProfileName("");
    setMatchedExpenseImportProfile(null);
    setIsExpenseImportDragging(false);
  }

  function handleExpenseImportFile(file: File | null) {
    if (!file) {
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    if (!isCsv) {
      clearExpenseImportFile();
      setExpenseImportError("Selecione um arquivo CSV.");
      return;
    }

    setExpenseImportFile(file);
    setExpenseImportPreview(null);
    setExpenseImportColumns([]);
    setExpenseImportMapping(emptyExpenseImportMapping);
    setExpenseImportResult(null);
    setExpenseImportError("");
    setExpenseImportProfileName("");
    setMatchedExpenseImportProfile(null);
  }

  function handleExpenseImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleExpenseImportFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleExpenseImportDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsExpenseImportDragging(false);
    handleExpenseImportFile(event.dataTransfer.files[0] ?? null);
  }

  function downloadExpenseImportTemplate() {
    const csvTemplate =
      "expense_date,amount,category,description\n" +
      "2026-09-20,95.50,fuel,Abastecimento\n" +
      "2026-09-21,18.00,toll,Pedagio\n";
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-despesas-ganhocerto.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function matchExpenseImportProfile(headers: string[], preview: ExpenseImportPreview) {
    if (!headers.length) {
      setMatchedExpenseImportProfile(null);
      return;
    }

    try {
      const match = await requestApi<CsvImportProfileMatchResponse>("/import-profiles/match", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ import_type: "expenses", headers }),
      });

      if (!match.profile) {
        setMatchedExpenseImportProfile(null);
        return;
      }

      setMatchedExpenseImportProfile(match.profile);
      setExpenseImportMapping(profileToExpenseImportMapping(match.column_mapping));
      if (
        match.column_mapping &&
        !areExpenseImportMappingsEqual(preview.column_mapping, match.column_mapping)
      ) {
        setExpenseImportPreview(null);
      }
      if (
        match.vehicle_id &&
        vehicles.some((vehicle) => vehicle.id === match.vehicle_id)
      ) {
        setExpenseImportVehicleId(String(match.vehicle_id));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      }
    }
  }

  function handleIgnoreExpenseImportProfile() {
    setMatchedExpenseImportProfile(null);
    if (expenseImportPreview) {
      setExpenseImportMapping(expensePreviewToImportMapping(expenseImportPreview));
    }
  }

  async function handleSaveExpenseImportProfile() {
    if (
      !expenseImportPreview ||
      expenseImportPreview.invalid_rows > 0 ||
      !expenseImportColumns.length
    ) {
      return;
    }

    setIsImportProfileSaving(true);
    setExpenseImportError("");

    try {
      const profile = await requestApi<CsvImportProfile>("/import-profiles", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: expenseImportProfileName.trim() || "Despesas CSV",
          import_type: "expenses",
          headers: expenseImportColumns,
          column_mapping: expenseImportPreview.column_mapping,
          vehicle_id: expenseImportVehicleId ? Number(expenseImportVehicleId) : null,
        }),
      });
      setMatchedExpenseImportProfile(profile);
      setExpenseImportProfileName("");
      setSuccessMessage("Configuracao de importacao salva.");
      await loadImportProfiles();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setExpenseImportError(
          error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao.",
        );
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleExpenseImportPreview() {
    if (!expenseImportFile) {
      setExpenseImportError("Selecione um arquivo CSV para continuar.");
      return;
    }

    setIsExpenseImportPreviewLoading(true);
    setExpenseImportError("");
    setExpenseImportResult(null);

    try {
      const preview = await requestApi<ExpenseImportPreview>(
        getExpenseImportPath(true, expenseImportMapping),
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "text/csv",
          },
          body: expenseImportFile,
        },
      );
      setExpenseImportPreview(preview);
      setExpenseImportColumns(preview.columns_found);
      setExpenseImportMapping(expensePreviewToImportMapping(preview));
      await matchExpenseImportProfile(preview.columns_found, preview);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setExpenseImportPreview(null);
        setExpenseImportError(
          error instanceof Error ? error.message : "Nao foi possivel validar o CSV.",
        );
      }
    } finally {
      setIsExpenseImportPreviewLoading(false);
    }
  }

  async function handleConfirmExpenseImport() {
    if (!expenseImportPreview || !expenseImportFile) {
      return;
    }

    if (expenseImportPreview.invalid_rows > 0 || expenseImportPreview.valid_rows === 0) {
      return;
    }

    const shouldImport = window.confirm(
      `Confirmar importacao de ${expenseImportPreview.valid_rows} despesas?`,
    );
    if (!shouldImport) {
      return;
    }

    setIsExpenseImportSaving(true);
    setExpenseImportError("");
    setExpenseImportResult(null);

    try {
      const result = await requestApi<ExpenseImportResult>(
        getExpenseImportPath(false, expenseImportPreview.column_mapping),
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "text/csv",
          },
          body: expenseImportFile,
        },
      );
      setExpenseImportResult(result);
      setExpenseImportPreview(null);
      setExpenseImportFile(null);
      setExpenseImportColumns([]);
      setExpenseImportMapping(emptyExpenseImportMapping);
      setMatchedExpenseImportProfile(null);
      setExpenseImportProfileName("");
      setSuccessMessage("Importacao concluida.");
      await loadExpenses();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setExpenseImportError(
          error instanceof Error ? error.message : "Nao foi possivel importar o CSV.",
        );
      }
    } finally {
      setIsExpenseImportSaving(false);
    }
  }

  function resetExpenseForm() {
    setEditingExpenseId(null);
    setExpenseForm(emptyExpenseForm);
  }

  function handleEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expense_date: expense.expense_date,
      category: expense.category,
      amount: formatMoney(expense.amount).replace("R$ ", ""),
      vehicle_id: expense.vehicle_id ? String(expense.vehicle_id) : "",
      description: expense.description ?? "",
    });
    setMessage("");
    setSuccessMessage("");
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsExpenseSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        amount: moneyInputToApi(expenseForm.amount),
        description: expenseForm.description.trim() || null,
        ...(expenseForm.vehicle_id ? { vehicle_id: Number(expenseForm.vehicle_id) } : {}),
      };

      if (editingExpenseId) {
        await requestApi<Expense>(`/expenses/${editingExpenseId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Despesa atualizada com sucesso.");
      } else {
        await requestApi<Expense>("/expenses", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Despesa cadastrada com sucesso.");
      }

      resetExpenseForm();
      await loadExpenses();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar despesa.");
      }
    } finally {
      setIsExpenseSaving(false);
    }
  }

  async function handleDeleteExpense(expense: Expense) {
    const shouldDelete = window.confirm(`Excluir a despesa de ${formatDate(expense.expense_date)}?`);
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/expenses/${expense.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Despesa excluida com sucesso.");
      await loadExpenses();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir despesa.");
      }
    }
  }

  function resetRecurringExpenseForm() {
    setEditingRecurringExpenseId(null);
    setRecurringExpenseForm(emptyRecurringExpenseForm);
  }

  function handleEditRecurringExpense(recurringExpense: RecurringExpense) {
    setEditingRecurringExpenseId(recurringExpense.id);
    setRecurringExpenseForm({
      category: recurringExpense.category,
      amount: formatMoney(recurringExpense.amount).replace("R$ ", ""),
      frequency: recurringExpense.frequency,
      start_date: recurringExpense.start_date,
      end_date: recurringExpense.end_date ?? "",
      vehicle_id: recurringExpense.vehicle_id ? String(recurringExpense.vehicle_id) : "",
      description: recurringExpense.description ?? "",
      active: recurringExpense.active,
    });
    setMessage("");
    setSuccessMessage("");
  }

  function buildRecurringExpensePayload(form: RecurringExpenseForm) {
    return {
      category: form.category,
      amount: moneyInputToApi(form.amount),
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      description: form.description.trim() || null,
      active: form.active,
      ...(form.vehicle_id ? { vehicle_id: Number(form.vehicle_id) } : {}),
    };
  }

  async function handleRecurringExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRecurringExpenseSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const payload = buildRecurringExpensePayload(recurringExpenseForm);

      if (editingRecurringExpenseId) {
        await requestApi<RecurringExpense>(`/recurring-expenses/${editingRecurringExpenseId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Despesa recorrente atualizada com sucesso.");
      } else {
        await requestApi<RecurringExpense>("/recurring-expenses", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Despesa recorrente cadastrada com sucesso.");
      }

      resetRecurringExpenseForm();
      await loadRecurringExpenses();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Erro ao salvar despesa recorrente.",
        );
      }
    } finally {
      setIsRecurringExpenseSaving(false);
    }
  }

  async function handleToggleRecurringExpense(recurringExpense: RecurringExpense) {
    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<RecurringExpense>(`/recurring-expenses/${recurringExpense.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          category: recurringExpense.category,
          amount: recurringExpense.amount,
          frequency: recurringExpense.frequency,
          start_date: recurringExpense.start_date,
          end_date: recurringExpense.end_date,
          description: recurringExpense.description,
          active: !recurringExpense.active,
          ...(recurringExpense.vehicle_id ? { vehicle_id: recurringExpense.vehicle_id } : {}),
        }),
      });
      setSuccessMessage(
        recurringExpense.active
          ? "Despesa recorrente desativada."
          : "Despesa recorrente ativada.",
      );
      await loadRecurringExpenses();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Erro ao alterar despesa recorrente.",
        );
      }
    }
  }

  async function handleDeleteRecurringExpense(recurringExpense: RecurringExpense) {
    const shouldDelete = window.confirm(
      `Excluir a despesa recorrente de ${getExpenseCategoryLabel(recurringExpense.category)}?`,
    );
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/recurring-expenses/${recurringExpense.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Despesa recorrente excluida com sucesso.");
      await loadRecurringExpenses();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Erro ao excluir despesa recorrente.",
        );
      }
    }
  }

  function resetFinancialGoalForm() {
    setEditingFinancialGoalId(null);
    setFinancialGoalForm(emptyFinancialGoalForm);
  }

  function handleEditFinancialGoal(goal: FinancialGoal) {
    setEditingFinancialGoalId(goal.id);
    setFinancialGoalForm({
      goal_type: goal.goal_type,
      target_amount: formatMoney(goal.target_amount).replace("R$ ", ""),
      start_date: goal.start_date,
      end_date: goal.end_date,
      vehicle_id: goal.vehicle_id ? String(goal.vehicle_id) : "",
    });
    setMessage("");
    setSuccessMessage("");
  }

  function buildFinancialGoalPayload(form: FinancialGoalForm, active = true) {
    return {
      goal_type: form.goal_type,
      target_amount: moneyInputToApi(form.target_amount),
      start_date: form.start_date,
      end_date: form.end_date,
      active,
      ...(form.vehicle_id ? { vehicle_id: Number(form.vehicle_id) } : {}),
    };
  }

  async function handleFinancialGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsFinancialGoalSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const currentGoal = financialGoals.find((goal) => goal.id === editingFinancialGoalId);
      const payload = buildFinancialGoalPayload(financialGoalForm, currentGoal?.active ?? true);

      if (editingFinancialGoalId) {
        await requestApi<FinancialGoal>(`/financial-goals/${editingFinancialGoalId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Meta atualizada com sucesso.");
      } else {
        await requestApi<FinancialGoal>("/financial-goals", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Meta cadastrada com sucesso.");
      }

      resetFinancialGoalForm();
      await loadFinancialGoals();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar meta.");
      }
    } finally {
      setIsFinancialGoalSaving(false);
    }
  }

  async function handleToggleFinancialGoal(goal: FinancialGoal) {
    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<FinancialGoal>(`/financial-goals/${goal.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          goal_type: goal.goal_type,
          target_amount: goal.target_amount,
          start_date: goal.start_date,
          end_date: goal.end_date,
          active: !goal.active,
          ...(goal.vehicle_id ? { vehicle_id: goal.vehicle_id } : {}),
        }),
      });
      setSuccessMessage(goal.active ? "Meta desativada." : "Meta ativada.");
      await loadFinancialGoals();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao alterar meta.");
      }
    }
  }

  async function handleDeleteFinancialGoal(goal: FinancialGoal) {
    const shouldDelete = window.confirm(`Excluir a meta de ${formatMoney(goal.target_amount)}?`);
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/financial-goals/${goal.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Meta excluida com sucesso.");
      await loadFinancialGoals();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir meta.");
      }
    }
  }

  function resetMaintenancePlanForm() {
    setEditingMaintenancePlanId(null);
    setMaintenancePlanForm({
      ...emptyMaintenancePlanForm,
      vehicle_id: vehicles.length === 1 ? String(vehicles[0].id) : "",
    });
  }

  function handleEditMaintenancePlan(plan: MaintenancePlan) {
    setEditingMaintenancePlanId(plan.id);
    setMaintenancePlanForm({
      name: plan.name,
      category: plan.category,
      interval_km: plan.interval_km ? plan.interval_km.replace(".", ",") : "",
      interval_days: plan.interval_days ? String(plan.interval_days) : "",
      estimated_cost: formatOptionalMoneyForInput(plan.estimated_cost),
      vehicle_id: String(plan.vehicle_id),
      active: plan.active,
    });
    setMessage("");
    setSuccessMessage("");
  }

  function buildMaintenancePlanPayload(form: MaintenancePlanForm) {
    if (!form.interval_km.trim() && !form.interval_days.trim()) {
      throw new Error("Informe intervalo em km ou em dias.");
    }

    return {
      vehicle_id: Number(form.vehicle_id),
      name: form.name.trim(),
      category: form.category,
      interval_km: optionalDecimalInputToApi(form.interval_km),
      interval_days: form.interval_days.trim() ? Number(form.interval_days) : null,
      estimated_cost: optionalMoneyInputToApi(form.estimated_cost),
      active: form.active,
    };
  }

  async function handleMaintenancePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMaintenanceSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const payload = buildMaintenancePlanPayload(maintenancePlanForm);

      if (editingMaintenancePlanId) {
        await requestApi<MaintenancePlan>(`/maintenance-plans/${editingMaintenancePlanId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Plano de manutencao atualizado com sucesso.");
      } else {
        await requestApi<MaintenancePlan>("/maintenance-plans", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Plano de manutencao cadastrado com sucesso.");
      }

      resetMaintenancePlanForm();
      await loadMaintenancePlans();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar manutencao.");
      }
    } finally {
      setIsMaintenanceSaving(false);
    }
  }

  async function handleDeleteMaintenancePlan(plan: MaintenancePlan) {
    const shouldDelete = window.confirm(`Excluir o plano "${plan.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/maintenance-plans/${plan.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Plano de manutencao excluido com sucesso.");
      await loadMaintenancePlans();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir manutencao.");
      }
    }
  }

  function handleStartMaintenanceRecord(planId: number) {
    setRecordingMaintenancePlanId(planId);
    setMaintenanceRecordForm(emptyMaintenanceRecordForm);
    setMessage("");
    setSuccessMessage("");
  }

  async function handleMaintenanceRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recordingMaintenancePlanId) {
      return;
    }

    setIsMaintenanceRecordSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<MaintenanceRecord>(
        `/maintenance-plans/${recordingMaintenancePlanId}/records`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            service_date: maintenanceRecordForm.service_date,
            notes: maintenanceRecordForm.notes.trim() || null,
          }),
        },
      );
      setSuccessMessage("Manutencao registrada com sucesso.");
      setRecordingMaintenancePlanId(null);
      setMaintenanceRecordForm(emptyMaintenanceRecordForm);
      await loadMaintenancePlans();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao registrar manutencao.");
      }
    } finally {
      setIsMaintenanceRecordSaving(false);
    }
  }

  function getMaintenancePlansByStatus(statusValue: MaintenanceStatusType) {
    return maintenancePlans.filter(
      (plan) => maintenanceStatusesById[plan.id]?.status === statusValue,
    );
  }

  const selectedCostProfileVehicle = getCostProfileVehicle();
  const isQuickStartVisible = workSessions.length === 0 || quickStartVisible;
  const visibleFinancialInsights = financialInsights.slice(0, 5);

  return (
    <main className={user ? "page page-dashboard" : "page"}>
      <section className="intro" aria-labelledby="page-title">
        <p className="brand">GanhoCerto</p>
        <h1 id="page-title">Seu faturamento não é seu lucro.</h1>
        <p className="subtitle">Descubra quanto você realmente ganha dirigindo.</p>
      </section>

      <section className={user ? "auth-panel vehicle-panel" : "auth-panel"} aria-live="polite">
        {user ? (
          <div className="session">
            <div className="session-header">
              <div>
                <p className="eyebrow">Sessao autenticada</p>
                <h2>Bem-vindo ao GanhoCerto, {user.name}.</h2>
              </div>
              <button className="button button-secondary" type="button" onClick={handleLogout}>
                Sair
              </button>
            </div>

            <dl className="user-data">
              <div>
                <dt>Nome</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
            </dl>

            {message ? <p className="form-message">{message}</p> : null}
            {successMessage ? <p className="success-message">{successMessage}</p> : null}

            <nav className="dashboard-nav" aria-label="Navegacao principal">
              <button
                className="daily-entry-nav-button"
                type="button"
                onClick={() =>
                  document.getElementById("registro-rapido")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Registrar meu dia
              </button>
              {workSessions.length > 0 ? <a href="#dashboard">Dashboard</a> : null}
              {workSessions.length > 0 ? (
                <button
                  className="quick-start-nav-button"
                  type="button"
                  onClick={() => {
                    setQuickStartVisible(true);
                    requestAnimationFrame(() =>
                      document.getElementById("quick-start")?.scrollIntoView({ behavior: "smooth" }),
                    );
                  }}
                >
                  Simular um dia
                </button>
              ) : null}
              <a href="#metas">Metas</a>
              <a href="#jornadas">Jornadas</a>
              <a href="#despesas">Despesas</a>
              <a href="#despesas-recorrentes">Recorrentes</a>
              <a href="#manutencao">Manutencao</a>
              <a href="#veiculos">Veículos</a>
            </nav>

            <section className="daily-entry" id="registro-rapido">
              <div className="section-title">
                <p className="eyebrow">Registro rapido</p>
                <h3>Registrar meu dia</h3>
                <p className="subtle-note">
                  Preencha o essencial e salve sua jornada em poucos segundos.
                </p>
              </div>

              <form className="auth-form daily-entry-form" onSubmit={handleQuickDailyEntrySubmit}>
                <div className="daily-date-row">
                  <p>Data: {formatDate(quickDailyEntryForm.work_date || toDateInputValue(new Date()))}</p>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setQuickDailyEntryShowDate((currentValue) => !currentValue)}
                  >
                    Alterar data
                  </button>
                </div>

                {quickDailyEntryShowDate ? (
                  <label className="daily-date-input">
                    Data do registro
                    <input
                      onChange={(event) =>
                        setQuickDailyEntryForm({
                          ...quickDailyEntryForm,
                          work_date: event.target.value,
                        })
                      }
                      type="date"
                      value={quickDailyEntryForm.work_date}
                    />
                  </label>
                ) : null}

                <label>
                  Faturamento
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      setQuickDailyEntryForm({
                        ...quickDailyEntryForm,
                        gross_revenue: event.target.value,
                      })
                    }
                    placeholder="250,50"
                    required
                    type="text"
                    value={quickDailyEntryForm.gross_revenue}
                  />
                </label>

                <label>
                  Km rodados
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      setQuickDailyEntryForm({
                        ...quickDailyEntryForm,
                        distance_km: event.target.value,
                      })
                    }
                    placeholder="87,5"
                    required
                    type="text"
                    value={quickDailyEntryForm.distance_km}
                  />
                </label>

                <div className="form-grid daily-time-grid">
                  <label>
                    Horas trabalhadas
                    <input
                      min="0"
                      onChange={(event) =>
                        setQuickDailyEntryForm({
                          ...quickDailyEntryForm,
                          worked_hours: event.target.value,
                        })
                      }
                      required
                      type="number"
                      value={quickDailyEntryForm.worked_hours}
                    />
                  </label>

                  <label>
                    Minutos trabalhados
                    <input
                      max="59"
                      min="0"
                      onChange={(event) =>
                        setQuickDailyEntryForm({
                          ...quickDailyEntryForm,
                          worked_minutes: event.target.value,
                        })
                      }
                      required
                      type="number"
                      value={quickDailyEntryForm.worked_minutes}
                    />
                  </label>
                </div>

                <label>
                  Numero de corridas <span className="optional-label">(opcional)</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      setQuickDailyEntryForm({
                        ...quickDailyEntryForm,
                        trip_count: event.target.value,
                      })
                    }
                    type="number"
                    value={quickDailyEntryForm.trip_count}
                  />
                </label>

                {vehicles.length === 0 ? (
                  <p className="empty-state daily-entry-note">
                    Cadastre um veiculo para salvar. Os dados digitados ficam nesta tela.
                  </p>
                ) : null}

                {vehicles.length === 1 ? (
                  <p className="daily-selected-vehicle">
                    Veiculo: <strong>{getVehicleLabel(vehicles[0].id)}</strong>
                  </p>
                ) : null}

                {vehicles.length > 1 ? (
                  <label>
                    Veiculo
                    <select
                      onChange={(event) =>
                        setQuickDailyEntryForm({
                          ...quickDailyEntryForm,
                          vehicle_id: event.target.value,
                        })
                      }
                      required
                      value={quickDailyEntryForm.vehicle_id}
                    >
                      <option value="">Selecione</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} - {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <button className="button daily-entry-button" disabled={isQuickDailyEntrySaving} type="submit">
                  {isQuickDailyEntrySaving ? "Salvando..." : "Salvar meu dia"}
                </button>
              </form>

              {quickDailyEntryResult ? (
                <div className="daily-entry-result">
                  <div className="metric-grid daily-entry-metrics">
                    <article className="metric-card metric-profit">
                      <span>Faturamento</span>
                      <strong>{formatCents(quickDailyEntryResult.grossRevenueCents)}</strong>
                    </article>
                    <article className="metric-card">
                      <span>R$/hora</span>
                      <strong>
                        {quickDailyEntryResult.grossPerHourCents === null
                          ? "—"
                          : formatCents(quickDailyEntryResult.grossPerHourCents)}
                      </strong>
                    </article>
                    <article className="metric-card">
                      <span>R$/km</span>
                      <strong>
                        {quickDailyEntryResult.grossPerKmCents === null
                          ? "—"
                          : formatCents(quickDailyEntryResult.grossPerKmCents)}
                      </strong>
                    </article>
                    {quickDailyEntryResult.tripCount > 0 ? (
                      <article className="metric-card">
                        <span>Corridas</span>
                        <strong>{quickDailyEntryResult.tripCount}</strong>
                      </article>
                    ) : null}
                  </div>

                  <div className="daily-entry-actions">
                    <button className="button" type="button" onClick={handleViewCompleteResult}>
                      Ver meu resultado completo
                    </button>
                    <button className="button button-ghost" type="button" onClick={openDailyExpenseShortcut}>
                      + Adicionar gasto de hoje
                    </button>
                  </div>

                  {dailyExpenseVisible ? (
                    <form className="auth-form daily-expense-form" onSubmit={handleDailyExpenseSubmit}>
                      <div className="section-title">
                        <p className="eyebrow">Gasto de hoje</p>
                        <h3>Adicionar gasto</h3>
                        <p className="subtle-note">
                          Data {formatDate(dailyExpenseForm.expense_date)} e veiculo ja preenchidos.
                        </p>
                      </div>

                      <label>
                        Categoria
                        <select
                          onChange={(event) =>
                            setDailyExpenseForm({
                              ...dailyExpenseForm,
                              category: event.target.value as ExpenseCategory,
                            })
                          }
                          required
                          value={dailyExpenseForm.category}
                        >
                          {expenseCategoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Valor
                        <input
                          inputMode="decimal"
                          onChange={(event) =>
                            setDailyExpenseForm({
                              ...dailyExpenseForm,
                              amount: event.target.value,
                            })
                          }
                          placeholder="89,90"
                          required
                          type="text"
                          value={dailyExpenseForm.amount}
                        />
                      </label>

                      <label>
                        Descricao <span className="optional-label">(opcional)</span>
                        <input
                          maxLength={255}
                          onChange={(event) =>
                            setDailyExpenseForm({
                              ...dailyExpenseForm,
                              description: event.target.value,
                            })
                          }
                          placeholder="Ex: Combustivel"
                          type="text"
                          value={dailyExpenseForm.description}
                        />
                      </label>

                      <div className="form-actions">
                        <button className="button" disabled={isDailyExpenseSaving} type="submit">
                          {isDailyExpenseSaving ? "Salvando..." : "Salvar gasto"}
                        </button>
                        <button
                          className="button button-ghost"
                          type="button"
                          onClick={() => setDailyExpenseVisible(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </section>

            {isQuickStartVisible ? (
              <section className="quick-start" id="quick-start">
                <div className="section-title">
                  <p className="eyebrow">Início rápido</p>
                  <h3>Descubra seu GanhoCerto</h3>
                  <p className="subtle-note">
                    Veja em poucos passos quanto realmente sobrou do seu dia de trabalho.
                  </p>
                </div>

                <div className="quick-start-progress" aria-label="Progresso da simulação">
                  <span>1. Quanto você fez hoje?</span>
                  <span>2. Quanto trabalhou?</span>
                  <span>3. Quanto gastou?</span>
                  <span>4. Seu resultado</span>
                </div>

                {!quickStartResult ? (
                  <form className="auth-form quick-start-form" onSubmit={handleQuickStartSubmit}>
                    <fieldset className="form-group">
                      <legend>Quanto você fez hoje?</legend>
                      <label>
                        Faturamento do dia
                        <input
                          inputMode="decimal"
                          onChange={(event) =>
                            setQuickStartForm({ ...quickStartForm, gross_revenue: event.target.value })
                          }
                          placeholder="Ex: 250,50"
                          required
                          type="text"
                          value={quickStartForm.gross_revenue}
                        />
                      </label>
                    </fieldset>

                    <fieldset className="form-group">
                      <legend>Quanto trabalhou?</legend>
                      <div className="form-grid quick-start-time">
                        <label>
                          Km rodados
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              setQuickStartForm({ ...quickStartForm, distance_km: event.target.value })
                            }
                            placeholder="Ex: 87,5"
                            required
                            type="text"
                            value={quickStartForm.distance_km}
                          />
                        </label>
                        <label>
                          Horas trabalhadas
                          <input
                            min="0"
                            onChange={(event) =>
                              setQuickStartForm({ ...quickStartForm, worked_hours: event.target.value })
                            }
                            required
                            type="number"
                            value={quickStartForm.worked_hours}
                          />
                        </label>
                        <label>
                          Minutos
                          <input
                            max="59"
                            min="0"
                            onChange={(event) =>
                              setQuickStartForm({ ...quickStartForm, worked_minutes: event.target.value })
                            }
                            required
                            type="number"
                            value={quickStartForm.worked_minutes}
                          />
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="form-group">
                      <legend>Quanto gastou?</legend>
                      <div className="form-grid">
                        <label>
                          Combustível ou recarga
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              setQuickStartForm({ ...quickStartForm, fuel_expense: event.target.value })
                            }
                            placeholder="Ex: 80,00"
                            required
                            type="text"
                            value={quickStartForm.fuel_expense}
                          />
                        </label>
                        <label>
                          Tipo de gasto
                          <select
                            onChange={(event) =>
                              setQuickStartForm({
                                ...quickStartForm,
                                expense_category: event.target.value as "fuel" | "charging",
                              })
                            }
                            value={quickStartForm.expense_category}
                          >
                            <option value="fuel">Combustível</option>
                            <option value="charging">Recarga elétrica</option>
                          </select>
                        </label>
                      </div>
                    </fieldset>

                    <fieldset className="form-group">
                      <legend>Seu veículo</legend>
                      <label>
                        Tipo do veículo
                        <select
                          onChange={(event) =>
                            setQuickStartForm({
                              ...quickStartForm,
                              ownership_type: event.target.value as OwnershipType,
                            })
                          }
                          value={quickStartForm.ownership_type}
                        >
                          {ownershipOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {quickStartForm.ownership_type === "rented" ? (
                        <label>
                          Aluguel mensal <span className="optional-label">(opcional)</span>
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              setQuickStartForm({ ...quickStartForm, rental_monthly: event.target.value })
                            }
                            placeholder="Ex: 2.200,00"
                            type="text"
                            value={quickStartForm.rental_monthly}
                          />
                        </label>
                      ) : null}

                      {quickStartForm.ownership_type === "financed" ? (
                        <label>
                          Financiamento mensal <span className="optional-label">(opcional)</span>
                          <input
                            inputMode="decimal"
                            onChange={(event) =>
                              setQuickStartForm({ ...quickStartForm, financing_monthly: event.target.value })
                            }
                            placeholder="Ex: 1.800,00"
                            type="text"
                            value={quickStartForm.financing_monthly}
                          />
                        </label>
                      ) : null}
                    </fieldset>

                    <label>
                      Número de corridas <span className="optional-label">(opcional)</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          setQuickStartForm({ ...quickStartForm, trip_count: event.target.value })
                        }
                        type="number"
                        value={quickStartForm.trip_count}
                      />
                    </label>

                    <button className="button quick-start-button" type="submit">
                      Ver minha estimativa rápida
                    </button>
                  </form>
                ) : (
                  <div className="quick-start-result">
                    <div className="section-title">
                      <p className="eyebrow">Resultado inicial</p>
                      <h3>Sua estimativa rápida</h3>
                    </div>
                    <div className="metric-grid quick-start-metrics">
                      <article className="metric-card">
                        <span>Faturamento</span>
                        <strong>{formatCents(quickStartResult.grossRevenueCents)}</strong>
                      </article>
                      <article className="metric-card metric-expense">
                        <span>Gasto informado</span>
                        <strong>{formatCents(quickStartResult.fuelExpenseCents)}</strong>
                      </article>
                      <article className="metric-card metric-profit">
                        <span>Sobra após gasto</span>
                        <strong>{formatCents(quickStartResult.remainingCents)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>R$/hora</span>
                        <strong>
                          {quickStartResult.remainingPerHourCents === null
                            ? "—"
                            : formatCents(quickStartResult.remainingPerHourCents)}
                        </strong>
                      </article>
                      <article className="metric-card">
                        <span>R$/km</span>
                        <strong>
                          {quickStartResult.remainingPerKmCents === null
                            ? "—"
                            : formatCents(quickStartResult.remainingPerKmCents)}
                        </strong>
                      </article>
                      {quickStartResult.averageTicketCents !== null ? (
                        <article className="metric-card">
                          <span>Ticket médio</span>
                          <strong>{formatCents(quickStartResult.averageTicketCents)}</strong>
                        </article>
                      ) : null}
                    </div>
                    <p className="quick-start-disclaimer">
                      Este é um cálculo inicial. Custos como manutenção, pneus, seguro, IPVA e
                      depreciação podem reduzir seu resultado real.
                    </p>
                    <div className="quick-start-actions">
                      <p>Quer descobrir quanto realmente sobra considerando todos os custos do seu veículo?</p>
                      <button className="button" type="button" onClick={() => void handleQuickStartConfigure()}>
                        Configurar meu GanhoCerto
                      </button>
                      <button className="button button-ghost" type="button" onClick={() => void handleQuickStartRegister()}>
                        Registrar meu primeiro dia
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setQuickStartResult(null)}
                      >
                        Ajustar dados
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            <section className="manager-section" id="metas">
              <div className="section-title">
                <p className="eyebrow">Metas</p>
                <h3>Metas inteligentes</h3>
                <p className="subtle-note">
                  Acompanhe quanto falta, o ritmo necessario e uma estimativa simples de esforco
                  para chegar ao seu objetivo.
                </p>
              </div>

              <div className="vehicles-layout">
                <form className="auth-form vehicle-form" onSubmit={handleFinancialGoalSubmit}>
                  <h3>{editingFinancialGoalId ? "Editar meta" : "Criar meta"}</h3>

                  <label>
                    Tipo de meta
                    <select
                      name="financial-goal-type"
                      onChange={(event) =>
                        setFinancialGoalForm({
                          ...financialGoalForm,
                          goal_type: event.target.value as FinancialGoalType,
                        })
                      }
                      required
                      value={financialGoalForm.goal_type}
                    >
                      {financialGoalTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <p className="subtle-note">
                    Meta de sobra apos despesas usa somente despesas registradas.
                  </p>
                  <p className="subtle-note">
                    Meta de resultado projetado considera tambem custos estruturais e despesas
                    recorrentes previstas.
                  </p>

                  <label>
                    Valor da meta
                    <input
                      inputMode="decimal"
                      name="financial-goal-target"
                      onChange={(event) =>
                        setFinancialGoalForm({
                          ...financialGoalForm,
                          target_amount: event.target.value,
                        })
                      }
                      placeholder="4000,00"
                      required
                      type="text"
                      value={financialGoalForm.target_amount}
                    />
                  </label>

                  <div className="form-grid">
                    <label>
                      Data inicial
                      <input
                        name="financial-goal-start"
                        onChange={(event) =>
                          setFinancialGoalForm({
                            ...financialGoalForm,
                            start_date: event.target.value,
                          })
                        }
                        required
                        type="date"
                        value={financialGoalForm.start_date}
                      />
                    </label>

                    <label>
                      Data final
                      <input
                        name="financial-goal-end"
                        onChange={(event) =>
                          setFinancialGoalForm({
                            ...financialGoalForm,
                            end_date: event.target.value,
                          })
                        }
                        required
                        type="date"
                        value={financialGoalForm.end_date}
                      />
                    </label>
                  </div>

                  <label>
                    Veiculo <span className="optional-label">(opcional)</span>
                    <select
                      name="financial-goal-vehicle"
                      onChange={(event) =>
                        setFinancialGoalForm({
                          ...financialGoalForm,
                          vehicle_id: event.target.value,
                        })
                      }
                      value={financialGoalForm.vehicle_id}
                    >
                      <option value="">Todos / sem veiculo especifico</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} - {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="form-actions">
                    <button className="button" disabled={isFinancialGoalSaving} type="submit">
                      {isFinancialGoalSaving
                        ? "Salvando..."
                        : editingFinancialGoalId
                          ? "Salvar meta"
                          : "Criar meta"}
                    </button>
                    {editingFinancialGoalId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={resetFinancialGoalForm}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="vehicles-list" aria-busy={isFinancialGoalsLoading}>
                  <div className="list-header">
                    <h3>Minhas metas</h3>
                    <button
                      className="text-button"
                      disabled={isFinancialGoalsLoading}
                      type="button"
                      onClick={() => void loadFinancialGoals()}
                    >
                      Atualizar
                    </button>
                  </div>

                  {isFinancialGoalsLoading ? <p className="empty-state">Carregando metas...</p> : null}

                  {!isFinancialGoalsLoading && financialGoals.length === 0 ? (
                    <p className="empty-state">
                      Nenhuma meta cadastrada ainda. Crie uma meta para acompanhar seu progresso.
                    </p>
                  ) : null}

                  {financialGoals.map((goal) => {
                    const progress = financialGoalProgressById[goal.id];
                    const isReached = progress?.remaining_amount === "0.00";
                    const averagePerHour =
                      goal.goal_type === "net"
                        ? progress?.average_net_per_hour
                        : progress?.average_projected_per_hour;

                    return (
                      <article className="vehicle-card session-card goal-card" key={goal.id}>
                        <div>
                          <div className="recurring-card-title">
                            <h4>{getFinancialGoalTypeLabel(goal.goal_type)}</h4>
                            <span
                              className={
                                goal.active
                                  ? "status-pill status-active"
                                  : "status-pill status-inactive"
                              }
                            >
                              {goal.active ? "Ativa" : "Inativa"}
                            </span>
                          </div>

                          <p>
                            {formatMoney(goal.target_amount)} de {formatDate(goal.start_date)} ate{" "}
                            {formatDate(goal.end_date)}
                          </p>

                          {progress ? (
                            <div className="goal-progress-panel">
                              <div className="goal-progress-main">
                                <span>{isReached ? "Status" : "Faltam"}</span>
                                <strong>
                                  {isReached ? "Meta atingida" : formatMoney(progress.remaining_amount)}
                                </strong>
                                {!isReached ? (
                                  <small>
                                    Voce precisa de aproximadamente{" "}
                                    {formatMoney(progress.required_daily_amount)} por dia ate{" "}
                                    {formatDate(goal.end_date)}.
                                  </small>
                                ) : null}
                                {!isReached && progress.estimated_hours_remaining ? (
                                  <small>
                                    Estimativa: {formatHours(progress.estimated_hours_remaining)} de
                                    trabalho no seu ritmo atual.
                                  </small>
                                ) : null}
                              </div>

                              <div className="goal-progress-bar" aria-label="Progresso da meta">
                                <i style={{ width: getProgressWidth(progress.progress_percentage) }} />
                              </div>
                              <p className="goal-progress-status">
                                {progress.estimated_hours_remaining === null && averagePerHour == null
                                  ? "Ainda nao ha dados suficientes para estimar seu ritmo."
                                  : progress.on_track
                                    ? "Voce esta no ritmo necessario para esta meta."
                                    : "Seu ritmo atual esta abaixo do necessario para esta meta."}
                              </p>

                              <dl className="session-metrics goal-metrics">
                                <div>
                                  <dt>Valor atual</dt>
                                  <dd>{formatMoney(progress.current_amount)}</dd>
                                </div>
                                <div>
                                  <dt>Progresso</dt>
                                  <dd>{formatPercent(progress.progress_percentage)}</dd>
                                </div>
                                <div>
                                  <dt>Dias restantes</dt>
                                  <dd>{progress.days_remaining}</dd>
                                </div>
                                <div>
                                  <dt>Ritmo por dia</dt>
                                  <dd>{isReached ? "—" : formatMoney(progress.required_daily_amount)}</dd>
                                </div>
                                <div>
                                  <dt>Horas restantes</dt>
                                  <dd>{isReached ? "—" : formatHours(progress.estimated_hours_remaining)}</dd>
                                </div>
                                <div>
                                  <dt>Projecao de fechamento</dt>
                                  <dd>{formatMoney(progress.projected_completion_amount)}</dd>
                                </div>
                              </dl>
                            </div>
                          ) : (
                            <p className="empty-state compact-empty-state">Carregando progresso...</p>
                          )}

                          <dl className="session-metrics goal-summary-metrics">
                            <div>
                              <dt>Veiculo</dt>
                              <dd>
                                {goal.vehicle_id ? getVehicleLabel(goal.vehicle_id) : "Todos / sem veiculo"}
                              </dd>
                            </div>
                            <div>
                              <dt>Resumo</dt>
                              <dd>
                                {progress
                                  ? `${formatPercent(progress.progress_percentage)} concluida`
                                  : "—"}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="card-actions">
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => handleEditFinancialGoal(goal)}
                          >
                            Editar
                          </button>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => void handleToggleFinancialGoal(goal)}
                          >
                            {goal.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() => void handleDeleteFinancialGoal(goal)}
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            {workSessions.length > 0 ? (
              <section className="manager-section dashboard-section" id="dashboard">
              <div className="section-title">
                <p className="eyebrow">Dashboard</p>
                <h3>Resumo financeiro</h3>
                <p className="subtle-note">
                  Lucro líquido estimado com base nas despesas registradas.
                </p>
              </div>

              <div className="dashboard-filters">
                <label>
                  Período
                  <select
                    onChange={(event) => setDashboardPeriod(event.target.value as DashboardPeriod)}
                    value={dashboardPeriod}
                  >
                    <option value="today">Hoje</option>
                    <option value="last7">Últimos 7 dias</option>
                    <option value="month">Este mês</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </label>

                {dashboardPeriod === "custom" ? (
                  <>
                    <label>
                      Início
                      <input
                        onChange={(event) => setCustomStartDate(event.target.value)}
                        type="date"
                        value={customStartDate}
                      />
                    </label>
                    <label>
                      Fim
                      <input
                        onChange={(event) => setCustomEndDate(event.target.value)}
                        type="date"
                        value={customEndDate}
                      />
                    </label>
                  </>
                ) : null}

                <label>
                  Veículo
                  <select
                    onChange={(event) => setDashboardVehicleId(event.target.value)}
                    value={dashboardVehicleId}
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

              {isDashboardLoading ? <p className="empty-state">Carregando dashboard...</p> : null}
              {dashboardError ? <p className="form-message">{dashboardError}</p> : null}

              {!isDashboardLoading && financialSummary ? (
                <>
                  <div className="economic-panel">
                    <div className="section-title">
                      <p className="eyebrow">Visao em camadas</p>
                      <h3>Do realizado ao projetado</h3>
                      <p className="subtle-note">
                        Separe o que ja aconteceu, os custos estimados e as despesas recorrentes
                        previstas para o periodo.
                      </p>
                    </div>

                    <article
                      className={
                        isNegativeMoney(financialSummary.projected_economic_result)
                          ? "metric-card projected-result-card metric-negative"
                          : "metric-card projected-result-card metric-profit"
                      }
                    >
                      <span>Resultado projetado</span>
                      <strong>{formatMoney(financialSummary.projected_economic_result)}</strong>
                      <small>
                        Considera despesas registradas, custos estruturais configurados e despesas
                        recorrentes previstas para o periodo.
                      </small>
                      {isNegativeMoney(financialSummary.projected_economic_result) ? (
                        <small>
                          Neste periodo, seus custos projetados estao acima do faturamento
                          registrado.
                        </small>
                      ) : null}
                    </article>

                    <div className="dashboard-layers">
                      <article className="dashboard-layer">
                        <p className="eyebrow">Realizado</p>
                        <dl>
                          <div>
                            <dt>Faturamento</dt>
                            <dd>{formatMoney(financialSummary.gross_revenue)}</dd>
                          </div>
                          <div>
                            <dt>Despesas registradas</dt>
                            <dd>{formatMoney(financialSummary.total_expenses)}</dd>
                          </div>
                          <div>
                            <dt>Sobra apos despesas</dt>
                            <dd>{formatMoney(financialSummary.estimated_net_profit)}</dd>
                          </div>
                        </dl>
                      </article>

                      <article className="dashboard-layer">
                        <p className="eyebrow">Estimado</p>
                        <dl>
                          <div>
                            <dt>Custos estruturais estimados</dt>
                            <dd>{formatMoney(financialSummary.estimated_structural_costs)}</dd>
                          </div>
                          <div>
                            <dt>Resultado economico estimado</dt>
                            <dd>{formatMoney(financialSummary.estimated_economic_result)}</dd>
                          </div>
                        </dl>
                      </article>

                      <article className="dashboard-layer dashboard-layer-projected">
                        <p className="eyebrow">Projetado</p>
                        <dl>
                          <div>
                            <dt>Despesas recorrentes previstas</dt>
                            <dd>{formatMoney(financialSummary.recurring_expenses_total)}</dd>
                          </div>
                          <div>
                            <dt>Custos projetados totais</dt>
                            <dd>{formatMoney(financialSummary.projected_economic_costs)}</dd>
                          </div>
                          <div>
                            <dt>Resultado projetado apos recorrencias</dt>
                            <dd>{formatMoney(financialSummary.projected_economic_result)}</dd>
                          </div>
                        </dl>
                      </article>
                    </div>

                    {!isPositiveMoney(financialSummary.estimated_structural_costs) ? (
                      <p className="empty-state">
                        Configure os custos do veiculo para obter uma estimativa economica mais
                        completa. <a href="#veiculos">Ir para Veiculos</a>
                      </p>
                    ) : null}
                  </div>

                  <div className="financial-insights">
                    <div className="list-header">
                      <h3>Insights do seu periodo</h3>
                    </div>

                    {isFinancialInsightsLoading ? (
                      <p className="empty-state compact-empty-state">Carregando insights...</p>
                    ) : null}
                    {financialInsightsError ? (
                      <p className="form-message compact-message">{financialInsightsError}</p>
                    ) : null}

                    {!isFinancialInsightsLoading && !financialInsightsError ? (
                      visibleFinancialInsights.length > 0 ? (
                        <div className="financial-insights-list">
                          {visibleFinancialInsights.map((insight) => (
                            <article
                              className={`financial-insight financial-insight-${insight.type}`}
                              key={insight.code}
                            >
                              <strong>{insight.title}</strong>
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

                  <div className="recurring-projection">
                    <div className="list-header">
                      <h3>Despesas recorrentes previstas</h3>
                    </div>
                    <p className="subtle-note">
                      Despesas recorrentes sao projecoes baseadas nos custos que voce configurou.
                      Quando uma despesa real equivalente ja esta registrada, o GanhoCerto evita
                      contar o mesmo custo duas vezes.
                    </p>

                    {isPositiveMoney(financialSummary.recurring_expenses_total) ? (
                      <>
                        <div className="recurring-projection-list">
                          {getRecurringProjectionItems(financialSummary).map((item) => (
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
                          <strong>{formatMoney(financialSummary.recurring_expenses_total)}</strong>
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

                    {getStructuralCostItems(financialSummary).length === 0 ? (
                      <p className="empty-state">
                        Nenhum custo estrutural estimado para o periodo selecionado.
                      </p>
                    ) : (
                      <div className="structural-list">
                        {getStructuralCostItems(financialSummary).map((item) => (
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
                      <strong>
                        {getMetricValue(financialSummary.gross_per_hour, formatMoney)}
                      </strong>
                    </article>
                    <article className="metric-card">
                      <span>Ganho líquido por hora</span>
                      <strong>{getMetricValue(financialSummary.net_per_hour, formatMoney)}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Ganho bruto por km</span>
                      <strong>{getMetricValue(financialSummary.gross_per_km, formatMoney)}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Ganho líquido por km</span>
                      <strong>{getMetricValue(financialSummary.net_per_km, formatMoney)}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Custo por km</span>
                      <strong>
                        {getMetricValue(financialSummary.expense_per_km, formatMoney)}
                      </strong>
                    </article>
                    <article className="metric-card">
                      <span>Ticket médio</span>
                      <strong>
                        {getMetricValue(financialSummary.average_ticket, formatMoney)}
                      </strong>
                    </article>
                    <article className="metric-card">
                      <span>Total de corridas</span>
                      <strong>{financialSummary.total_trip_count}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Horas trabalhadas</span>
                      <strong>{formatWorkTime(financialSummary.total_worked_minutes)}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Km rodados</span>
                      <strong>{formatDistance(financialSummary.total_distance_km)} km</strong>
                    </article>
                  </div>

                  <div className="daily-breakdown">
                    <div className="list-header">
                      <h3>Evolução diária</h3>
                    </div>

                    {financialSummary.daily.length === 0 ? (
                      <p className="empty-state">Nenhum dado no período selecionado.</p>
                    ) : (
                      financialSummary.daily.map((dailyItem) => {
                        const chartMax = getChartMax(financialSummary);
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
                              <span>Lucro est.</span>
                              <div>
                                <i
                                  style={{
                                    width: `${(getChartValue(dailyItem.estimated_net_profit) / chartMax) * 100}%`,
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
              ) : null}
              </section>
            ) : null}

            <section className="manager-section" id="jornadas">
              <div className="section-title">
                <p className="eyebrow">Jornadas</p>
                <h3>Registro diario de trabalho</h3>
                <button
                  className="button button-ghost inline-action"
                  type="button"
                  onClick={() => setIsWorkSessionImportVisible((current) => !current)}
                >
                  Importar jornadas
                </button>
              </div>

              {isWorkSessionImportVisible ? (
                <div
                  className="import-panel"
                  aria-busy={
                    isWorkSessionImportPreviewLoading ||
                    isWorkSessionImportSaving ||
                    isImportProfileSaving
                  }
                >
                  <div className="list-header">
                    <div>
                      <h3>Importar jornadas por CSV</h3>
                      <p className="subtle-note">
                        Escolha o veículo, envie o arquivo e revise o preview antes de gravar.
                      </p>
                    </div>
                    <button className="text-button" type="button" onClick={downloadWorkSessionImportTemplate}>
                      Baixar modelo CSV
                    </button>
                  </div>

                  <div className="import-template-help">
                    <span>date: AAAA-MM-DD</span>
                    <span>gross_revenue: faturamento</span>
                    <span>distance_km: km rodados</span>
                    <span>worked_minutes: minutos trabalhados</span>
                    <span>trip_count: número de corridas</span>
                  </div>

                  <div className="import-preview">
                    <div className="list-header">
                      <div>
                        <h4>Configuracoes salvas</h4>
                        <p className="subtle-note">
                          Use perfis para reaproveitar o mesmo mapeamento em CSVs iguais.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        disabled={isImportProfilesLoading}
                        type="button"
                        onClick={() => void loadImportProfiles()}
                      >
                        Atualizar
                      </button>
                    </div>
                    {importProfiles.filter((profile) => profile.import_type === "work_sessions")
                      .length === 0 ? (
                      <p className="subtle-note">Nenhuma configuracao salva ainda.</p>
                    ) : (
                      <div className="import-preview-list">
                        {importProfiles
                          .filter((profile) => profile.import_type === "work_sessions")
                          .map((profile) => (
                          <article className="vehicle-card session-card" key={profile.id}>
                            <div>
                              <h4>{profile.name}</h4>
                              <p className="subtle-note">
                                {getImportProfileTypeLabel(profile.import_type)} Â·{" "}
                                {getImportProfileVehicleLabel(profile)}
                              </p>
                            </div>
                            <div className="card-actions">
                              <button
                                className="text-button"
                                disabled={isImportProfileSaving}
                                type="button"
                                onClick={() => void handleRenameImportProfile(profile)}
                              >
                                Renomear
                              </button>
                              <button
                                className="text-button danger"
                                disabled={isImportProfileSaving}
                                type="button"
                                onClick={() => void handleDeleteImportProfile(profile)}
                              >
                                Excluir
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {vehicles.length === 0 ? (
                    <p className="empty-state compact-empty-state">
                      Cadastre um veículo antes de importar jornadas.{" "}
                      <a href="#veiculos">Ir para Veículos</a>
                    </p>
                  ) : (
                    <>
                      <div className="form-grid">
                        <label>
                          Veículo
                          <select
                            disabled={vehicles.length === 1}
                            onChange={(event) => setWorkSessionImportVehicleId(event.target.value)}
                            required
                            value={workSessionImportVehicleId}
                          >
                            <option value="">Selecione</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.name} - {vehicle.brand} {vehicle.model}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label
                          className={
                            isWorkSessionImportDragging ? "import-dropzone import-dropzone-active" : "import-dropzone"
                          }
                          onDragLeave={() => setIsWorkSessionImportDragging(false)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setIsWorkSessionImportDragging(true);
                          }}
                          onDrop={handleWorkSessionImportDrop}
                        >
                          <span>Selecionar ou arrastar CSV</span>
                          <small>Clique aqui ou solte o arquivo nesta área.</small>
                          <input
                            accept=".csv,text/csv"
                            type="file"
                            onChange={handleWorkSessionImportFileChange}
                          />
                        </label>
                      </div>

                      {workSessionImportFile ? (
                        <div className="import-file">
                          <div>
                            <strong>{workSessionImportFile.name}</strong>
                            <span>{formatFileSize(workSessionImportFile.size)}</span>
                          </div>
                          <button className="text-button danger" type="button" onClick={clearWorkSessionImportFile}>
                            Remover
                          </button>
                        </div>
                      ) : null}

                      {matchedWorkSessionImportProfile ? (
                        <p className="form-message compact-message">
                          Configuracao aplicada: {matchedWorkSessionImportProfile.name}.
                        </p>
                      ) : null}

                      {workSessionImportColumns.length ? (
                        <div className="import-mapping">
                          <div>
                            <h4>Qual coluna corresponde a cada informação?</h4>
                            <p className="subtle-note">
                              O GanhoCerto sugeriu o que encontrou. Confira e ajuste se precisar.
                            </p>
                          </div>
                          <div className="form-grid">
                            {workSessionImportMappingFields.map((item) => (
                              <label key={item.field}>
                                {item.label}
                                {item.optional ? " (opcional)" : ""}
                                <select
                                  value={workSessionImportMapping[item.field]}
                                  onChange={(event) => {
                                    setWorkSessionImportMapping({
                                      ...workSessionImportMapping,
                                      [item.field]: event.target.value,
                                    });
                                    setWorkSessionImportPreview(null);
                                    setWorkSessionImportResult(null);
                                    setMatchedWorkSessionImportProfile(null);
                                  }}
                                >
                                  <option value="">
                                    {item.optional ? "Sem coluna / usar 0" : "Selecione"}
                                  </option>
                                  {workSessionImportColumns.map((column) => (
                                    <option key={`${item.field}-${column}`} value={column}>
                                      {column}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="form-actions import-actions">
                        <button
                          className="button"
                          disabled={
                            isWorkSessionImportPreviewLoading ||
                            isWorkSessionImportSaving ||
                            !workSessionImportVehicleId ||
                            !workSessionImportFile
                          }
                          type="button"
                          onClick={() => void handleWorkSessionImportPreview()}
                        >
                          {isWorkSessionImportPreviewLoading
                            ? "Validando..."
                            : workSessionImportColumns.length
                              ? "Confirmar mapping e visualizar preview"
                              : "Ler colunas e visualizar preview"}
                        </button>
                      </div>

                      {workSessionImportError ? (
                        <p className="form-message compact-message">{workSessionImportError}</p>
                      ) : null}

                      {workSessionImportPreview ? (
                        <div className="import-preview">
                          <dl className="session-metrics import-summary">
                            <div>
                              <dt>Total</dt>
                              <dd>{workSessionImportPreview.total_rows}</dd>
                            </div>
                            <div>
                              <dt>Válidas</dt>
                              <dd>{workSessionImportPreview.valid_rows}</dd>
                            </div>
                            <div>
                              <dt>Inválidas</dt>
                              <dd>{workSessionImportPreview.invalid_rows}</dd>
                            </div>
                          </dl>

                          {workSessionImportPreview.errors.length > 0 ? (
                            <div className="import-errors">
                              <h4>Corrija o CSV e envie novamente</h4>
                              {workSessionImportPreview.errors.map((error, index) => (
                                <article key={`${error.row}-${error.field}-${index}`}>
                                  <strong>Linha {error.row}</strong>
                                  <span>
                                    {getImportFieldLabel(error.field)}: {error.message}
                                  </span>
                                </article>
                              ))}
                            </div>
                          ) : null}

                          {workSessionImportPreview.rows.length > 0 ? (
                            <div className="import-preview-list">
                              {workSessionImportPreview.rows.map((row) => (
                                <article className="vehicle-card session-card" key={row.row}>
                                  <div>
                                    <h4>{formatDate(row.date)}</h4>
                                    <dl className="session-metrics">
                                      <div>
                                        <dt>Faturamento</dt>
                                        <dd>{formatMoney(row.gross_revenue)}</dd>
                                      </div>
                                      <div>
                                        <dt>Km</dt>
                                        <dd>{formatDistance(row.distance_km)}</dd>
                                      </div>
                                      <div>
                                        <dt>Tempo</dt>
                                        <dd>{formatWorkTime(row.worked_minutes)}</dd>
                                      </div>
                                      <div>
                                        <dt>Corridas</dt>
                                        <dd>{row.trip_count}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : null}

                          {workSessionImportPreview.invalid_rows > 0 ? (
                            <p className="empty-state compact-empty-state">
                              Existem linhas inválidas. A importação só ficará disponível após corrigir o arquivo.
                            </p>
                          ) : (
                            <>
                              <div className="import-mapping">
                                <div>
                                  <h4>Salvar esta configuracao</h4>
                                  <p className="subtle-note">
                                    Opcional: guarde este mapeamento para CSVs com as mesmas colunas.
                                  </p>
                                </div>
                                <div className="form-grid">
                                  <label>
                                    Nome da configuracao
                                    <input
                                      onChange={(event) =>
                                        setWorkSessionImportProfileName(event.target.value)
                                      }
                                      placeholder="Ex.: CSV semanal do app"
                                      value={workSessionImportProfileName}
                                    />
                                  </label>
                                </div>
                                <button
                                  className="button button-ghost"
                                  disabled={
                                    isImportProfileSaving ||
                                    !workSessionImportProfileName.trim()
                                  }
                                  type="button"
                                  onClick={() => void handleSaveWorkSessionImportProfile()}
                                >
                                  {isImportProfileSaving
                                    ? "Salvando..."
                                    : "Salvar configuracao"}
                                </button>
                              </div>

                              <button
                                className="button"
                                disabled={
                                  isWorkSessionImportSaving ||
                                  workSessionImportPreview.valid_rows === 0
                                }
                                type="button"
                                onClick={() => void handleConfirmWorkSessionImport()}
                              >
                                {isWorkSessionImportSaving
                                  ? "Importando..."
                                  : `Importar ${workSessionImportPreview.valid_rows} jornadas`}
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}

                      {workSessionImportResult ? (
                        <div className="import-result">
                          <h4>Importação concluída</h4>
                          <dl className="session-metrics import-summary">
                            <div>
                              <dt>Importadas</dt>
                              <dd>{workSessionImportResult.imported}</dd>
                            </div>
                            <div>
                              <dt>Duplicadas</dt>
                              <dd>{workSessionImportResult.duplicates_skipped}</dd>
                            </div>
                            <div>
                              <dt>Falhas</dt>
                              <dd>{workSessionImportResult.failed}</dd>
                            </div>
                          </dl>
                          {workSessionImportResult.duplicates_skipped > 0 ? (
                            <p className="subtle-note">
                              O GanhoCerto ignorou registros que já haviam sido importados.
                            </p>
                          ) : null}
                          <button
                            className="button button-ghost"
                            type="button"
                            onClick={() =>
                              document.getElementById("lista-jornadas")?.scrollIntoView({
                                behavior: "smooth",
                              })
                            }
                          >
                            Ver minhas jornadas
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="vehicles-layout">
                <form className="auth-form vehicle-form" onSubmit={handleWorkSessionSubmit}>
                  <h3>{editingWorkSessionId ? "Editar jornada" : "Cadastrar jornada"}</h3>

                  <div className="form-grid">
                    <label>
                      Data
                      <input
                        name="work-date"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            work_date: event.target.value,
                          })
                        }
                        required
                        type="date"
                        value={workSessionForm.work_date}
                      />
                    </label>

                    <label>
                      Veículo
                      <select
                        name="work-vehicle"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            vehicle_id: event.target.value,
                          })
                        }
                        required
                        value={workSessionForm.vehicle_id}
                      >
                        <option value="">Selecione</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} - {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Faturamento bruto
                      <input
                        inputMode="decimal"
                        name="gross-revenue"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            gross_revenue: event.target.value,
                          })
                        }
                        placeholder="250,50"
                        required
                        type="text"
                        value={workSessionForm.gross_revenue}
                      />
                    </label>

                    <label>
                      Km rodados
                      <input
                        inputMode="decimal"
                        name="distance-km"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            distance_km: event.target.value,
                          })
                        }
                        placeholder="87,5"
                        required
                        type="text"
                        value={workSessionForm.distance_km}
                      />
                    </label>
                  </div>

                  <div className="form-grid form-grid-three">
                    <label>
                      Horas trabalhadas
                      <input
                        min="0"
                        name="worked-hours"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            worked_hours: event.target.value,
                          })
                        }
                        required
                        type="number"
                        value={workSessionForm.worked_hours}
                      />
                    </label>

                    <label>
                      Minutos trabalhados
                      <input
                        max="59"
                        min="0"
                        name="worked-minutes"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            worked_minutes: event.target.value,
                          })
                        }
                        required
                        type="number"
                        value={workSessionForm.worked_minutes}
                      />
                    </label>

                    <label>
                      Número de corridas
                      <input
                        min="0"
                        name="trip-count"
                        onChange={(event) =>
                          setWorkSessionForm({
                            ...workSessionForm,
                            trip_count: event.target.value,
                          })
                        }
                        required
                        type="number"
                        value={workSessionForm.trip_count}
                      />
                    </label>
                  </div>

                  <div className="form-actions">
                    <button
                      className="button"
                      disabled={isWorkSessionSaving || vehicles.length === 0}
                      type="submit"
                    >
                      {isWorkSessionSaving
                        ? "Salvando..."
                        : editingWorkSessionId
                          ? "Salvar jornada"
                          : "Cadastrar jornada"}
                    </button>
                    {editingWorkSessionId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={resetWorkSessionForm}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="vehicles-list" id="lista-jornadas" aria-busy={isWorkSessionsLoading}>
                  <div className="list-header">
                    <h3>Minhas jornadas</h3>
                    <button
                      className="text-button"
                      disabled={isWorkSessionsLoading}
                      type="button"
                      onClick={() => void loadWorkSessions()}
                    >
                      Atualizar
                    </button>
                  </div>

                  {isWorkSessionsLoading ? (
                    <p className="empty-state">Carregando jornadas...</p>
                  ) : null}

                  {!isWorkSessionsLoading && vehicles.length === 0 ? (
                    <p className="empty-state">
                      Cadastre um veículo antes de registrar sua primeira jornada.
                    </p>
                  ) : null}

                  {!isWorkSessionsLoading && vehicles.length > 0 && workSessions.length === 0 ? (
                    <p className="empty-state">
                      Nenhuma jornada registrada ainda. Adicione seu dia de trabalho.
                    </p>
                  ) : null}

                  {workSessions.map((workSession) => (
                    <article className="vehicle-card session-card" key={workSession.id}>
                      <div>
                        <h4>{formatDate(workSession.work_date)}</h4>
                        <p>{getVehicleLabel(workSession.vehicle_id)}</p>
                        <dl className="session-metrics">
                          <div>
                            <dt>Faturamento</dt>
                            <dd>{formatMoney(workSession.gross_revenue)}</dd>
                          </div>
                          <div>
                            <dt>Km</dt>
                            <dd>{formatDistance(workSession.distance_km)}</dd>
                          </div>
                          <div>
                            <dt>Tempo</dt>
                            <dd>{formatWorkTime(workSession.worked_minutes)}</dd>
                          </div>
                          <div>
                            <dt>Corridas</dt>
                            <dd>{workSession.trip_count}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="card-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => handleEditWorkSession(workSession)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => void handleDeleteWorkSession(workSession)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="manager-section" id="despesas">
              <div className="section-title">
                <p className="eyebrow">Despesas</p>
                <h3>Custos da operação</h3>
                <button
                  className="button button-ghost inline-action"
                  type="button"
                  onClick={() => setIsExpenseImportVisible((current) => !current)}
                >
                  Importar despesas
                </button>
              </div>

              {isExpenseImportVisible ? (
                <div
                  className="import-panel"
                  aria-busy={
                    isExpenseImportPreviewLoading ||
                    isExpenseImportSaving ||
                    isImportProfileSaving
                  }
                >
                  <div className="list-header">
                    <div>
                      <h3>Importar despesas por CSV</h3>
                      <p className="subtle-note">
                        Envie o arquivo, confira as colunas e revise o preview antes de gravar.
                      </p>
                    </div>
                    <button className="text-button" type="button" onClick={downloadExpenseImportTemplate}>
                      Baixar modelo CSV
                    </button>
                  </div>

                  <div className="import-template-help">
                    <span>expense_date: AAAA-MM-DD</span>
                    <span>amount: valor</span>
                    <span>category: categoria</span>
                    <span>description: descricao opcional</span>
                  </div>

                  <div className="import-preview">
                    <div className="list-header">
                      <div>
                        <h4>Configuracoes salvas</h4>
                        <p className="subtle-note">
                          Perfis de despesas ficam separados dos perfis de jornadas.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        disabled={isImportProfilesLoading}
                        type="button"
                        onClick={() => void loadImportProfiles()}
                      >
                        Atualizar
                      </button>
                    </div>
                    {importProfiles.filter((profile) => profile.import_type === "expenses")
                      .length === 0 ? (
                      <p className="subtle-note">Nenhuma configuracao de despesas salva ainda.</p>
                    ) : (
                      <div className="import-preview-list">
                        {importProfiles
                          .filter((profile) => profile.import_type === "expenses")
                          .map((profile) => (
                            <article className="vehicle-card session-card" key={profile.id}>
                              <div>
                                <h4>{profile.name}</h4>
                                <p className="subtle-note">
                                  {getImportProfileTypeLabel(profile.import_type)} ·{" "}
                                  {getImportProfileVehicleLabel(profile)}
                                </p>
                              </div>
                              <div className="card-actions">
                                <button
                                  className="text-button"
                                  disabled={isImportProfileSaving}
                                  type="button"
                                  onClick={() => void handleRenameImportProfile(profile)}
                                >
                                  Renomear
                                </button>
                                <button
                                  className="text-button danger"
                                  disabled={isImportProfileSaving}
                                  type="button"
                                  onClick={() => void handleDeleteImportProfile(profile)}
                                >
                                  Excluir
                                </button>
                              </div>
                            </article>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="form-grid">
                    <label>
                      Veiculo
                      <select
                        onChange={(event) => setExpenseImportVehicleId(event.target.value)}
                        value={expenseImportVehicleId}
                      >
                        <option value="">Sem veiculo especifico</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} - {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      className={
                        isExpenseImportDragging
                          ? "import-dropzone import-dropzone-active"
                          : "import-dropzone"
                      }
                      onDragLeave={() => setIsExpenseImportDragging(false)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsExpenseImportDragging(true);
                      }}
                      onDrop={handleExpenseImportDrop}
                    >
                      <span>Selecionar ou arrastar CSV</span>
                      <small>Clique aqui ou solte o arquivo nesta area.</small>
                      <input
                        accept=".csv,text/csv"
                        type="file"
                        onChange={handleExpenseImportFileChange}
                      />
                    </label>
                  </div>

                  {expenseImportFile ? (
                    <div className="import-file">
                      <div>
                        <strong>{expenseImportFile.name}</strong>
                        <span>{formatFileSize(expenseImportFile.size)}</span>
                      </div>
                      <button
                        className="text-button danger"
                        type="button"
                        onClick={clearExpenseImportFile}
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}

                  {matchedExpenseImportProfile ? (
                    <p className="form-message compact-message">
                      Configuracao aplicada: {matchedExpenseImportProfile.name}.{" "}
                      <button
                        className="text-button"
                        type="button"
                        onClick={handleIgnoreExpenseImportProfile}
                      >
                        Ignorar
                      </button>
                    </p>
                  ) : null}

                  {expenseImportColumns.length ? (
                    <div className="import-mapping">
                      <div>
                        <h4>Qual coluna corresponde a cada informacao?</h4>
                        <p className="subtle-note">
                          Confira as sugestoes e ajuste se precisar antes do preview.
                        </p>
                      </div>
                      <div className="form-grid">
                        {expenseImportMappingFields.map((item) => (
                          <label key={item.field}>
                            {item.label}
                            {item.optional ? " (opcional)" : ""}
                            <select
                              value={expenseImportMapping[item.field]}
                              onChange={(event) => {
                                setExpenseImportMapping({
                                  ...expenseImportMapping,
                                  [item.field]: event.target.value,
                                });
                                setExpenseImportPreview(null);
                                setExpenseImportResult(null);
                                setMatchedExpenseImportProfile(null);
                              }}
                            >
                              <option value="">
                                {item.optional ? "Nao mapear" : "Selecione"}
                              </option>
                              {expenseImportColumns.map((column) => (
                                <option key={`${item.field}-${column}`} value={column}>
                                  {column}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="form-actions import-actions">
                    <button
                      className="button"
                      disabled={
                        isExpenseImportPreviewLoading ||
                        isExpenseImportSaving ||
                        !expenseImportFile
                      }
                      type="button"
                      onClick={() => void handleExpenseImportPreview()}
                    >
                      {isExpenseImportPreviewLoading
                        ? "Validando..."
                        : expenseImportColumns.length
                          ? "Confirmar mapping e visualizar preview"
                          : "Ler colunas e visualizar preview"}
                    </button>
                  </div>

                  {expenseImportError ? (
                    <p className="form-message compact-message">{expenseImportError}</p>
                  ) : null}

                  {expenseImportPreview ? (
                    <div className="import-preview">
                      <dl className="session-metrics import-summary">
                        <div>
                          <dt>Total</dt>
                          <dd>{expenseImportPreview.total_rows}</dd>
                        </div>
                        <div>
                          <dt>Validas</dt>
                          <dd>{expenseImportPreview.valid_rows}</dd>
                        </div>
                        <div>
                          <dt>Invalidas</dt>
                          <dd>{expenseImportPreview.invalid_rows}</dd>
                        </div>
                      </dl>

                      {expenseImportPreview.errors.length > 0 ? (
                        <div className="import-errors">
                          <h4>Corrija o CSV e envie novamente</h4>
                          {expenseImportPreview.errors.map((error, index) => (
                            <article key={`${error.row}-${error.field}-${index}`}>
                              <strong>Linha {error.row}</strong>
                              <span>
                                {getImportFieldLabel(error.field)}: {error.message}
                              </span>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {expenseImportPreview.rows.length > 0 ? (
                        <div className="import-preview-list">
                          {expenseImportPreview.rows.map((row) => (
                            <article className="vehicle-card session-card" key={row.row}>
                              <div>
                                <h4>{formatDate(row.expense_date)}</h4>
                                <p>{getExpenseCategoryLabel(row.category)}</p>
                                <dl className="session-metrics expense-metrics">
                                  <div>
                                    <dt>Valor</dt>
                                    <dd>{formatMoney(row.amount)}</dd>
                                  </div>
                                  <div>
                                    <dt>Descricao</dt>
                                    <dd>{row.description ?? "—"}</dd>
                                  </div>
                                </dl>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {expenseImportPreview.invalid_rows > 0 ? (
                        <p className="empty-state compact-empty-state">
                          Existem linhas invalidas. Corrija o arquivo e envie novamente.
                        </p>
                      ) : (
                        <>
                          <div className="import-mapping">
                            <div>
                              <h4>Salvar esta configuracao para proximas importacoes</h4>
                              <p className="subtle-note">
                                Opcional: informe um nome amigavel para reutilizar este mapeamento.
                              </p>
                            </div>
                            <div className="form-grid">
                              <label>
                                Nome da configuracao
                                <input
                                  onChange={(event) =>
                                    setExpenseImportProfileName(event.target.value)
                                  }
                                  placeholder="Ex.: Despesas do cartao"
                                  value={expenseImportProfileName}
                                />
                              </label>
                            </div>
                            <button
                              className="button button-ghost"
                              disabled={isImportProfileSaving}
                              type="button"
                              onClick={() => void handleSaveExpenseImportProfile()}
                            >
                              {isImportProfileSaving ? "Salvando..." : "Salvar configuracao"}
                            </button>
                          </div>

                          <button
                            className="button"
                            disabled={
                              isExpenseImportSaving ||
                              expenseImportPreview.valid_rows === 0
                            }
                            type="button"
                            onClick={() => void handleConfirmExpenseImport()}
                          >
                            {isExpenseImportSaving
                              ? "Importando..."
                              : `Importar ${expenseImportPreview.valid_rows} despesas`}
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {expenseImportResult ? (
                    <div className="import-result">
                      <h4>Importacao concluida</h4>
                      <dl className="session-metrics import-summary">
                        <div>
                          <dt>Importadas</dt>
                          <dd>{expenseImportResult.imported}</dd>
                        </div>
                        <div>
                          <dt>Duplicadas</dt>
                          <dd>{expenseImportResult.duplicates_skipped}</dd>
                        </div>
                        <div>
                          <dt>Falhas</dt>
                          <dd>{expenseImportResult.failed}</dd>
                        </div>
                      </dl>
                      {expenseImportResult.duplicates_skipped > 0 ? (
                        <p className="subtle-note">
                          O GanhoCerto ignorou despesas que ja haviam sido importadas.
                        </p>
                      ) : null}
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() =>
                          document.getElementById("lista-despesas")?.scrollIntoView({
                            behavior: "smooth",
                          })
                        }
                      >
                        Ver minhas despesas
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="vehicles-layout">
                <form className="auth-form vehicle-form" onSubmit={handleExpenseSubmit}>
                  <h3>{editingExpenseId ? "Editar despesa" : "Cadastrar despesa"}</h3>

                  <div className="form-grid">
                    <label>
                      Data
                      <input
                        name="expense-date"
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            expense_date: event.target.value,
                          })
                        }
                        required
                        type="date"
                        value={expenseForm.expense_date}
                      />
                    </label>

                    <label>
                      Categoria
                      <select
                        name="expense-category"
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            category: event.target.value as ExpenseCategory,
                          })
                        }
                        required
                        value={expenseForm.category}
                      >
                        {expenseCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Valor
                      <input
                        inputMode="decimal"
                        name="expense-amount"
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            amount: event.target.value,
                          })
                        }
                        placeholder="89,90"
                        required
                        type="text"
                        value={expenseForm.amount}
                      />
                    </label>

                    <label>
                      Veículo
                      <select
                        name="expense-vehicle"
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            vehicle_id: event.target.value,
                          })
                        }
                        value={expenseForm.vehicle_id}
                      >
                        <option value="">Sem veículo</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} - {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    Descrição
                    <input
                      maxLength={255}
                      name="expense-description"
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          description: event.target.value,
                        })
                      }
                      placeholder="Opcional"
                      type="text"
                      value={expenseForm.description}
                    />
                  </label>

                  <div className="form-actions">
                    <button className="button" disabled={isExpenseSaving} type="submit">
                      {isExpenseSaving
                        ? "Salvando..."
                        : editingExpenseId
                          ? "Salvar despesa"
                          : "Cadastrar despesa"}
                    </button>
                    {editingExpenseId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={resetExpenseForm}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="vehicles-list" id="lista-despesas" aria-busy={isExpensesLoading}>
                  <div className="list-header">
                    <h3>Minhas despesas</h3>
                    <button
                      className="text-button"
                      disabled={isExpensesLoading}
                      type="button"
                      onClick={() => void loadExpenses()}
                    >
                      Atualizar
                    </button>
                  </div>

                  {isExpensesLoading ? <p className="empty-state">Carregando despesas...</p> : null}

                  {!isExpensesLoading && expenses.length === 0 ? (
                    <p className="empty-state">
                      Nenhuma despesa registrada ainda. Adicione combustível, manutenção e outros
                      custos conforme eles acontecerem.
                    </p>
                  ) : null}

                  {expenses.map((expense) => (
                    <article className="vehicle-card session-card" key={expense.id}>
                      <div>
                        <h4>{formatDate(expense.expense_date)}</h4>
                        <p>{getExpenseCategoryLabel(expense.category)}</p>
                        <dl className="session-metrics expense-metrics">
                          <div>
                            <dt>Valor</dt>
                            <dd>{formatMoney(expense.amount)}</dd>
                          </div>
                          <div>
                            <dt>Veículo</dt>
                            <dd>
                              {expense.vehicle_id
                                ? getVehicleLabel(expense.vehicle_id)
                                : "Sem veículo"}
                            </dd>
                          </div>
                        </dl>
                        {expense.description ? (
                          <p className="expense-description">{expense.description}</p>
                        ) : null}
                      </div>
                      <div className="card-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => handleEditExpense(expense)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => void handleDeleteExpense(expense)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="manager-section" id="despesas-recorrentes">
              <div className="section-title">
                <p className="eyebrow">Despesas recorrentes</p>
                <h3>Custos que se repetem</h3>
                <p className="subtle-note">
                  Cadastre custos que se repetem para nÃ£o precisar informÃ¡-los novamente todos os meses.
                </p>
                <p className="subtle-note">
                  Por enquanto, estes custos ficam apenas configurados: ainda nÃ£o sÃ£o lanÃ§ados como
                  despesas nem aplicados ao dashboard.
                </p>
              </div>

              <div className="vehicles-layout">
                <form className="auth-form vehicle-form" onSubmit={handleRecurringExpenseSubmit}>
                  <h3>
                    {editingRecurringExpenseId
                      ? "Editar despesa recorrente"
                      : "Cadastrar despesa recorrente"}
                  </h3>

                  <div className="form-grid">
                    <label>
                      Categoria
                      <select
                        name="recurring-expense-category"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            category: event.target.value as ExpenseCategory,
                          })
                        }
                        required
                        value={recurringExpenseForm.category}
                      >
                        {expenseCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      FrequÃªncia
                      <select
                        name="recurring-expense-frequency"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            frequency: event.target.value as RecurringExpenseFrequency,
                          })
                        }
                        required
                        value={recurringExpenseForm.frequency}
                      >
                        {recurringFrequencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Valor
                      <input
                        inputMode="decimal"
                        name="recurring-expense-amount"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            amount: event.target.value,
                          })
                        }
                        placeholder="120,35"
                        required
                        type="text"
                        value={recurringExpenseForm.amount}
                      />
                    </label>

                    <label>
                      VeÃ­culo
                      <select
                        name="recurring-expense-vehicle"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            vehicle_id: event.target.value,
                          })
                        }
                        value={recurringExpenseForm.vehicle_id}
                      >
                        <option value="">Todos / sem veÃ­culo especÃ­fico</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} - {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Data de inÃ­cio
                      <input
                        name="recurring-expense-start-date"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            start_date: event.target.value,
                          })
                        }
                        required
                        type="date"
                        value={recurringExpenseForm.start_date}
                      />
                    </label>

                    <label>
                      Data de tÃ©rmino <span className="optional-label">(opcional)</span>
                      <input
                        name="recurring-expense-end-date"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            end_date: event.target.value,
                          })
                        }
                        type="date"
                        value={recurringExpenseForm.end_date}
                      />
                    </label>
                  </div>

                  <label>
                    DescriÃ§Ã£o <span className="optional-label">(opcional)</span>
                    <input
                      maxLength={255}
                      name="recurring-expense-description"
                      onChange={(event) =>
                        setRecurringExpenseForm({
                          ...recurringExpenseForm,
                          description: event.target.value,
                        })
                      }
                      placeholder="Ex: Seguro, aluguel, lavagem"
                      type="text"
                      value={recurringExpenseForm.description}
                    />
                  </label>

                  <label className="toggle-field">
                    <input
                      checked={recurringExpenseForm.active}
                      name="recurring-expense-active"
                      onChange={(event) =>
                        setRecurringExpenseForm({
                          ...recurringExpenseForm,
                          active: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span>Despesa recorrente ativa</span>
                  </label>

                  <div className="form-actions">
                    <button className="button" disabled={isRecurringExpenseSaving} type="submit">
                      {isRecurringExpenseSaving
                        ? "Salvando..."
                        : editingRecurringExpenseId
                          ? "Salvar recorrÃªncia"
                          : "Cadastrar recorrÃªncia"}
                    </button>
                    {editingRecurringExpenseId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={resetRecurringExpenseForm}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="vehicles-list" aria-busy={isRecurringExpensesLoading}>
                  <div className="list-header">
                    <h3>Minhas recorrÃªncias</h3>
                    <button
                      className="text-button"
                      disabled={isRecurringExpensesLoading}
                      type="button"
                      onClick={() => void loadRecurringExpenses()}
                    >
                      Atualizar
                    </button>
                  </div>

                  {isRecurringExpensesLoading ? (
                    <p className="empty-state">Carregando despesas recorrentes...</p>
                  ) : null}

                  {!isRecurringExpensesLoading && recurringExpenses.length === 0 ? (
                    <p className="empty-state">
                      Nenhuma despesa recorrente cadastrada ainda. Use esta Ã¡rea para guardar
                      custos fixos ou frequentes.
                    </p>
                  ) : null}

                  {recurringExpenses.map((recurringExpense) => (
                    <article className="vehicle-card session-card" key={recurringExpense.id}>
                      <div>
                        <div className="recurring-card-title">
                          <h4>{getExpenseCategoryLabel(recurringExpense.category)}</h4>
                          <span
                            className={
                              recurringExpense.active
                                ? "status-pill status-active"
                                : "status-pill status-inactive"
                            }
                          >
                            {recurringExpense.active ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <p>{formatMoney(recurringExpense.amount)}</p>
                        <dl className="session-metrics recurring-metrics">
                          <div>
                            <dt>FrequÃªncia</dt>
                            <dd>{getRecurringFrequencyLabel(recurringExpense.frequency)}</dd>
                          </div>
                          <div>
                            <dt>VeÃ­culo</dt>
                            <dd>
                              {recurringExpense.vehicle_id
                                ? getVehicleLabel(recurringExpense.vehicle_id)
                                : "Todos / sem veÃ­culo"}
                            </dd>
                          </div>
                          <div>
                            <dt>PerÃ­odo</dt>
                            <dd>
                              {formatDate(recurringExpense.start_date)} atÃ©{" "}
                              {recurringExpense.end_date
                                ? formatDate(recurringExpense.end_date)
                                : "sem tÃ©rmino"}
                            </dd>
                          </div>
                        </dl>
                        {recurringExpense.description ? (
                          <p className="expense-description">{recurringExpense.description}</p>
                        ) : null}
                      </div>
                      <div className="card-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => handleEditRecurringExpense(recurringExpense)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void handleToggleRecurringExpense(recurringExpense)}
                        >
                          {recurringExpense.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => void handleDeleteRecurringExpense(recurringExpense)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="manager-section" id="manutencao">
              <div className="section-title">
                <p className="eyebrow">Manutencao</p>
                <h3>Manutencao preventiva</h3>
                <p className="subtle-note">
                  Acompanhe revisoes por tempo ou km trabalhados, sem criar despesas
                  automaticamente.
                </p>
              </div>

              <div className="vehicles-layout">
                <form className="auth-form vehicle-form" onSubmit={handleMaintenancePlanSubmit}>
                  <h3>{editingMaintenancePlanId ? "Editar manutencao" : "Adicionar manutencao"}</h3>

                  <div className="form-grid">
                    <label>
                      Nome
                      <input
                        maxLength={120}
                        name="maintenance-name"
                        onChange={(event) =>
                          setMaintenancePlanForm({
                            ...maintenancePlanForm,
                            name: event.target.value,
                          })
                        }
                        placeholder="Troca de oleo"
                        required
                        type="text"
                        value={maintenancePlanForm.name}
                      />
                    </label>

                    <label>
                      Categoria
                      <select
                        name="maintenance-category"
                        onChange={(event) =>
                          setMaintenancePlanForm({
                            ...maintenancePlanForm,
                            category: event.target.value as MaintenanceCategory,
                          })
                        }
                        required
                        value={maintenancePlanForm.category}
                      >
                        {maintenanceCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Veiculo
                      <select
                        name="maintenance-vehicle"
                        onChange={(event) =>
                          setMaintenancePlanForm({
                            ...maintenancePlanForm,
                            vehicle_id: event.target.value,
                          })
                        }
                        required
                        value={maintenancePlanForm.vehicle_id}
                      >
                        <option value="">Selecione</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} - {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Custo estimado <span className="optional-label">(opcional)</span>
                      <input
                        inputMode="decimal"
                        name="maintenance-estimated-cost"
                        onChange={(event) =>
                          setMaintenancePlanForm({
                            ...maintenancePlanForm,
                            estimated_cost: event.target.value,
                          })
                        }
                        placeholder="280,00"
                        type="text"
                        value={maintenancePlanForm.estimated_cost}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Intervalo em km <span className="optional-label">(opcional)</span>
                      <input
                        inputMode="decimal"
                        name="maintenance-interval-km"
                        onChange={(event) =>
                          setMaintenancePlanForm({
                            ...maintenancePlanForm,
                            interval_km: event.target.value,
                          })
                        }
                        placeholder="10000"
                        type="text"
                        value={maintenancePlanForm.interval_km}
                      />
                    </label>

                    <label>
                      Intervalo em dias <span className="optional-label">(opcional)</span>
                      <input
                        inputMode="numeric"
                        min="1"
                        name="maintenance-interval-days"
                        onChange={(event) =>
                          setMaintenancePlanForm({
                            ...maintenancePlanForm,
                            interval_days: event.target.value,
                          })
                        }
                        placeholder="180"
                        type="number"
                        value={maintenancePlanForm.interval_days}
                      />
                    </label>
                  </div>

                  <p className="subtle-note">
                    Informe pelo menos um intervalo: km ou dias.
                  </p>

                  <label className="toggle-field">
                    <input
                      checked={maintenancePlanForm.active}
                      name="maintenance-active"
                      onChange={(event) =>
                        setMaintenancePlanForm({
                          ...maintenancePlanForm,
                          active: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span>Plano ativo</span>
                  </label>

                  <div className="form-actions">
                    <button className="button" disabled={isMaintenanceSaving} type="submit">
                      {isMaintenanceSaving
                        ? "Salvando..."
                        : editingMaintenancePlanId
                          ? "Salvar manutencao"
                          : "Adicionar manutencao"}
                    </button>
                    {editingMaintenancePlanId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={resetMaintenancePlanForm}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="vehicles-list" aria-busy={isMaintenanceLoading}>
                  <div className="list-header">
                    <h3>Minhas manutencoes</h3>
                    <button
                      className="text-button"
                      disabled={isMaintenanceLoading}
                      type="button"
                      onClick={() => void loadMaintenancePlans()}
                    >
                      Atualizar
                    </button>
                  </div>

                  {isMaintenanceLoading ? (
                    <p className="empty-state">Carregando manutencoes...</p>
                  ) : null}

                  {!isMaintenanceLoading && maintenancePlans.length === 0 ? (
                    <p className="empty-state">
                      Configure suas manutencoes para saber quando revisar o veiculo e quanto reservar.{" "}
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          document.getElementById("manutencao")?.scrollIntoView({
                            behavior: "smooth",
                          })
                        }
                      >
                        Adicionar manutencao
                      </button>
                    </p>
                  ) : null}

                  {(["due", "due_soon", "ok"] as MaintenanceStatusType[]).map((statusValue) => {
                    const plans = getMaintenancePlansByStatus(statusValue);
                    if (plans.length === 0) {
                      return null;
                    }

                    return (
                      <div className="daily-breakdown" key={statusValue}>
                        <div className="list-header">
                          <h3>{getMaintenanceStatusLabel(statusValue)}</h3>
                        </div>

                        {plans.map((plan) => {
                          const planStatus = maintenanceStatusesById[plan.id];
                          const records = maintenanceRecordsByPlanId[plan.id] ?? [];

                          return (
                            <article className="vehicle-card session-card" key={plan.id}>
                              <div>
                                <div className="recurring-card-title">
                                  <div>
                                    <h4>{plan.name}</h4>
                                    <p>
                                      {getMaintenanceCategoryLabel(plan.category)} ·{" "}
                                      {getVehicleLabel(plan.vehicle_id)}
                                    </p>
                                  </div>
                                  <span className={getMaintenanceStatusClass(planStatus.status)}>
                                    {getMaintenanceStatusLabel(planStatus.status)}
                                  </span>
                                </div>

                                {planStatus.km_remaining !== null && planStatus.status !== "due" ? (
                                  <p className="subtle-note">
                                    Faltam aproximadamente {formatDistance(planStatus.km_remaining)} km.
                                  </p>
                                ) : null}

                                <dl className="session-metrics recurring-metrics">
                                  <div>
                                    <dt>Km desde a ultima</dt>
                                    <dd>
                                      {planStatus.km_since_last_service
                                        ? `${formatDistance(planStatus.km_since_last_service)} km`
                                        : "—"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Km restantes</dt>
                                    <dd>
                                      {planStatus.km_remaining
                                        ? `${formatDistance(planStatus.km_remaining)} km`
                                        : "—"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Dias desde a ultima</dt>
                                    <dd>
                                      {planStatus.days_since_last_service ?? "—"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Dias restantes</dt>
                                    <dd>{planStatus.days_remaining ?? "—"}</dd>
                                  </div>
                                  <div>
                                    <dt>Custo estimado</dt>
                                    <dd>
                                      {planStatus.estimated_cost
                                        ? formatMoney(planStatus.estimated_cost)
                                        : "—"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Reserva sugerida</dt>
                                    <dd>
                                      {planStatus.recommended_reserve_per_km
                                        ? formatMoneyPerKm(planStatus.recommended_reserve_per_km)
                                        : "—"}
                                    </dd>
                                  </div>
                                </dl>

                                <div className="import-preview">
                                  <div className="list-header">
                                    <h4>Historico</h4>
                                  </div>
                                  {records.length === 0 ? (
                                    <p className="subtle-note">
                                      Nenhuma manutencao registrada ainda.
                                    </p>
                                  ) : (
                                    <div className="import-preview-list">
                                      {records.map((record) => (
                                        <article className="vehicle-card session-card" key={record.id}>
                                          <div>
                                            <h4>{formatDate(record.service_date)}</h4>
                                            <p>{record.notes ?? "Sem observacao"}</p>
                                          </div>
                                        </article>
                                      ))}
                                    </div>
                                  )}

                                  {recordingMaintenancePlanId === plan.id ? (
                                    <form
                                      className="auth-form"
                                      onSubmit={handleMaintenanceRecordSubmit}
                                    >
                                      <div className="form-grid">
                                        <label>
                                          Data
                                          <input
                                            onChange={(event) =>
                                              setMaintenanceRecordForm({
                                                ...maintenanceRecordForm,
                                                service_date: event.target.value,
                                              })
                                            }
                                            required
                                            type="date"
                                            value={maintenanceRecordForm.service_date}
                                          />
                                        </label>
                                        <label>
                                          Observacao <span className="optional-label">(opcional)</span>
                                          <input
                                            maxLength={255}
                                            onChange={(event) =>
                                              setMaintenanceRecordForm({
                                                ...maintenanceRecordForm,
                                                notes: event.target.value,
                                              })
                                            }
                                            placeholder="Ex.: troca feita na oficina"
                                            type="text"
                                            value={maintenanceRecordForm.notes}
                                          />
                                        </label>
                                      </div>
                                      <div className="form-actions">
                                        <button
                                          className="button"
                                          disabled={isMaintenanceRecordSaving}
                                          type="submit"
                                        >
                                          {isMaintenanceRecordSaving
                                            ? "Registrando..."
                                            : "Salvar registro"}
                                        </button>
                                        <button
                                          className="button button-ghost"
                                          type="button"
                                          onClick={() => setRecordingMaintenancePlanId(null)}
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </form>
                                  ) : null}
                                </div>
                              </div>

                              <div className="card-actions">
                                <button
                                  className="text-button"
                                  type="button"
                                  onClick={() => handleStartMaintenanceRecord(plan.id)}
                                >
                                  Registrar manutencao realizada
                                </button>
                                <button
                                  className="text-button"
                                  type="button"
                                  onClick={() => handleEditMaintenancePlan(plan)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="text-button danger"
                                  type="button"
                                  onClick={() => void handleDeleteMaintenancePlan(plan)}
                                >
                                  Excluir
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="manager-section" id="veiculos">
              <div className="section-title">
                <p className="eyebrow">Veículos</p>
                <h3>Carros disponíveis para jornadas</h3>
                {pendingQuickStartAction ? (
                  <p className="subtle-note">
                    Cadastre os dados básicos do veículo para continuar sem perder sua simulação.
                  </p>
                ) : null}
              </div>

              <div className="vehicles-layout">
                <form className="auth-form vehicle-form" onSubmit={handleVehicleSubmit}>
                  <h3>{editingVehicleId ? "Editar veiculo" : "Cadastrar veiculo"}</h3>

                  <label>
                    Nome
                    <input
                      name="vehicle-name"
                      onChange={(event) =>
                        setVehicleForm({ ...vehicleForm, name: event.target.value })
                      }
                      required
                      type="text"
                      value={vehicleForm.name}
                    />
                  </label>

                  <div className="form-grid">
                    <label>
                      Marca
                      <input
                        name="brand"
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, brand: event.target.value })
                        }
                        required
                        type="text"
                        value={vehicleForm.brand}
                      />
                    </label>

                    <label>
                      Modelo
                      <input
                        name="model"
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, model: event.target.value })
                        }
                        required
                        type="text"
                        value={vehicleForm.model}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      Ano
                      <input
                        max="2100"
                        min="1900"
                        name="year"
                        onChange={(event) =>
                          setVehicleForm({ ...vehicleForm, year: event.target.value })
                        }
                        required
                        type="number"
                        value={vehicleForm.year}
                      />
                    </label>

                    <label>
                      Combustivel
                      <select
                        name="fuel-type"
                        onChange={(event) =>
                          setVehicleForm({
                            ...vehicleForm,
                            fuel_type: event.target.value as FuelType,
                          })
                        }
                        value={vehicleForm.fuel_type}
                      >
                        {fuelOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button className="button" disabled={isVehicleSaving} type="submit">
                      {isVehicleSaving
                        ? "Salvando..."
                        : editingVehicleId
                          ? "Salvar alteracoes"
                          : "Cadastrar veiculo"}
                    </button>
                    {editingVehicleId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={resetVehicleForm}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="vehicles-list" aria-busy={isVehiclesLoading}>
                  <div className="list-header">
                    <h3>Meus veiculos</h3>
                    <button
                      className="text-button"
                      disabled={isVehiclesLoading}
                      type="button"
                      onClick={() => void loadVehicles()}
                    >
                      Atualizar
                    </button>
                  </div>

                  {isVehiclesLoading ? (
                    <p className="empty-state">Carregando veiculos...</p>
                  ) : null}

                  {!isVehiclesLoading && vehicles.length === 0 ? (
                    <p className="empty-state">
                      Nenhum veiculo cadastrado ainda. Adicione o carro que voce usa para dirigir.
                    </p>
                  ) : null}

                  {vehicles.map((vehicle) => (
                    <article className="vehicle-card" key={vehicle.id}>
                      <div>
                        <h4>{vehicle.name}</h4>
                        <p>
                          {vehicle.brand} {vehicle.model} · {vehicle.year}
                        </p>
                        <span>{getFuelLabel(vehicle.fuel_type)}</span>
                      </div>
                      <div className="card-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void handleOpenCostProfile(vehicle)}
                        >
                          Configurar custos
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => handleEditVehicle(vehicle)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => void handleDeleteVehicle(vehicle)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {selectedCostProfileVehicle ? (
                <form
                  className="auth-form cost-profile-panel"
                  onSubmit={handleCostProfileSubmit}
                >
                  <div className="section-title">
                    <p className="eyebrow">Custo real do veiculo</p>
                    <h3>Custos de {selectedCostProfileVehicle.name}</h3>
                    <p className="subtle-note">
                      Esses valores ajudam o GanhoCerto a estimar custos que nem sempre aparecem
                      como despesas no dia a dia.
                    </p>
                    <p className="subtle-note">
                      Combustivel e recarga continuam sendo lancados em Despesas. Estes dados ainda
                      nao alteram o dashboard financeiro.
                    </p>
                  </div>

                  {isCostProfileLoading ? (
                    <p className="empty-state">Carregando perfil de custos...</p>
                  ) : null}

                  <fieldset className="form-group" disabled={isCostProfileLoading}>
                    <legend>Tipo de posse</legend>
                    <label>
                      Tipo de posse
                      <select
                        name="ownership-type"
                        onChange={(event) =>
                          setCostProfileForm({
                            ...costProfileForm,
                            ownership_type: event.target.value as OwnershipType,
                          })
                        }
                        value={costProfileForm.ownership_type}
                      >
                        {ownershipOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>

                  <fieldset className="form-group" disabled={isCostProfileLoading}>
                    <legend>Custos fixos</legend>
                    <div className="form-grid">
                      <label
                        className={
                          costProfileForm.ownership_type === "rented"
                            ? "cost-field cost-field-active"
                            : "cost-field"
                        }
                      >
                        Aluguel mensal
                        <input
                          inputMode="decimal"
                          name="rental-monthly"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              rental_monthly: event.target.value,
                            })
                          }
                          placeholder="Ex: 2.200,00"
                          type="text"
                          value={costProfileForm.rental_monthly}
                        />
                      </label>

                      <label
                        className={
                          costProfileForm.ownership_type === "financed"
                            ? "cost-field cost-field-active"
                            : "cost-field"
                        }
                      >
                        Financiamento mensal
                        <input
                          inputMode="decimal"
                          name="financing-monthly"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              financing_monthly: event.target.value,
                            })
                          }
                          placeholder="Ex: 1.800,00"
                          type="text"
                          value={costProfileForm.financing_monthly}
                        />
                      </label>
                    </div>

                    <div className="form-grid form-grid-three">
                      <label>
                        Seguro mensal
                        <input
                          inputMode="decimal"
                          name="insurance-monthly"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              insurance_monthly: event.target.value,
                            })
                          }
                          placeholder="Ex: 250,00"
                          type="text"
                          value={costProfileForm.insurance_monthly}
                        />
                      </label>

                      <label>
                        IPVA anual
                        <input
                          inputMode="decimal"
                          name="ipva-annual"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              ipva_annual: event.target.value,
                            })
                          }
                          placeholder="Ex: 1.450,00"
                          type="text"
                          value={costProfileForm.ipva_annual}
                        />
                      </label>

                      <label>
                        Outros fixos mensais
                        <input
                          inputMode="decimal"
                          name="other-fixed-monthly"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              other_fixed_monthly: event.target.value,
                            })
                          }
                          placeholder="Ex: 75,00"
                          type="text"
                          value={costProfileForm.other_fixed_monthly}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="form-group" disabled={isCostProfileLoading}>
                    <legend>Provisoes por km</legend>
                    <div className="form-grid">
                      <label>
                        Manutencao por km
                        <input
                          inputMode="decimal"
                          name="maintenance-per-km"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              maintenance_per_km: event.target.value,
                            })
                          }
                          placeholder="Ex: 0,18"
                          type="text"
                          value={costProfileForm.maintenance_per_km}
                        />
                      </label>

                      <label>
                        Pneus por km
                        <input
                          inputMode="decimal"
                          name="tires-per-km"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              tires_per_km: event.target.value,
                            })
                          }
                          placeholder="Ex: 0,05"
                          type="text"
                          value={costProfileForm.tires_per_km}
                        />
                      </label>
                    </div>

                    <div className="form-grid">
                      <label>
                        Oleo por km
                        <input
                          inputMode="decimal"
                          name="oil-per-km"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              oil_per_km: event.target.value,
                            })
                          }
                          placeholder="Ex: 0,03"
                          type="text"
                          value={costProfileForm.oil_per_km}
                        />
                      </label>

                      <label>
                        Depreciacao por km
                        <input
                          inputMode="decimal"
                          name="depreciation-per-km"
                          onChange={(event) =>
                            setCostProfileForm({
                              ...costProfileForm,
                              depreciation_per_km: event.target.value,
                            })
                          }
                          placeholder="Ex: 0,21"
                          type="text"
                          value={costProfileForm.depreciation_per_km}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="form-group" disabled={isCostProfileLoading}>
                    <legend>Adicional</legend>
                    <label>
                      Consumo medio em km/l
                      <input
                        inputMode="decimal"
                        name="fuel-efficiency"
                        onChange={(event) =>
                          setCostProfileForm({
                            ...costProfileForm,
                            fuel_efficiency_km_per_liter: event.target.value,
                          })
                        }
                        placeholder="Ex: 10,5"
                        type="text"
                        value={costProfileForm.fuel_efficiency_km_per_liter}
                      />
                    </label>
                  </fieldset>

                  <div className="form-actions">
                    <button
                      className="button"
                      disabled={isCostProfileSaving || isCostProfileLoading}
                      type="submit"
                    >
                      {isCostProfileSaving ? "Salvando..." : "Salvar perfil de custos"}
                    </button>
                    <button
                      className="button button-ghost"
                      disabled={isCostProfileSaving}
                      type="button"
                      onClick={closeCostProfileForm}
                    >
                      Fechar
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          </div>
        ) : (
          <>
            <div className="tabs" role="tablist" aria-label="Autenticacao">
              <button
                className={mode === "login" ? "tab tab-active" : "tab"}
                type="button"
                onClick={() => resetForm("login")}
              >
                Login
              </button>
              <button
                className={mode === "register" ? "tab tab-active" : "tab"}
                type="button"
                onClick={() => resetForm("register")}
              >
                Cadastro
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <h2>{mode === "login" ? "Entrar" : "Criar conta"}</h2>

              {mode === "register" ? (
                <label>
                  Nome
                  <input
                    autoComplete="name"
                    name="name"
                    onChange={(event) => setName(event.target.value)}
                    required
                    type="text"
                    value={name}
                  />
                </label>
              ) : null}

              <label>
                Email
                <input
                  autoComplete="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label>
                Senha
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "login" ? 1 : 6}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              {message ? <p className="form-message">{message}</p> : null}
              {successMessage ? <p className="success-message">{successMessage}</p> : null}

              <button className="button" disabled={isLoading} type="submit">
                {isLoading ? "Enviando..." : mode === "login" ? "Entrar" : "Cadastrar"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
