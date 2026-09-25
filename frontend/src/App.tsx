import { FormEvent, useEffect, useRef, useState } from "react";

import { requestApi } from "./api/client";
import {
  createExpense,
  createRecurringExpense,
  deleteExpense,
  deleteRecurringExpense,
  listExpenses,
  listRecurringExpenses,
  updateExpense,
  updateRecurringExpense,
} from "./api/expenses";
import { getFinancialHistory, getFinancialInsights, getFinancialSummary } from "./api/financial";
import { listVehicles } from "./api/vehicles";
import "./App.css";
import { CsvImportSection } from "./features/imports/CsvImportSection";
import { ResultSection } from "./features/result/ResultSection";
import {
  VehiclesSection,
  type VehiclesSectionHandle,
} from "./features/vehicles/VehiclesSection";
import type {
  AuthMode,
  DashboardPeriod,
  Expense,
  ExpenseCategory,
  FinancialGoalType,
  FinancialHistoryGrouping,
  HistoryPeriodPreset,
  MaintenanceCategory,
  MaintenancePlan,
  MaintenancePlanStatus,
  MaintenanceRecord,
  MaintenanceStatusType,
  OwnershipType,
  RecurringExpense,
  RecurringExpenseFrequency,
  TokenResponse,
  User,
  Vehicle,
  WorkSession,
} from "./types/domain";
import type {
  FinancialGoal,
  FinancialGoalProgress,
  FinancialHistoryResponse,
  FinancialInsight,
  FinancialSummary,
} from "./types/financial";
import { getDefaultHistoryGrouping, getHistoryPeriodDates, toDateInputValue } from "./utils/dates";
import {
  formatDate,
  formatDistance,
  formatWorkTime,
  getProgressWidth,
} from "./utils/formatters";
import {
  formatMoney,
  formatMoneyPerKm,
  formatOptionalMoneyForInput,
  moneyInputToApi,
  moneyInputToCents,
  moneyValueToCents,
  normalizeDecimalInput,
  optionalDecimalInputToApi,
  optionalMoneyInputToApi,
  parseNonNegativeDecimal,
} from "./utils/money";

const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";

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

const ownershipOptions: Array<{ label: string; value: OwnershipType }> = [
  { label: "Proprio", value: "owned" },
  { label: "Financiado", value: "financed" },
  { label: "Alugado", value: "rented" },
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

const emptyWorkSessionForm: WorkSessionForm = {
  work_date: toDateInputValue(new Date()),
  vehicle_id: "",
  gross_revenue: "",
  distance_km: "",
  worked_hours: "",
  worked_minutes: "",
  trip_count: "",
};

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
    return "Manutenção necessária";
  }

  if (value === "due_soon") {
    return "Próxima manutenção";
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

function formatPercent(value: string | null): string {
  if (value === null) {
    return "—";
  }

  const normalized = value.replace(".", ",");
  return normalized.endsWith(",00") ? `${normalized.slice(0, -3)}%` : `${normalized}%`;
}

function formatHours(value: string | null): string {
  if (value === null) {
    return "—";
  }

  return `${value.replace(".", ",")} h`;
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

function App() {
  const initialHistoryRange = getHistoryPeriodDates("last30", "", "");
  const vehiclesSectionRef = useRef<VehiclesSectionHandle>(null);
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
  const [financialHistory, setFinancialHistory] = useState<FinancialHistoryResponse | null>(null);
  const [workSessionForm, setWorkSessionForm] =
    useState<WorkSessionForm>(emptyWorkSessionForm);
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
  const [editingWorkSessionId, setEditingWorkSessionId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingRecurringExpenseId, setEditingRecurringExpenseId] = useState<number | null>(null);
  const [editingFinancialGoalId, setEditingFinancialGoalId] = useState<number | null>(null);
  const [editingMaintenancePlanId, setEditingMaintenancePlanId] = useState<number | null>(null);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("last7");
  const [dashboardVehicleId, setDashboardVehicleId] = useState("");
  const [customStartDate, setCustomStartDate] = useState(toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(toDateInputValue(new Date()));
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriodPreset>("last30");
  const [historyStartDate, setHistoryStartDate] = useState(initialHistoryRange.startDate);
  const [historyEndDate, setHistoryEndDate] = useState(initialHistoryRange.endDate);
  const [historyGrouping, setHistoryGrouping] = useState<FinancialHistoryGrouping>(
    getDefaultHistoryGrouping(initialHistoryRange.startDate, initialHistoryRange.endDate),
  );
  const [historyVehicleId, setHistoryVehicleId] = useState("");
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [financialInsightsError, setFinancialInsightsError] = useState("");
  const [financialHistoryError, setFinancialHistoryError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isWorkSessionsLoading, setIsWorkSessionsLoading] = useState(false);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [isRecurringExpensesLoading, setIsRecurringExpensesLoading] = useState(false);
  const [isFinancialGoalsLoading, setIsFinancialGoalsLoading] = useState(false);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isFinancialInsightsLoading, setIsFinancialInsightsLoading] = useState(false);
  const [isFinancialHistoryLoading, setIsFinancialHistoryLoading] = useState(false);
  const [isWorkSessionSaving, setIsWorkSessionSaving] = useState(false);
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
    setFinancialGoals([]);
    setFinancialGoalProgressById({});
    setMaintenancePlans([]);
    setMaintenanceStatusesById({});
    setMaintenanceRecordsByPlanId({});
    setFinancialSummary(null);
    setFinancialInsights([]);
    setFinancialHistory(null);
    setEditingWorkSessionId(null);
    setEditingExpenseId(null);
    setEditingRecurringExpenseId(null);
    setEditingFinancialGoalId(null);
    setEditingMaintenancePlanId(null);
    setWorkSessionForm(emptyWorkSessionForm);
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
    setFinancialHistoryError("");
    setHistoryVehicleId("");
    setMessage(nextMessage);
  }

  function getAuthHeaders(currentToken = token): Record<string, string> {
    return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
  }

  function getVehicleLabel(vehicleId: number): string {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle ? `${vehicle.name} · ${vehicle.brand} ${vehicle.model}` : "Veiculo removido";
  }

  function isPositiveMoney(value: string): boolean {
    return Number(value) > 0;
  }

  function handleHistoryPeriodChange(nextPeriod: HistoryPeriodPreset) {
    const { startDate, endDate } = getHistoryPeriodDates(
      nextPeriod,
      historyStartDate,
      historyEndDate,
    );
    setHistoryPeriod(nextPeriod);
    setHistoryStartDate(startDate);
    setHistoryEndDate(endDate);
    setHistoryGrouping(getDefaultHistoryGrouping(startDate, endDate));
  }

  function handleHistoryDateChange(field: "start" | "end", value: string) {
    const nextStartDate = field === "start" ? value : historyStartDate;
    const nextEndDate = field === "end" ? value : historyEndDate;
    setHistoryPeriod("custom");
    setHistoryStartDate(nextStartDate);
    setHistoryEndDate(nextEndDate);
    setHistoryGrouping(getDefaultHistoryGrouping(nextStartDate, nextEndDate));
  }

  async function loadVehicles(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsVehiclesLoading(true);
    try {
      const nextVehicles = await listVehicles(getAuthHeaders(currentToken));
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
      setHistoryVehicleId((currentVehicleId) => {
        if (nextVehicles.length === 1) {
          return String(nextVehicles[0].id);
        }

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
      const nextExpenses = await listExpenses(getAuthHeaders(currentToken));
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
      const nextRecurringExpenses = await listRecurringExpenses(getAuthHeaders(currentToken));
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
      const summary = await getFinancialSummary(getAuthHeaders(currentToken), {
        period: dashboardPeriod,
        customStartDate,
        customEndDate,
        vehicleId: dashboardVehicleId,
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
      const response = await getFinancialInsights(getAuthHeaders(currentToken), {
        period: dashboardPeriod,
        customStartDate,
        customEndDate,
        vehicleId: dashboardVehicleId,
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

  async function loadFinancialHistory(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsFinancialHistoryLoading(true);
    setFinancialHistoryError("");
    try {
      const history = await getFinancialHistory(getAuthHeaders(currentToken), {
        startDate: historyStartDate,
        endDate: historyEndDate,
        grouping: historyGrouping,
        vehicleId: historyVehicleId,
      });
      setFinancialHistory(history);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setFinancialHistory(null);
        setFinancialHistoryError("Não foi possível carregar sua evolução agora.");
      }
    } finally {
      setIsFinancialHistoryLoading(false);
    }
  }

  async function refreshDashboardData(currentToken = token) {
    await loadFinancialSummary(currentToken);
    await loadFinancialInsights(currentToken);
    await loadFinancialHistory(currentToken);
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setVehicles([]);
      setWorkSessions([]);
      setExpenses([]);
      setRecurringExpenses([]);
      setFinancialGoals([]);
      setFinancialGoalProgressById({});
      setMaintenancePlans([]);
      setMaintenanceStatusesById({});
      setMaintenanceRecordsByPlanId({});
      setFinancialSummary(null);
      setFinancialInsights([]);
      setFinancialHistory(null);
      setFinancialHistoryError("");
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

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    void loadFinancialHistory(token);
  }, [historyPeriod, historyStartDate, historyEndDate, historyGrouping, historyVehicleId]);

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
      document.getElementById("hoje")?.scrollIntoView({ behavior: "smooth" }),
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
      document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  function openDailyExpenseShortcut() {
    const vehicle = quickDailyEntryResult?.vehicle ?? getQuickDailyVehicle();

    setDailyExpenseForm({
      ...emptyExpenseForm,
      expense_date: quickDailyEntryResult?.workDate ?? toDateInputValue(new Date()),
      vehicle_id: vehicle ? String(vehicle.id) : "",
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
    await vehiclesSectionRef.current?.openCostProfile(vehicle, {
      ownership_type: quickStartForm.ownership_type,
      rental_monthly:
        quickStartForm.ownership_type === "rented" ? quickStartForm.rental_monthly : "",
      financing_monthly:
        quickStartForm.ownership_type === "financed" ? quickStartForm.financing_monthly : "",
    });
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
    document.getElementById("mais")?.scrollIntoView({ behavior: "smooth" });
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

  async function handleVehicleCreated(savedVehicle: Vehicle) {
    if (pendingQuickStartAction === "register") {
      await registerQuickStartDay(savedVehicle);
    }
    if (pendingQuickStartAction === "configure") {
      await handleQuickStartConfigure(savedVehicle);
    }
    if (pendingQuickDailyEntry) {
      await saveQuickDailyEntry(savedVehicle);
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
        await updateExpense(getAuthHeaders(), editingExpenseId, payload);
        setSuccessMessage("Despesa atualizada com sucesso.");
      } else {
        await createExpense(getAuthHeaders(), payload);
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
      await deleteExpense(getAuthHeaders(), expense.id);
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
        await updateRecurringExpense(getAuthHeaders(), editingRecurringExpenseId, payload);
        setSuccessMessage("Despesa recorrente atualizada com sucesso.");
      } else {
        await createRecurringExpense(getAuthHeaders(), payload);
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
      await updateRecurringExpense(getAuthHeaders(), recurringExpense.id, {
        category: recurringExpense.category,
        amount: recurringExpense.amount,
        frequency: recurringExpense.frequency,
        start_date: recurringExpense.start_date,
        end_date: recurringExpense.end_date,
        description: recurringExpense.description,
        active: !recurringExpense.active,
        ...(recurringExpense.vehicle_id ? { vehicle_id: recurringExpense.vehicle_id } : {}),
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
      await deleteRecurringExpense(getAuthHeaders(), recurringExpense.id);
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

  function getQuickDailyExpenseTotalCents(result: QuickDailyEntryResult): bigint {
    return expenses
      .filter(
        (expense) =>
          expense.expense_date === result.workDate &&
          expense.vehicle_id === result.vehicle.id,
      )
      .reduce((total, expense) => total + moneyValueToCents(expense.amount), 0n);
  }

  function getPrimaryMaintenanceAlert(): { plan: MaintenancePlan; status: MaintenancePlanStatus } | null {
    for (const plan of maintenancePlans) {
      const status = maintenanceStatusesById[plan.id];
      if (plan.active && status && (status.status === "due" || status.status === "due_soon")) {
        return { plan, status };
      }
    }

    return null;
  }

  const isQuickStartVisible = workSessions.length === 0 || quickStartVisible;
  const quickDailyExpenseTotalCents = quickDailyEntryResult
    ? getQuickDailyExpenseTotalCents(quickDailyEntryResult)
    : 0n;
  const quickDailyRemainingCents = quickDailyEntryResult
    ? quickDailyEntryResult.grossRevenueCents - quickDailyExpenseTotalCents
    : 0n;
  const maintenanceAlert = getPrimaryMaintenanceAlert();
  const shouldShowCostPrecisionPrompt =
    vehicles.length > 0 &&
    !isDashboardLoading &&
    financialSummary !== null &&
    !isPositiveMoney(financialSummary.estimated_structural_costs);

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
                <p className="eyebrow">GanhoCerto</p>
                <h2>{workSessions.length === 0 ? "Descubra seu GanhoCerto" : `Ola, ${user.name}.`}</h2>
              </div>
              <details className="account-menu">
                <summary>Conta</summary>
                <dl className="user-data compact-user-data">
                  <div>
                    <dt>Nome</dt>
                    <dd>{user.name}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{user.email}</dd>
                  </div>
                </dl>
                <button className="button button-secondary" type="button" onClick={handleLogout}>
                  Sair
                </button>
              </details>
            </div>

            {message ? <p className="form-message">{message}</p> : null}
            {successMessage ? <p className="success-message">{successMessage}</p> : null}

            <nav className="dashboard-nav" aria-label="Navegacao principal">
              <a href="#hoje">Hoje</a>
              {workSessions.length > 0 ? <a href="#resultado">Resultado</a> : <a href="#quick-start">Resultado</a>}
              <a href="#custos">Custos</a>
              <a href="#mais">Mais</a>
            </nav>

            <section className="daily-entry" id="hoje">
              <div className="section-title">
                <p className="eyebrow">Registro rapido</p>
                <h3>Registrar meu dia</h3>
                <p className="subtle-note">
                  Preencha o essencial e salve sua jornada em poucos segundos.
                </p>
              </div>

              {workSessions.length === 0 ? (
                <div className="activation-panel">
                  <h4>Descubra seu GanhoCerto</h4>
                  <p>
                    Comece registrando seu dia. Se quiser testar primeiro, use a simulação sem salvar.
                  </p>
                  <div className="quick-action-grid">
                    <a className="button" href="#hoje">
                      Registrar meu dia
                    </a>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => {
                        setQuickStartVisible(true);
                        requestAnimationFrame(() =>
                          document.getElementById("quick-start")?.scrollIntoView({ behavior: "smooth" }),
                        );
                      }}
                    >
                      Simular sem salvar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="quick-action-grid" aria-label="Ações rápidas de hoje">
                <a className="button" href="#hoje">
                  Registrar meu dia
                </a>
                <button className="button button-ghost" type="button" onClick={openDailyExpenseShortcut}>
                  Adicionar gasto
                </button>
              </div>

              {shouldShowCostPrecisionPrompt ? (
                <div className="action-prompt">
                  <div>
                    <strong>Melhore a precisão do seu GanhoCerto</strong>
                    <p>Configure os principais custos do veículo para obter uma estimativa mais completa.</p>
                  </div>
                  <a className="button button-ghost" href="#veiculos">
                    Configurar custos
                  </a>
                </div>
              ) : null}

              {maintenanceAlert ? (
                <div className="action-prompt maintenance-prompt">
                  <div>
                    <strong>Próxima manutenção</strong>
                    <p>
                      {maintenanceAlert.plan.name}
                      {maintenanceAlert.status.km_remaining
                        ? ` - faltam aproximadamente ${formatDistance(maintenanceAlert.status.km_remaining)} km`
                        : maintenanceAlert.status.days_remaining !== null
                          ? ` - faltam ${maintenanceAlert.status.days_remaining} dias`
                          : " - atenção necessária"}
                    </p>
                    {maintenanceAlert.status.recommended_reserve_per_km ? (
                      <small>
                        Reserva sugerida:{" "}
                        {formatMoneyPerKm(maintenanceAlert.status.recommended_reserve_per_km)}
                      </small>
                    ) : null}
                  </div>
                  <a className="text-button" href="#manutencao">
                    Ver manutenção
                  </a>
                </div>
              ) : null}

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
                  <div className="section-title">
                    <p className="eyebrow">Resultado parcial de hoje</p>
                    <h3>O que já dá para ver</h3>
                    <p className="subtle-note">
                      Este valor considera os gastos de hoje que já foram registrados. Não é lucro final.
                    </p>
                  </div>

                  <div className="metric-grid daily-entry-metrics daily-entry-primary-metrics">
                    <article className="metric-card metric-profit">
                      <span>Faturamento</span>
                      <strong>{formatCents(quickDailyEntryResult.grossRevenueCents)}</strong>
                    </article>
                    <article className="metric-card metric-expense">
                      <span>Gastos registrados hoje</span>
                      <strong>{formatCents(quickDailyExpenseTotalCents)}</strong>
                    </article>
                    <article
                      className={
                        quickDailyRemainingCents < 0n
                          ? "metric-card metric-negative"
                          : "metric-card metric-profit"
                      }
                    >
                      <span>Sobra após gastos</span>
                      <strong>{formatCents(quickDailyRemainingCents)}</strong>
                    </article>
                  </div>

                  {quickDailyExpenseTotalCents === 0n ? (
                    <div className="action-prompt">
                      <div>
                        <strong>Você ainda não adicionou gastos de hoje.</strong>
                        <p>Inclua combustivel, recarga ou outros custos para melhorar a sobra parcial.</p>
                      </div>
                      <button className="button" type="button" onClick={openDailyExpenseShortcut}>
                        Adicionar gasto de hoje
                      </button>
                    </div>
                  ) : null}

                  <div className="metric-grid daily-entry-metrics secondary-metrics">
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
                    <button className="button" type="button" onClick={openDailyExpenseShortcut}>
                      Adicionar gasto de hoje
                    </button>
                    <button className="button button-ghost" type="button" onClick={handleViewCompleteResult}>
                      Ver resultado completo
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

              {dailyExpenseVisible && !quickDailyEntryResult ? (
                <form className="auth-form daily-expense-form" onSubmit={handleDailyExpenseSubmit}>
                  <div className="section-title">
                    <p className="eyebrow">Gasto de hoje</p>
                    <h3>Adicionar gasto</h3>
                    <p className="subtle-note">Data {formatDate(dailyExpenseForm.expense_date)}.</p>
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

                  {vehicles.length > 1 ? (
                    <label>
                      Veículo
                      <select
                        onChange={(event) =>
                          setDailyExpenseForm({
                            ...dailyExpenseForm,
                            vehicle_id: event.target.value,
                          })
                        }
                        value={dailyExpenseForm.vehicle_id}
                      >
                        <option value="">Gasto geral / sem veículo</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} - {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

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

                  <div className="simple-goal-intro">
                    <strong>Quanto você quer que sobre?</strong>
                    <p>
                      Por padrão, a meta acompanha a sobra após as despesas que você registrou.
                    </p>
                  </div>

                  <details
                    className="advanced-options"
                    open={financialGoalForm.goal_type === "projected"}
                  >
                    <summary>Opção avançada</summary>
                    <label className="toggle-field">
                      <input
                        checked={financialGoalForm.goal_type === "projected"}
                        name="financial-goal-type"
                        onChange={(event) =>
                          setFinancialGoalForm({
                            ...financialGoalForm,
                            goal_type: event.target.checked ? "projected" : "net",
                          })
                        }
                        type="checkbox"
                      />
                      <span>Usar resultado projetado</span>
                    </label>
                    {financialGoalForm.goal_type === "projected" ? (
                      <p className="subtle-note">
                        O resultado projetado também considera custos do veículo e despesas
                        recorrentes previstas.
                      </p>
                    ) : null}
                  </details>

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
              <ResultSection
                vehicles={vehicles}
                dashboardFilters={{
                  period: dashboardPeriod,
                  customStartDate,
                  customEndDate,
                  vehicleId: dashboardVehicleId,
                  onPeriodChange: setDashboardPeriod,
                  onCustomStartDateChange: setCustomStartDate,
                  onCustomEndDateChange: setCustomEndDate,
                  onVehicleChange: setDashboardVehicleId,
                }}
                historyFilters={{
                  period: historyPeriod,
                  startDate: historyStartDate,
                  endDate: historyEndDate,
                  grouping: historyGrouping,
                  vehicleId: historyVehicleId,
                  onPeriodChange: handleHistoryPeriodChange,
                  onDateChange: handleHistoryDateChange,
                  onGroupingChange: setHistoryGrouping,
                  onVehicleChange: setHistoryVehicleId,
                }}
                summary={financialSummary}
                insights={financialInsights}
                history={financialHistory}
                isSummaryLoading={isDashboardLoading}
                isInsightsLoading={isFinancialInsightsLoading}
                isHistoryLoading={isFinancialHistoryLoading}
                summaryError={dashboardError}
                insightsError={financialInsightsError}
                historyError={financialHistoryError}
                onHistoryRetry={() => void loadFinancialHistory()}
                getVehicleLabel={getVehicleLabel}
                getExpenseCategoryLabel={getExpenseCategoryLabel}
              />
            ) : null}
            <section className="manager-section" id="mais">
              <CsvImportSection
                type="work_sessions"
                token={token}
                vehicles={vehicles}
                getAuthHeaders={getAuthHeaders}
                getVehicleLabel={getVehicleLabel}
                getExpenseCategoryLabel={getExpenseCategoryLabel}
                endSession={endSession}
                setMessage={setMessage}
                setSuccessMessage={setSuccessMessage}
                loadWorkSessions={loadWorkSessions}
                loadExpenses={loadExpenses}
                refreshDashboardData={refreshDashboardData}
              />
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

            <section className="manager-section" id="custos">
              <CsvImportSection
                type="expenses"
                token={token}
                vehicles={vehicles}
                getAuthHeaders={getAuthHeaders}
                getVehicleLabel={getVehicleLabel}
                getExpenseCategoryLabel={getExpenseCategoryLabel}
                endSession={endSession}
                setMessage={setMessage}
                setSuccessMessage={setSuccessMessage}
                loadWorkSessions={loadWorkSessions}
                loadExpenses={loadExpenses}
                refreshDashboardData={refreshDashboardData}
              />
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
                  Despesas recorrentes entram nas projeções do GanhoCerto, mas não são registradas
                  automaticamente como despesas já pagas.
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

            <VehiclesSection
              ref={vehiclesSectionRef}
              vehicles={vehicles}
              pendingQuickStartAction={pendingQuickStartAction}
              isVehiclesLoading={isVehiclesLoading}
              getAuthHeaders={getAuthHeaders}
              endSession={endSession}
              setMessage={setMessage}
              setSuccessMessage={setSuccessMessage}
              loadVehicles={() => loadVehicles()}
              loadWorkSessions={() => loadWorkSessions()}
              loadExpenses={() => loadExpenses()}
              refreshDashboardData={() => refreshDashboardData()}
              onVehicleCreated={handleVehicleCreated}
            />
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
