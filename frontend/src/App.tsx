import { FeedbackMessage } from "./components/FeedbackMessage";
import { DashboardStart } from "./features/home/DashboardStart";
import { TodaySummary } from "./features/home/TodaySummary";
import { useTodaySummary } from "./features/home/useTodaySummary";
import { selectTodayGoal } from "./features/home/todayGoal";
import { DashboardNavigation, useDashboardNavigation } from "./features/navigation/DashboardNavigation";
import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { getAccountPlan, type AccountPlanResponse } from "./api/account";
import { createBillingCheckout } from "./api/billing";
import { NETWORK_ERROR_MESSAGE, requestApi } from "./api/client";
import { createBetaFeedback, type BetaFeedbackCategory } from "./api/feedback";
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
import { LazyCsvImportSection as CsvImportSection } from "./features/imports/LazyCsvImportSection";
import { ChangePasswordForm } from "./features/auth/ChangePasswordForm";
import { ForgotPasswordForm } from "./features/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "./features/auth/ResetPasswordForm";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AccountPlanPanel } from "./features/account/AccountPlanPanel";
import { getGoalUpdatedAfterWorkMessage } from "./features/goals/goalMessages";
import { FinancialGoalsSection } from "./features/goals/FinancialGoalsSection";
import {
  VehiclesSection,
  type VehiclesSectionHandle,
} from "./features/vehicles/VehiclesSection";
import type {
  AuthMode,
  DashboardPeriod,
  Expense,
  ExpenseCategory,
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
import { createLatestRequest } from "./utils/latestRequest";
import { getBetaActivationNextStep } from "./utils/activation";
import { getDefaultHistoryGrouping, getHistoryPeriodDates, toDateInputValue } from "./utils/dates";
import { getDailyEntryDate, getDefaultDailyVehicleId, readLastDailyVehicle, writeLastDailyVehicle } from "./utils/dailyEntry";
import { useFormValidation } from "./utils/formValidation";
import {
  formatDate,
  formatDistance,
  formatWorkTime,
} from "./utils/formatters";
import {
  formatMoney,
  formatMoneyPerKm,
  formatOptionalMoneyForInput,
  moneyInputToApi,
  moneyInputToCents,
  normalizeDecimalInput,
  optionalDecimalInputToApi,
  optionalMoneyInputToApi,
  parseNonNegativeDecimal,
} from "./utils/money";
import { formatDurationInput, parseDurationToMinutes } from "./utils/duration";
import { ErrorMessage } from "./components/ErrorMessage";

const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";
const RESET_PASSWORD_PATH = "/reset-password";

const ResultSection = lazy(() =>
  import("./features/result/ResultSection").then((module) => ({
    default: module.ResultSection,
  })),
);

type WorkSessionForm = {
  work_date: string;
  vehicle_id: string;
  gross_revenue: string;
  distance_km: string;
  worked_duration: string;
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
  worked_duration: string;
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
  worked_duration: string;
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

type SubmitLockKey =
  | "auth"
  | "feedback"
  | "quickDailyEntry"
  | "dailyExpense"
  | "quickStartRegister"
  | "workSession"
  | "expense";

function getResetPasswordTokenFromUrl(): string {
  if (window.location.pathname !== RESET_PASSWORD_PATH) {
    return "";
  }

  return new URLSearchParams(window.location.search).get("token") ?? "";
}

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
  worked_duration: "",
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
  worked_duration: "",
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
  worked_duration: "",
  trip_count: "",
  vehicle_id: "",
  work_date: "",
};

const feedbackCategoryOptions: Array<{ label: string; value: BetaFeedbackCategory }> = [
  { label: "Algo confuso", value: "confusing" },
  { label: "Problema", value: "bug" },
  { label: "Ideia", value: "idea" },
  { label: "Outro", value: "other" },
];

function getExpenseCategoryLabel(value: ExpenseCategory): string {
  return expenseCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

function getRecurringFrequencyLabel(value: RecurringExpenseFrequency): string {
  return recurringFrequencyOptions.find((option) => option.value === value)?.label ?? value;
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
  const [isResetPasswordRoute, setIsResetPasswordRoute] = useState(
    () => window.location.pathname === RESET_PASSWORD_PATH,
  );
  const [resetPasswordToken, setResetPasswordToken] = useState(getResetPasswordTokenFromUrl);
  const [user, setUser] = useState<User | null>(null);
  const { activeArea, target: navigationTarget, navigateTo, handleNavigationClick } = useDashboardNavigation(user !== null);
  const todaySummary = useTodaySummary(user ? token : null, endSession);
  const [coreReady, setCoreReady] = useState(false);
  const [hasOpenedResult, setHasOpenedResult] = useState(false);
  const [financialRevision, setFinancialRevision] = useState(0);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [workSessionsLoaded, setWorkSessionsLoaded] = useState(false);
  const [workSessionsError, setWorkSessionsError] = useState("");
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
  const [accountPlan, setAccountPlan] = useState<AccountPlanResponse | null>(null);
  const [workSessionForm, setWorkSessionForm] =
    useState<WorkSessionForm>(emptyWorkSessionForm);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [recurringExpenseForm, setRecurringExpenseForm] =
    useState<RecurringExpenseForm>(emptyRecurringExpenseForm);
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
  const dailyEntryValidation = useFormValidation();
  const [quickDailyEntryResult, setQuickDailyEntryResult] =
    useState<QuickDailyEntryResult | null>(null);
  const [lastSelectedVehicleId, setLastSelectedVehicleId] = useState("");
  const [quickDailyEntryShowDate, setQuickDailyEntryShowDate] = useState(false);
  const [pendingQuickDailyEntry, setPendingQuickDailyEntry] = useState(false);
  const [dailyExpenseForm, setDailyExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const dailyExpenseValidation = useFormValidation();
  const expenseValidation = useFormValidation();
  const recurringExpenseValidation = useFormValidation();
  const maintenancePlanValidation = useFormValidation();
  const maintenanceRecordValidation = useFormValidation();
  const workSessionValidation = useFormValidation();
  const [dailyExpenseVisible, setDailyExpenseVisible] = useState(false);
  const [isChangePasswordVisible, setIsChangePasswordVisible] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const [feedbackCategory, setFeedbackCategory] =
    useState<BetaFeedbackCategory>("confusing");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [pendingQuickStartAction, setPendingQuickStartAction] = useState<
    "register" | "configure" | null
  >(null);
  const [editingWorkSessionId, setEditingWorkSessionId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingRecurringExpenseId, setEditingRecurringExpenseId] = useState<number | null>(null);
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
  const [accountPlanError, setAccountPlanError] = useState("");
  const [billingCheckoutError, setBillingCheckoutError] = useState("");
  const [billingCheckoutMessage, setBillingCheckoutMessage] = useState("");
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
  const [isAccountPlanLoading, setIsAccountPlanLoading] = useState(false);
  const [isWorkSessionSaving, setIsWorkSessionSaving] = useState(false);
  const [isExpenseSaving, setIsExpenseSaving] = useState(false);
  const [isRecurringExpenseSaving, setIsRecurringExpenseSaving] = useState(false);
  const [isMaintenanceSaving, setIsMaintenanceSaving] = useState(false);
  const [isMaintenanceRecordSaving, setIsMaintenanceRecordSaving] = useState(false);
  const [isQuickDailyEntrySaving, setIsQuickDailyEntrySaving] = useState(false);
  const [isDailyExpenseSaving, setIsDailyExpenseSaving] = useState(false);
  const [isBillingCheckoutLoading, setIsBillingCheckoutLoading] = useState(false);
  const [isFeedbackSaving, setIsFeedbackSaving] = useState(false);

  const requests = useRef({
    session: createLatestRequest(),
    vehicles: createLatestRequest(),
    workSessions: createLatestRequest(),
    expenses: createLatestRequest(),
    recurring: createLatestRequest(),
    goals: createLatestRequest(),
    maintenance: createLatestRequest(),
    account: createLatestRequest(),
    summary: createLatestRequest(),
    insights: createLatestRequest(),
    history: createLatestRequest(),
  });
  // Remember attempted loads as well as successes so errors wait for an explicit retry.
  const attempted = useRef<Partial<Record<keyof typeof requests.current, string>>>({});
  const sessionToken = useRef(token);
  sessionToken.current = token;
  const currentArea = useRef(activeArea);
  currentArea.current = activeArea;
  const revision = useRef(financialRevision);
  const query = useRef({ dashboardPeriod, customStartDate, customEndDate, dashboardVehicleId,
    historyStartDate, historyEndDate, historyGrouping, historyVehicleId });
  query.current = { dashboardPeriod, customStartDate, customEndDate, dashboardVehicleId,
    historyStartDate, historyEndDate, historyGrouping, historyVehicleId };
  const currentVehicles = useRef(vehicles);
  currentVehicles.current = vehicles;
  const currentDate = useRef(todaySummary.date);
  currentDate.current = todaySummary.date;
  const goalCache = useRef<{ date: string; goals: FinancialGoal[]; progress: Record<number, FinancialGoalProgress> } | null>(null);

  function resultRequestKey(kind: "summary" | "insights" | "history", currentToken = token) {
    const filters = query.current;
    return JSON.stringify([currentToken, revision.current, currentDate.current, kind === "history"
      ? [filters.historyStartDate, filters.historyEndDate, filters.historyGrouping, filters.historyVehicleId]
      : [filters.dashboardPeriod, filters.customStartDate, filters.customEndDate, filters.dashboardVehicleId]]);
  }

  const submitLocksRef = useRef<Partial<Record<SubmitLockKey, boolean>>>({});

  function beginSubmitLock(key: SubmitLockKey): boolean {
    if (submitLocksRef.current[key]) {
      return false;
    }

    submitLocksRef.current[key] = true;
    return true;
  }

  function releaseSubmitLock(key: SubmitLockKey) {
    submitLocksRef.current[key] = false;
  }

  function endSession(nextMessage = "") {
    sessionToken.current = null;
    Object.values(requests.current).forEach((request) => request.invalidate());
    attempted.current = {};
    goalCache.current = null;
    setCoreReady(false);
    setHasOpenedResult(false);
    setIsVehiclesLoading(false);
    setIsWorkSessionsLoading(false);
    setIsExpensesLoading(false);
    setIsRecurringExpensesLoading(false);
    setIsFinancialGoalsLoading(false);
    setIsMaintenanceLoading(false);
    setIsDashboardLoading(false);
    setIsFinancialInsightsLoading(false);
    setIsFinancialHistoryLoading(false);
    setIsAccountPlanLoading(false);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setVehicles([]);
    setLastSelectedVehicleId("");
    setWorkSessions([]);
    setWorkSessionsLoaded(false);
    setWorkSessionsError("");
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
    setAccountPlan(null);
    setEditingWorkSessionId(null);
    setEditingExpenseId(null);
    setEditingRecurringExpenseId(null);
    setEditingMaintenancePlanId(null);
    setWorkSessionForm(emptyWorkSessionForm);
    setExpenseForm(emptyExpenseForm);
    setRecurringExpenseForm(emptyRecurringExpenseForm);
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
    setIsChangePasswordVisible(false);
    setIsFeedbackVisible(false);
    setFeedbackCategory("confusing");
    setFeedbackMessage("");
    setPendingQuickStartAction(null);
    setMode("login");
    setPassword("");
    setSuccessMessage("");
    setDashboardError("");
    setFinancialInsightsError("");
    setFinancialHistoryError("");
    setAccountPlanError("");
    setBillingCheckoutError("");
    setBillingCheckoutMessage("");
    setHistoryVehicleId("");
    setMessage(nextMessage);
  }

  function getAuthHeaders(currentToken = token): Record<string, string> {
    return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
  }

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );

  function getVehicleLabel(vehicleId: number): string {
    const vehicle = vehiclesById.get(vehicleId);
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

  function rememberDailyVehicle(vehicleId: string) {
    setLastSelectedVehicleId(vehicleId);
    if (user) writeLastDailyVehicle(user.id, vehicleId);
  }

  async function loadVehicles(currentToken = token, accountId = user?.id, refresh = false) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (refresh) requests.current.vehicles.invalidate();
    const key = currentToken;
    attempted.current.vehicles = key;
    await requests.current.vehicles.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken;
      if (!isCurrent()) return;
      setIsVehiclesLoading(true);
      try {
        const nextVehicles = await listVehicles(getAuthHeaders(currentToken));
        if (!isCurrent()) return;
        currentVehicles.current = nextVehicles;
        setVehicles(nextVehicles);
        const availableVehicleIds = nextVehicles.map((vehicle) => vehicle.id);
        const defaultVehicleId = getDefaultDailyVehicleId(
          availableVehicleIds,
          "",
          (accountId === user?.id ? lastSelectedVehicleId : "") ||
            (accountId === undefined ? "" : readLastDailyVehicle(accountId)),
        );
        setLastSelectedVehicleId(defaultVehicleId);
        setWorkSessionForm((currentForm) => ({
          ...currentForm,
          vehicle_id: getDefaultDailyVehicleId(
            availableVehicleIds,
            currentForm.vehicle_id,
            defaultVehicleId,
          ),
        }));
        setQuickDailyEntryForm((currentForm) => ({
          ...currentForm,
          vehicle_id: getDefaultDailyVehicleId(
            availableVehicleIds,
            currentForm.vehicle_id,
            defaultVehicleId,
          ),
        }));
        setDailyExpenseForm((currentForm) => ({
          ...currentForm,
          vehicle_id: getDefaultDailyVehicleId(
            availableVehicleIds,
            currentForm.vehicle_id,
            defaultVehicleId,
          ),
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
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(error instanceof Error ? error.message : "Erro ao carregar veiculos.");
        }
      } finally {
        if (isCurrent()) setIsVehiclesLoading(false);
      }
    });
  }

  async function loadAccountPlan(currentToken = token) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "mais") {
      delete attempted.current.account;
      requests.current.account.invalidate();
      return;
    }
    const key = currentToken;
    attempted.current.account = key;
    await requests.current.account.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken;
      if (!isCurrent()) return;
      setIsAccountPlanLoading(true);
      setAccountPlanError("");
      try {
        const nextAccountPlan = await getAccountPlan(getAuthHeaders(currentToken));
        if (!isCurrent()) return;
        setAccountPlan(nextAccountPlan);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setAccountPlan(null);
          setAccountPlanError(
            error instanceof Error ? error.message : "Nao foi possivel carregar seu plano.",
          );
        }
      } finally {
        if (isCurrent()) setIsAccountPlanLoading(false);
      }
    });
  }

  async function handleCheckoutPro() {
    if (!token) {
      return;
    }

    setIsBillingCheckoutLoading(true);
    setBillingCheckoutError("");
    setBillingCheckoutMessage("Redirecionando para pagamento...");
    try {
      const checkout = await createBillingCheckout(getAuthHeaders(token));
      window.location.assign(checkout.checkout_url);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setBillingCheckoutMessage("");
        setBillingCheckoutError(
          error instanceof Error ? error.message : "Nao foi possivel iniciar a assinatura.",
        );
      }
    } finally {
      setIsBillingCheckoutLoading(false);
    }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (!beginSubmitLock("feedback")) {
      return;
    }

    setIsFeedbackSaving(true);
    setMessage("");
    setSuccessMessage("");
    try {
      await createBetaFeedback(getAuthHeaders(token), {
        category: feedbackCategory,
        message: feedbackMessage,
        path: `${window.location.pathname}${window.location.hash}`,
      });
      setFeedbackMessage("");
      setIsFeedbackVisible(false);
      setSuccessMessage("Obrigado. Seu feedback foi enviado para a beta.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar feedback.");
      }
    } finally {
      setIsFeedbackSaving(false);
      releaseSubmitLock("feedback");
    }
  }

  async function loadWorkSessions(currentToken = token, refresh = false) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (refresh) requests.current.workSessions.invalidate();
    const key = currentToken;
    attempted.current.workSessions = key;
    await requests.current.workSessions.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken;
      if (!isCurrent()) return;
      setIsWorkSessionsLoading(true);
      setWorkSessionsError("");
      try {
        const nextWorkSessions = await requestApi<WorkSession[]>("/work-sessions", {
          headers: getAuthHeaders(currentToken),
        });
        if (!isCurrent()) return;
        setWorkSessions(nextWorkSessions);
        setWorkSessionsLoaded(true);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          const errorMessage = error instanceof Error ? error.message : "Erro ao carregar jornadas.";
          setWorkSessionsError(errorMessage);
          setMessage(errorMessage);
        }
      } finally {
        if (isCurrent()) setIsWorkSessionsLoading(false);
      }
    });
  }

  async function loadExpenses(currentToken = token, refresh = false) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "custos") {
      delete attempted.current.expenses;
      requests.current.expenses.invalidate();
      return;
    }
    if (refresh) requests.current.expenses.invalidate();
    const key = currentToken;
    attempted.current.expenses = key;
    await requests.current.expenses.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken;
      if (!isCurrent()) return;
      setIsExpensesLoading(true);
      try {
        const nextExpenses = await listExpenses(getAuthHeaders(currentToken));
        if (!isCurrent()) return;
        setExpenses(nextExpenses);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(error instanceof Error ? error.message : "Erro ao carregar despesas.");
        }
      } finally {
        if (isCurrent()) setIsExpensesLoading(false);
      }
    });
  }

  async function loadRecurringExpenses(currentToken = token, refresh = false) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "custos") {
      delete attempted.current.recurring;
      requests.current.recurring.invalidate();
      return;
    }
    if (refresh) requests.current.recurring.invalidate();
    const key = currentToken;
    attempted.current.recurring = key;
    await requests.current.recurring.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken;
      if (!isCurrent()) return;
      setIsRecurringExpensesLoading(true);
      try {
        const nextRecurringExpenses = await listRecurringExpenses(getAuthHeaders(currentToken));
        if (!isCurrent()) return;
        setRecurringExpenses(nextRecurringExpenses);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(
            error instanceof Error ? error.message : "Erro ao carregar despesas recorrentes.",
          );
        }
      } finally {
        if (isCurrent()) setIsRecurringExpensesLoading(false);
      }
    });
  }

  function goalRequestKey(currentToken = token) {
    return JSON.stringify([currentToken, currentDate.current, revision.current,
      currentArea.current === "resultado" ? "all" : currentVehicles.current.map((vehicle) => vehicle.id)]);
  }

  async function loadFinancialGoals(currentToken = token, refresh = true) {
    if (!currentToken || sessionToken.current !== currentToken) return;
    if (refresh || (goalCache.current && goalCache.current.date !== currentDate.current)) {
      goalCache.current = null;
      requests.current.goals.invalidate();
    }
    const date = currentDate.current;
    const key = goalRequestKey(currentToken);
    attempted.current.goals = key;
    await requests.current.goals.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken && currentDate.current === date;
      if (!isCurrent()) return;
      setIsFinancialGoalsLoading(true);
      try {
        const goals = goalCache.current?.goals ?? await requestApi<FinancialGoal[]>("/financial-goals", {
          headers: getAuthHeaders(currentToken),
        });
        if (!isCurrent()) return;
        const progress = { ...goalCache.current?.progress };
        const selected = selectTodayGoal(goals, date, currentVehicles.current.map((vehicle) => vehicle.id));
        const needed = currentArea.current === "resultado" ? goals : selected ? [selected] : [];
        const entries = await Promise.all(needed.filter((goal) => !progress[goal.id]).map(async (goal) => {
          const value = await requestApi<FinancialGoalProgress>(`/financial-goals/${goal.id}/progress`, {
            headers: getAuthHeaders(currentToken),
          });
          return [goal.id, value] as const;
        }));
        if (!isCurrent()) return;
        Object.assign(progress, Object.fromEntries(entries));
        goalCache.current = { date, goals, progress };
        setFinancialGoals(goals);
        setFinancialGoalProgressById(progress);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) endSession(error.message);
        else {
          setFinancialGoalProgressById({});
          setMessage(error instanceof Error ? error.message : "Erro ao carregar metas.");
        }
      } finally {
        if (isLatest() && sessionToken.current === currentToken) setIsFinancialGoalsLoading(false);
      }
    });
  }

  async function loadMaintenancePlans(currentToken = token, refresh = false) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "custos") {
      delete attempted.current.maintenance;
      requests.current.maintenance.invalidate();
      return;
    }
    if (refresh) requests.current.maintenance.invalidate();
    const key = currentToken;
    attempted.current.maintenance = key;
    await requests.current.maintenance.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken;
      if (!isCurrent()) return;
      setIsMaintenanceLoading(true);
      try {
        const nextPlans = await requestApi<MaintenancePlan[]>("/maintenance-plans", {
          headers: getAuthHeaders(currentToken),
        });
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
        setMaintenancePlans(nextPlans);
        setMaintenanceStatusesById(Object.fromEntries(statusEntries));
        setMaintenanceRecordsByPlanId(Object.fromEntries(recordEntries));
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(error instanceof Error ? error.message : "Erro ao carregar manutencoes.");
        }
      } finally {
        if (isCurrent()) setIsMaintenanceLoading(false);
      }
    });
  }

  async function loadFinancialSummary(currentToken = token) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "resultado") {
      delete attempted.current.summary;
      requests.current.summary.invalidate();
      return;
    }
    const key = resultRequestKey("summary", currentToken);
    attempted.current.summary = key;
    await requests.current.summary.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken && key === resultRequestKey("summary", currentToken);
      if (!isCurrent()) return;
      const filters = { ...query.current };
      setIsDashboardLoading(true);
      setDashboardError("");
      try {
        const summary = await getFinancialSummary(getAuthHeaders(currentToken), {
          period: filters.dashboardPeriod,
          customStartDate: filters.customStartDate,
          customEndDate: filters.customEndDate,
          vehicleId: filters.dashboardVehicleId,
        });
        if (!isCurrent()) return;
        setFinancialSummary(summary);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setFinancialSummary(null);
          setDashboardError(
            error instanceof Error ? error.message : "Erro ao carregar resumo financeiro.",
          );
        }
      } finally {
        if (isCurrent()) setIsDashboardLoading(false);
      }
    });
  }

  async function loadFinancialInsights(currentToken = token) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "resultado") {
      delete attempted.current.insights;
      requests.current.insights.invalidate();
      return;
    }
    const key = resultRequestKey("insights", currentToken);
    attempted.current.insights = key;
    await requests.current.insights.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken && key === resultRequestKey("insights", currentToken);
      if (!isCurrent()) return;
      const filters = { ...query.current };
      setIsFinancialInsightsLoading(true);
      setFinancialInsightsError("");
      try {
        const response = await getFinancialInsights(getAuthHeaders(currentToken), {
          period: filters.dashboardPeriod,
          customStartDate: filters.customStartDate,
          customEndDate: filters.customEndDate,
          vehicleId: filters.dashboardVehicleId,
        });
        if (!isCurrent()) return;
        setFinancialInsights(response.insights);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setFinancialInsights([]);
          setFinancialInsightsError(
            error instanceof Error ? error.message : "Nao foi possivel carregar os insights agora.",
          );
        }
      } finally {
        if (isCurrent()) setIsFinancialInsightsLoading(false);
      }
    });
  }

  async function loadFinancialHistory(currentToken = token) {
    if (!currentToken || sessionToken.current !== currentToken) {
      return;
    }

    if (currentArea.current !== "resultado") {
      delete attempted.current.history;
      requests.current.history.invalidate();
      return;
    }
    const key = resultRequestKey("history", currentToken);
    attempted.current.history = key;
    await requests.current.history.run(key, async (isLatest) => {
      const isCurrent = () => isLatest() && sessionToken.current === currentToken && key === resultRequestKey("history", currentToken);
      if (!isCurrent()) return;
      const filters = { ...query.current };
      setIsFinancialHistoryLoading(true);
      setFinancialHistoryError("");
      try {
        const history = await getFinancialHistory(getAuthHeaders(currentToken), {
          startDate: filters.historyStartDate,
          endDate: filters.historyEndDate,
          grouping: filters.historyGrouping,
          vehicleId: filters.historyVehicleId,
        });
        if (!isCurrent()) return;
        setFinancialHistory(history);
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setFinancialHistory(null);
          setFinancialHistoryError(
            error instanceof Error ? error.message : "Nao foi possivel carregar sua evolucao agora.",
          );
        }
      } finally {
        if (isCurrent()) setIsFinancialHistoryLoading(false);
      }
    });
  }

  async function refreshDashboardData(currentToken = token) {
    if (!currentToken || sessionToken.current !== currentToken) return;
    // Hidden areas refresh on their next visit; pending pre-save responses are obsolete.
    revision.current += 1;
    setFinancialRevision(revision.current);
    setMaintenanceStatusesById({});
    for (const kind of ["summary", "insights", "history", "maintenance"] as const) {
      requests.current[kind].invalidate();
      delete attempted.current[kind];
    }
    await Promise.all([
      todaySummary.reload(),
      loadFinancialGoals(currentToken),
      ...(currentArea.current === "resultado" ? [loadFinancialSummary(currentToken),
        loadFinancialInsights(currentToken), loadFinancialHistory(currentToken)] : []),
      ...(currentArea.current === "custos" ? [loadMaintenancePlans(currentToken)] : []),
    ]);
  }

  useEffect(() => {
    if (isResetPasswordRoute) {
      setUser(null);
      return;
    }

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
      setAccountPlan(null);
      setFinancialHistoryError("");
      setAccountPlanError("");
      setBillingCheckoutError("");
      setBillingCheckoutMessage("");
      setMaintenancePlanForm(emptyMaintenancePlanForm);
      setMaintenanceRecordForm(emptyMaintenanceRecordForm);
      setRecordingMaintenancePlanId(null);
      setEditingMaintenancePlanId(null);
      return;
    }

    let disposed = false;
    void Promise.resolve().then(async () => {
      if (disposed) return;
      await requests.current.session.run(token, async (isLatest) => {
        const isCurrent = () => !disposed && isLatest() && sessionToken.current === token;
        try {
          const currentUser = await requestApi<User>("/auth/me", { headers: getAuthHeaders(token) });
          if (!isCurrent()) return;
          setUser(currentUser);
          setMessage("");
          await Promise.all([loadVehicles(token, currentUser.id), loadWorkSessions(token)]);
          if (isCurrent()) setCoreReady(true);
        } catch (error) {
          if (!isCurrent()) return;
          if (error instanceof Error && error.message.includes("Sessao")) endSession(error.message);
          else {
            setUser(null);
            setMessage(error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE);
          }
        }
      });
    });
    return () => {
      disposed = true;
      Object.values(requests.current).forEach((request) => request.invalidate());
    };
  }, [token, isResetPasswordRoute]);

  useEffect(() => {
    if (!token || isResetPasswordRoute) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const billingStatus = searchParams.get("billing");
    if (!billingStatus) {
      return;
    }

    if (billingStatus === "success") {
      setBillingCheckoutMessage(
        "Pagamento enviado. O acesso Pro sera liberado apos a confirmacao do pagamento.",
      );
      setBillingCheckoutError("");
    } else if (billingStatus === "cancel") {
      setBillingCheckoutMessage("");
      setBillingCheckoutError("Assinatura nao concluida. Voce pode tentar novamente quando quiser.");
    }

    searchParams.delete("billing");
    const nextSearch = searchParams.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
    );
  }, [token, isResetPasswordRoute]);

  useEffect(() => {
    if (!token || !user || !coreReady) return;
    if (activeArea === "resultado") {
      setHasOpenedResult(true);
      if (workSessions.length > 0) {
        if (attempted.current.summary !== resultRequestKey("summary")) void loadFinancialSummary();
        if (attempted.current.insights !== resultRequestKey("insights")) void loadFinancialInsights();
        if (attempted.current.history !== resultRequestKey("history")) void loadFinancialHistory();
      }
    }
    if (activeArea === "custos") {
      if (!attempted.current.expenses) void loadExpenses();
      if (!attempted.current.recurring) void loadRecurringExpenses();
      if (!attempted.current.maintenance) void loadMaintenancePlans();
    }
    if (activeArea === "mais" && !attempted.current.account) void loadAccountPlan();
  }, [token, user?.id, coreReady, activeArea, dashboardPeriod, dashboardVehicleId, customStartDate,
    customEndDate, historyStartDate, historyEndDate, historyGrouping, historyVehicleId, financialRevision,
    todaySummary.date, workSessions.length]);

  useEffect(() => {
    if (!token || !user || !coreReady || isFinancialGoalsLoading) return;
    if (attempted.current.goals !== goalRequestKey()) void loadFinancialGoals(token, false);
  }, [token, user?.id, coreReady, activeArea, todaySummary.date, financialRevision, isFinancialGoalsLoading, vehicles]);

  function resetForm(nextMode: AuthMode) {
    setMode(nextMode);
    setName("");
    setEmail("");
    setPassword("");
    setMessage("");
    setSuccessMessage("");
  }

  async function recordFirstResultViewed() {
    try {
      await requestApi<void>("/product-events/first-result-viewed", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch {
      // The next visit can retry this passive measurement.
    }
  }

  function handleBackToLogin(nextSuccessMessage = "") {
    window.history.replaceState(null, "", "/");
    setIsResetPasswordRoute(false);
    setResetPasswordToken("");
    setMode("login");
    setName("");
    setPassword("");
    setMessage("");
    setSuccessMessage(nextSuccessMessage);
  }

  function handleRequestNewResetLink() {
    window.history.replaceState(null, "", "/");
    setIsResetPasswordRoute(false);
    setResetPasswordToken("");
    setMode("forgot-password");
    setMessage("");
    setSuccessMessage("");
  }

  function handleResetComplete() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    window.history.replaceState(null, "", RESET_PASSWORD_PATH);
    setResetPasswordToken("");
  }

  function handlePasswordChanged(nextMessage: string) {
    endSession(nextMessage);
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
    if (!beginSubmitLock("auth")) {
      return;
    }

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
      releaseSubmitLock("auth");
    }
  }

  function handleLogout() {
    endSession();
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
    return parseDurationToMinutes(quickStartForm.worked_duration);
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
    return parseDurationToMinutes(quickDailyEntryForm.worked_duration);
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
      workDate: getDailyEntryDate(quickDailyEntryForm.work_date),
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
    rememberDailyVehicle(String(vehicle.id));
    setQuickDailyEntryResult(result);
    setDailyExpenseForm({
      ...emptyExpenseForm,
      expense_date: result.workDate,
      vehicle_id: String(vehicle.id),
    });
    setDailyExpenseVisible(false);
    setQuickDailyEntryForm({
      ...emptyQuickDailyEntryForm,
      vehicle_id: String(vehicle.id),
    });
    setQuickDailyEntryShowDate(false);
    await loadWorkSessions(token, true);
    await refreshDashboardData();
    setSuccessMessage(getGoalUpdatedAfterWorkMessage(financialGoals.some((goal) => goal.active)));
    navigateTo("daily-entry-result");
  }

  async function handleQuickDailyEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginSubmitLock("quickDailyEntry")) {
      return;
    }

    setIsQuickDailyEntrySaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      getQuickDailyWorkedMinutes();
      const vehicle = getQuickDailyVehicle();
      if (!vehicle) {
        setQuickDailyEntryForm((current) => ({ ...current, work_date: getDailyEntryDate(current.work_date) }));
        setPendingQuickDailyEntry(true);
        setMessage(
          "Dados mantidos. Cadastre seu veiculo para salvar este dia e ver quanto sobrou.",
        );
        navigateTo("veiculos");
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
      releaseSubmitLock("quickDailyEntry");
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

    navigateTo("resultado");
  }

  function openDailyExpenseShortcut(result?: QuickDailyEntryResult) {
    const vehicle = result?.vehicle ?? getQuickDailyVehicle();
    const expenseDate = result?.workDate ?? todaySummary.date;

    if (!dailyExpenseVisible || dailyExpenseForm.expense_date !== expenseDate) {
      setDailyExpenseForm({
        ...emptyExpenseForm,
        expense_date: expenseDate,
        vehicle_id: vehicle ? String(vehicle.id) : "",
      });
    }
    setDailyExpenseVisible(true);
    navigateTo("daily-expense-form");
  }

  async function handleDailyExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginSubmitLock("dailyExpense")) {
      return;
    }

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
      setSuccessMessage(`Gasto de ${formatDate(dailyExpenseForm.expense_date)} adicionado com sucesso.`);
      await loadExpenses(token, true);
      await refreshDashboardData();
      navigateTo(hasWorkdays ? "today-summary" : "hoje");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o gasto.");
      }
    } finally {
      setIsDailyExpenseSaving(false);
      releaseSubmitLock("dailyExpense");
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
      navigateTo("veiculos");
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
    navigateTo("veiculos");
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
    await loadWorkSessions(token, true);
    await loadExpenses(token, true);
    await refreshDashboardData();
    navigateTo("lista-jornadas");
  }

  async function handleQuickStartRegister() {
    if (!quickStartResult) {
      return;
    }
    if (!beginSubmitLock("quickStartRegister")) {
      return;
    }

    setMessage("");
    setSuccessMessage("");
    if (!vehicles[0]) {
      setPendingQuickStartAction("register");
      releaseSubmitLock("quickStartRegister");
      setMessage("Cadastre seu veículo para registrar o dia. Seus dados da simulação foram mantidos.");
      navigateTo("veiculos");
      return;
    }

    try {
      await registerQuickStartDay(vehicles[0]);
      releaseSubmitLock("quickStartRegister");
    } catch (error) {
      releaseSubmitLock("quickStartRegister");
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
      work_date: toDateInputValue(new Date()),
      vehicle_id: getDefaultDailyVehicleId(vehicles.map((vehicle) => vehicle.id), workSessionForm.vehicle_id, lastSelectedVehicleId),
    });
  }

  function handleEditWorkSession(workSession: WorkSession) {
    setEditingWorkSessionId(workSession.id);
    setWorkSessionForm({
      work_date: workSession.work_date,
      vehicle_id: String(workSession.vehicle_id),
      gross_revenue: formatMoney(workSession.gross_revenue).replace("R$ ", ""),
      distance_km: formatDistance(workSession.distance_km),
      worked_duration: formatDurationInput(workSession.worked_minutes),
      trip_count: String(workSession.trip_count),
    });
    rememberDailyVehicle(String(workSession.vehicle_id));
    setMessage("");
    setSuccessMessage("");
  }

  async function handleWorkSessionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginSubmitLock("workSession")) {
      return;
    }

    setIsWorkSessionSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        vehicle_id: Number(workSessionForm.vehicle_id),
        work_date: workSessionForm.work_date,
        gross_revenue: moneyInputToApi(workSessionForm.gross_revenue),
        distance_km: normalizeDecimalInput(workSessionForm.distance_km),
        worked_minutes: parseDurationToMinutes(workSessionForm.worked_duration),
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

      rememberDailyVehicle(workSessionForm.vehicle_id);
      resetWorkSessionForm();
      await loadWorkSessions(token, true);
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar jornada.");
      }
    } finally {
      setIsWorkSessionSaving(false);
      releaseSubmitLock("workSession");
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
      await loadWorkSessions(token, true);
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
    if (!beginSubmitLock("expense")) {
      return;
    }

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
      await loadExpenses(token, true);
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar despesa.");
      }
    } finally {
      setIsExpenseSaving(false);
      releaseSubmitLock("expense");
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
      await loadExpenses(token, true);
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
      await loadRecurringExpenses(token, true);
      await refreshDashboardData();
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
      await loadRecurringExpenses(token, true);
      await refreshDashboardData();
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
      await loadRecurringExpenses(token, true);
      await refreshDashboardData();
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
      await loadMaintenancePlans(token, true);
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
      await loadMaintenancePlans(token, true);
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
      await loadMaintenancePlans(token, true);
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

  const maintenancePlansByStatus = useMemo(() => {
    const groups: Record<MaintenanceStatusType, MaintenancePlan[]> = {
      due: [],
      due_soon: [],
      ok: [],
    };
    for (const plan of maintenancePlans) {
      const status = maintenanceStatusesById[plan.id]?.status;
      if (status) groups[status].push(plan);
    }
    return groups;
  }, [maintenancePlans, maintenanceStatusesById]);

  function getPrimaryMaintenanceAlert(): { plan: MaintenancePlan; status: MaintenancePlanStatus } | null {
    for (const plan of maintenancePlans) {
      const status = maintenanceStatusesById[plan.id];
      if (plan.active && status && (status.status === "due" || status.status === "due_soon")) {
        return { plan, status };
      }
    }

    return null;
  }

  const isQuickStartVisible = (workSessionsLoaded && workSessions.length === 0) || quickStartVisible ||
    (activeArea === "hoje" && window.location.hash === "#quick-start");
  const hasWorkdays = workSessions.length > 0;
  const isDailyEntryVisible = navigationTarget === "daily-revenue" || (workSessionsLoaded && !hasWorkdays);
  const isDailyExpenseVisible = navigationTarget === "daily-expense-form";
  const todayGoal = selectTodayGoal(financialGoals, todaySummary.date, vehicles.map((vehicle) => vehicle.id));
  const todayGoalProgress = todayGoal ? financialGoalProgressById[todayGoal.id] : null;
  const maintenanceAlert = getPrimaryMaintenanceAlert();
  const shouldShowCostPrecisionPrompt =
    vehicles.length > 0 &&
    !isDashboardLoading &&
    financialSummary !== null &&
    !isPositiveMoney(financialSummary.estimated_structural_costs);
  const betaNextStep = getBetaActivationNextStep({
    vehicleCount: vehicles.length,
    workSessionCount: workSessions.length,
  });

  if (!user && !isResetPasswordRoute && mode !== "forgot-password") {
    return (
      <AuthScreen
        mode={mode as "login" | "register"}
        setMode={(m) => {
          setMode(m);
          setMessage("");
          setSuccessMessage("");
        }}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        isLoading={isLoading}
        message={message}
        successMessage={successMessage}
        onSubmit={handleSubmit}
        onForgotPassword={() => {
          setMode("forgot-password");
          setMessage("");
          setSuccessMessage("");
          setPassword("");
        }}
      />
    );
  }

  return (
    <main className={user ? "page page-dashboard" : "page"}>
      {!user ? (
        <section className="intro" aria-labelledby="page-title">
          <p className="brand">GanhoCerto</p>
          <h1 id="page-title">Seu faturamento não é seu lucro.</h1>
          <p className="subtitle">Descubra quanto você realmente ganha dirigindo.</p>
        </section>
      ) : null}

      <section className={user ? "auth-panel vehicle-panel" : "auth-panel"}>
        {user ? (
          <div className="session" onClick={handleNavigationClick}>
            <div className="session-header">
              <div>
                <p className="eyebrow">GanhoCerto</p>
                <h1 className="dashboard-greeting">Olá, {user.name}.</h1>
              </div>
              <a className="button button-ghost" href="#conta">Minha conta</a>
            </div>

            {message ? <FeedbackMessage kind="error">{message}</FeedbackMessage> : null}
            {successMessage ? <FeedbackMessage kind="success">{successMessage}</FeedbackMessage> : null}

            <DashboardNavigation activeArea={activeArea} />

            <section className="dashboard-area" id="area-hoje" aria-label="Hoje" hidden={activeArea !== "hoje"} tabIndex={-1}>
              {hasWorkdays ? (
                <TodaySummary
                  date={todaySummary.date}
                  daily={todaySummary.daily}
                  isLoading={todaySummary.isLoading}
                  error={todaySummary.error}
                  onRetry={() => void todaySummary.reload()}
                  onRegister={() => navigateTo("daily-revenue")}
                  onAddExpense={() => openDailyExpenseShortcut()}
                  isRegisterOpen={isDailyEntryVisible}
                  isExpenseOpen={isDailyExpenseVisible}
                  isGoalLoading={isFinancialGoalsLoading}
                  goal={todayGoal && todayGoalProgress ? {
                    goal: todayGoal,
                    progress: todayGoalProgress,
                    vehicleLabel: todayGoal.vehicle_id === null ? null : getVehicleLabel(todayGoal.vehicle_id),
                  } : null}
                />
              ) : workSessionsError ? (
                <div>
                  <FeedbackMessage kind="error">{workSessionsError}</FeedbackMessage>
                  <button className="text-button" type="button" onClick={() => void loadWorkSessions()}>Tentar novamente</button>
                </div>
              ) : (
                <DashboardStart
                  nextStep={betaNextStep}
                  hasWorkdays={false}
                  isLoading={!workSessionsLoaded || isVehiclesLoading || isWorkSessionsLoading}
                  onRegister={() => navigateTo("daily-revenue")}
                />
              )}

              <section className="daily-entry" id="daily-entry-panel" hidden={!isDailyEntryVisible}>
                <div className="section-title">
                  <h2>Registro do dia</h2>
                  <p className="subtle-note">
                    Preencha os valores do seu trabalho. Os gastos podem ser adicionados depois.
                  </p>
                </div>

                <div className="daily-entry-tools" aria-label="Outras ações do dia">
                  <button className="text-button" type="button" onClick={() => openDailyExpenseShortcut()}>
                    Adicionar gasto
                  </button>
                  {workSessions.length === 0 ? (
                    vehicles.length === 0 ? (
                      <a href="#veiculos">Cadastrar veículo</a>
                    ) : (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setQuickStartVisible(true);
                          navigateTo("quick-start");
                        }}
                      >
                        Simular sem salvar
                      </button>
                    )
                  ) : null}
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

                  <form className="auth-form daily-entry-form" onInvalid={dailyEntryValidation.handleInvalid} onSubmit={handleQuickDailyEntrySubmit}>
                    <div className="daily-date-row">
                      <p>Data: {formatDate(getDailyEntryDate(quickDailyEntryForm.work_date))}</p>
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
                          name="work_date"
                          onChange={(event) => {
                            dailyEntryValidation.clearError("work_date");
                            setQuickDailyEntryForm({
                              ...quickDailyEntryForm,
                              work_date: event.target.value,
                            });
                          }}
                          type="date"
                          value={getDailyEntryDate(quickDailyEntryForm.work_date)}
                          aria-invalid={!!dailyEntryValidation.errors.work_date}
                          aria-describedby={dailyEntryValidation.errors.work_date ? "daily-entry-work_date-error" : undefined}
                        />
                        <ErrorMessage id="daily-entry-work_date-error" message={dailyEntryValidation.errors.work_date} />
                      </label>
                    ) : null}

                    <label>
                      Faturamento
                      <input
                        id="daily-revenue"
                        name="gross_revenue"
                        inputMode="decimal"
                        onChange={(event) => {
                          dailyEntryValidation.clearError("gross_revenue");
                          setQuickDailyEntryForm({
                            ...quickDailyEntryForm,
                            gross_revenue: event.target.value,
                          });
                        }}
                        placeholder="250,50"
                        required
                        type="text"
                        value={quickDailyEntryForm.gross_revenue}
                        aria-invalid={!!dailyEntryValidation.errors.gross_revenue}
                        aria-describedby={dailyEntryValidation.errors.gross_revenue ? "daily-entry-gross_revenue-error" : undefined}
                      />
                      <ErrorMessage id="daily-entry-gross_revenue-error" message={dailyEntryValidation.errors.gross_revenue} />
                    </label>

                    <label>
                      Km rodados
                      <input
                        name="distance_km"
                        inputMode="decimal"
                        onChange={(event) => {
                          dailyEntryValidation.clearError("distance_km");
                          setQuickDailyEntryForm({
                            ...quickDailyEntryForm,
                            distance_km: event.target.value,
                          });
                        }}
                        placeholder="87,5"
                        required
                        type="text"
                        value={quickDailyEntryForm.distance_km}
                        aria-invalid={!!dailyEntryValidation.errors.distance_km}
                        aria-describedby={dailyEntryValidation.errors.distance_km ? "daily-entry-distance_km-error" : undefined}
                      />
                      <ErrorMessage id="daily-entry-distance_km-error" message={dailyEntryValidation.errors.distance_km} />
                    </label>

                    <label>
                      Tempo trabalhado
                      <input
                        name="worked_duration"
                        aria-describedby={`daily-duration-help ${dailyEntryValidation.errors.worked_duration ? "daily-entry-worked_duration-error" : ""}`.trim()}
                        inputMode="text"
                        onChange={(event) => {
                          dailyEntryValidation.clearError("worked_duration");
                          setQuickDailyEntryForm({
                            ...quickDailyEntryForm,
                            worked_duration: event.target.value,
                          });
                        }}
                        placeholder="8:30 ou 8h30"
                        required
                        type="text"
                        value={quickDailyEntryForm.worked_duration}
                        aria-invalid={!!dailyEntryValidation.errors.worked_duration}
                      />
                      <ErrorMessage id="daily-entry-worked_duration-error" message={dailyEntryValidation.errors.worked_duration} />
                      <small id="daily-duration-help">Ex.: 8:30 ou 8h30 para 8 horas e 30 minutos. Apenas 8 significa 8 horas.</small>
                    </label>

                    <label>
                      Numero de corridas <span className="optional-label">(opcional)</span>
                      <input
                        name="trip_count"
                        min="0"
                        onChange={(event) => {
                          dailyEntryValidation.clearError("trip_count");
                          setQuickDailyEntryForm({
                            ...quickDailyEntryForm,
                            trip_count: event.target.value,
                          });
                        }}
                        type="number"
                        value={quickDailyEntryForm.trip_count}
                        aria-invalid={!!dailyEntryValidation.errors.trip_count}
                        aria-describedby={dailyEntryValidation.errors.trip_count ? "daily-entry-trip_count-error" : undefined}
                      />
                      <ErrorMessage id="daily-entry-trip_count-error" message={dailyEntryValidation.errors.trip_count} />
                    </label>

                  {vehicles.length === 0 ? (
                    <p className="empty-state daily-entry-note">
                      Sem veiculo cadastrado. Voce pode preencher o dia agora; ao salvar, seus dados
                      ficam guardados e o app abre o cadastro do veiculo.
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
                        onChange={(event) => {
                          rememberDailyVehicle(event.target.value);
                          setQuickDailyEntryForm({
                            ...quickDailyEntryForm,
                            vehicle_id: event.target.value,
                          });
                        }}
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

                  <button
                    className="button daily-entry-button"
                    disabled={isQuickDailyEntrySaving}
                    type="submit"
                  >
                    {isQuickDailyEntrySaving
                      ? "Salvando..."
                      : vehicles.length === 0
                        ? "Continuar para cadastrar veiculo"
                        : "Salvar meu dia"}
                  </button>
                </form>

                {hasWorkdays ? (
                  <button className="text-button" type="button" onClick={() => navigateTo("today-summary")}>Fechar registro</button>
                ) : null}
              </section>

              <form className="auth-form daily-expense-form" id="daily-expense-form" tabIndex={-1} hidden={!isDailyExpenseVisible} onSubmit={handleDailyExpenseSubmit} onInvalid={dailyExpenseValidation.handleInvalid}>
                <div className="section-title">
                  <p className="eyebrow">Novo gasto</p>
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
                    name="category"
                    aria-invalid={!!dailyExpenseValidation.errors.category}
                    aria-describedby={dailyExpenseValidation.errors.category ? "daily-expense-category-error" : undefined}
                    className={dailyExpenseValidation.errors.category ? "field-error" : ""}
                  >
                    {expenseCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ErrorMessage id="daily-expense-category-error" message={dailyExpenseValidation.errors.category} />

                {vehicles.length > 0 ? (
                  <>
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
                      name="vehicle_id"
                      aria-invalid={!!dailyExpenseValidation.errors.vehicle_id}
                      aria-describedby={dailyExpenseValidation.errors.vehicle_id ? "daily-expense-vehicle_id-error" : undefined}
                      className={dailyExpenseValidation.errors.vehicle_id ? "field-error" : ""}
                    >
                      <option value="">Gasto geral / sem veículo</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} - {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ErrorMessage id="daily-expense-vehicle_id-error" message={dailyExpenseValidation.errors.vehicle_id} />
                  </>
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
                    placeholder="Ex: 89,90"
                    required
                    type="text"
                    value={dailyExpenseForm.amount}
                    name="amount"
                    aria-invalid={!!dailyExpenseValidation.errors.amount}
                    aria-describedby={dailyExpenseValidation.errors.amount ? "daily-expense-amount-error" : undefined}
                    className={dailyExpenseValidation.errors.amount ? "field-error" : ""}
                  />
                </label>
                <ErrorMessage id="daily-expense-amount-error" message={dailyExpenseValidation.errors.amount} />

                <label>
                  Descrição <span className="optional-label">(opcional)</span>
                  <input
                    maxLength={255}
                    onChange={(event) =>
                      setDailyExpenseForm({
                        ...dailyExpenseForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Ex: Combustível"
                    type="text"
                    value={dailyExpenseForm.description}
                    name="description"
                    aria-invalid={!!dailyExpenseValidation.errors.description}
                    aria-describedby={dailyExpenseValidation.errors.description ? "daily-expense-description-error" : undefined}
                    className={dailyExpenseValidation.errors.description ? "field-error" : ""}
                  />
                </label>
                <ErrorMessage id="daily-expense-description-error" message={dailyExpenseValidation.errors.description} />

                <div className="form-actions">
                  <button className="button" disabled={isDailyExpenseSaving} type="submit">
                    {isDailyExpenseSaving ? "Salvando..." : "Salvar gasto"}
                  </button>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => { setDailyExpenseVisible(false); navigateTo(hasWorkdays ? "today-summary" : "hoje"); }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>

              {quickDailyEntryResult ? (
                <section className="daily-entry-result" id="daily-entry-result" tabIndex={-1} aria-labelledby="daily-result-title">
                  <div className="section-title">
                    <h3 id="daily-result-title">Dia registrado</h3>
                    <p className="subtle-note">Registro de {formatDate(quickDailyEntryResult.workDate)} · {getVehicleLabel(quickDailyEntryResult.vehicle.id)}.</p>
                  </div>
                  <div className="daily-entry-actions">
                    <button className="button button-ghost" type="button" onClick={() => openDailyExpenseShortcut(quickDailyEntryResult)}>Adicionar gasto deste registro</button>
                    <button className="button button-ghost" type="button" onClick={handleViewCompleteResult}>Ver resultado completo</button>
                  </div>
                  <details className="advanced-options">
                    <summary>Detalhes do registro</summary>
                    <p>Faturamento: {formatCents(quickDailyEntryResult.grossRevenueCents)} · R$/hora: {quickDailyEntryResult.grossPerHourCents === null ? "—" : formatCents(quickDailyEntryResult.grossPerHourCents)} · R$/km: {quickDailyEntryResult.grossPerKmCents === null ? "—" : formatCents(quickDailyEntryResult.grossPerKmCents)} · Corridas: {quickDailyEntryResult.tripCount}</p>
                  </details>
                </section>
              ) : null}

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
                            Tempo trabalhado
                            <input
                              inputMode="text"
                              onChange={(event) =>
                                setQuickStartForm({
                                  ...quickStartForm,
                                  worked_duration: event.target.value,
                                })
                              }
                              placeholder="Ex: 8:30"
                              required
                              type="text"
                              value={quickStartForm.worked_duration}
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
            </section>

            <section className="dashboard-area" id="area-resultado" aria-label="Resultado" hidden={activeArea !== "resultado"} tabIndex={-1}>
              {workSessions.length > 0 && (activeArea === "resultado" || hasOpenedResult) ? (
                <Suspense fallback={<FeedbackMessage kind="loading">Carregando resultado...</FeedbackMessage>}>
                  <ResultSection
                    isActive={activeArea === "resultado"}
                    refreshVersion={financialRevision}
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
                    onSummaryRetry={() => void loadFinancialSummary()}
                    onInsightsRetry={() => void loadFinancialInsights()}
                    onHistoryRetry={() => void loadFinancialHistory()}
                    onFirstResultViewed={() => void recordFirstResultViewed()}
                    getAuthHeaders={getAuthHeaders}
                    endSession={endSession}
                    getVehicleLabel={getVehicleLabel}
                    getExpenseCategoryLabel={getExpenseCategoryLabel}
                  />
                </Suspense>
              ) : isWorkSessionsLoading ? (
                <FeedbackMessage kind="loading">Carregando seus registros...</FeedbackMessage>
              ) : (
                <div className="section-title">
                  <h2>Resultado</h2>
                  <p className="empty-state">Registre seu primeiro dia para acompanhar quanto sobrou.</p>
                  <button className="button inline-action" type="button" onClick={() => navigateTo("daily-revenue")}>
                    Registrar meu dia
                  </button>
                </div>
              )}

              <FinancialGoalsSection
                financialGoals={financialGoals}
                financialGoalProgressById={financialGoalProgressById}
                isFinancialGoalsLoading={isFinancialGoalsLoading}
                vehicles={vehicles}
                getVehicleLabel={getVehicleLabel}
                getAuthHeaders={getAuthHeaders}
                endSession={endSession}
                setMessage={setMessage}
                setSuccessMessage={setSuccessMessage}
                loadFinancialGoals={loadFinancialGoals}
              />
            </section>

            <section className="dashboard-area" id="area-custos" aria-label="Custos" hidden={activeArea !== "custos"} tabIndex={-1}>
              <div className="section-title">
                <h2>Custos</h2>
                <p className="subtle-note">Despesas, manutenção e custos do veículo.</p>
              </div>
              <nav className="result-context-nav" aria-label="Áreas de custos">
                <a href="#custos">Despesas</a>
                <a href="#despesas-recorrentes">Recorrentes</a>
                <a href="#manutencao">Manutenção</a>
                <a href="#veiculos">Veículos</a>
              </nav>

              <section className="manager-section" id="custos">
                <Suspense fallback={<FeedbackMessage kind="loading">Carregando importacao...</FeedbackMessage>}>
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
                    loadWorkSessions={(currentToken = token) => loadWorkSessions(currentToken, true)}
                    loadExpenses={(currentToken = token) => loadExpenses(currentToken, true)}
                    refreshDashboardData={refreshDashboardData}
                  />
                </Suspense>
                <div className="vehicles-layout">
                  <form className="auth-form vehicle-form" onSubmit={handleExpenseSubmit} onInvalid={expenseValidation.handleInvalid}>
                    <h3>{editingExpenseId ? "Editar despesa" : "Cadastrar despesa"}</h3>

                    <div className="form-grid">
                      <div>
                        <label>
                          Data
                          <input
                            name="expense_date"
                            onChange={(event) =>
                              setExpenseForm({
                                ...expenseForm,
                                expense_date: event.target.value,
                              })
                            }
                            required
                            type="date"
                            value={expenseForm.expense_date}
                            aria-invalid={!!expenseValidation.errors.expense_date}
                            aria-describedby={expenseValidation.errors.expense_date ? "expense-expense_date-error" : undefined}
                            className={expenseValidation.errors.expense_date ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="expense-expense_date-error" message={expenseValidation.errors.expense_date} />
                      </div>

                      <div>
                        <label>
                          Categoria
                          <select
                            name="category"
                            onChange={(event) =>
                              setExpenseForm({
                                ...expenseForm,
                                category: event.target.value as ExpenseCategory,
                              })
                            }
                            required
                            value={expenseForm.category}
                            aria-invalid={!!expenseValidation.errors.category}
                            aria-describedby={expenseValidation.errors.category ? "expense-category-error" : undefined}
                            className={expenseValidation.errors.category ? "field-error" : ""}
                          >
                            {expenseCategoryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="expense-category-error" message={expenseValidation.errors.category} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div>
                        <label>
                          Valor
                          <input
                            inputMode="decimal"
                            name="amount"
                            onChange={(event) =>
                              setExpenseForm({
                                ...expenseForm,
                                amount: event.target.value,
                              })
                            }
                            placeholder="Ex: 89,90"
                            required
                            type="text"
                            value={expenseForm.amount}
                            aria-invalid={!!expenseValidation.errors.amount}
                            aria-describedby={expenseValidation.errors.amount ? "expense-amount-error" : undefined}
                            className={expenseValidation.errors.amount ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="expense-amount-error" message={expenseValidation.errors.amount} />
                      </div>

                      <div>
                        <label>
                          Veículo
                          <select
                            name="vehicle_id"
                            onChange={(event) =>
                              setExpenseForm({
                                ...expenseForm,
                                vehicle_id: event.target.value,
                              })
                            }
                            value={expenseForm.vehicle_id}
                            aria-invalid={!!expenseValidation.errors.vehicle_id}
                            aria-describedby={expenseValidation.errors.vehicle_id ? "expense-vehicle_id-error" : undefined}
                            className={expenseValidation.errors.vehicle_id ? "field-error" : ""}
                          >
                            <option value="">Sem veículo</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.name} - {vehicle.brand} {vehicle.model}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="expense-vehicle_id-error" message={expenseValidation.errors.vehicle_id} />
                      </div>
                    </div>

                    <label>
                      Descrição
                      <input
                        maxLength={255}
                        name="description"
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            description: event.target.value,
                          })
                        }
                        placeholder="Opcional"
                        type="text"
                        value={expenseForm.description}
                        aria-invalid={!!expenseValidation.errors.description}
                        aria-describedby={expenseValidation.errors.description ? "expense-description-error" : undefined}
                        className={expenseValidation.errors.description ? "field-error" : ""}
                      />
                    </label>
                    <ErrorMessage id="expense-description-error" message={expenseValidation.errors.description} />

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

                    {isExpensesLoading ? <FeedbackMessage kind="loading">Carregando despesas...</FeedbackMessage> : null}

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
                    Cadastre custos que se repetem para não precisar informá-los novamente todos os meses.
                  </p>
                  <p className="subtle-note">
                    Despesas recorrentes entram nas projeções do GanhoCerto, mas não são registradas
                    automaticamente como despesas já pagas.
                  </p>
                </div>

                <div className="vehicles-layout">
                  <form className="auth-form vehicle-form" onSubmit={handleRecurringExpenseSubmit} onInvalid={recurringExpenseValidation.handleInvalid}>
                    <h3>
                      {editingRecurringExpenseId
                        ? "Editar despesa recorrente"
                        : "Cadastrar despesa recorrente"}
                    </h3>

                    <div className="form-grid">
                      <div>
                        <label>
                          Categoria
                          <select
                            name="category"
                            onChange={(event) =>
                              setRecurringExpenseForm({
                                ...recurringExpenseForm,
                                category: event.target.value as ExpenseCategory,
                              })
                            }
                            required
                            value={recurringExpenseForm.category}
                            aria-invalid={!!recurringExpenseValidation.errors.category}
                            aria-describedby={recurringExpenseValidation.errors.category ? "recurring-expense-category-error" : undefined}
                            className={recurringExpenseValidation.errors.category ? "field-error" : ""}
                          >
                            {expenseCategoryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="recurring-expense-category-error" message={recurringExpenseValidation.errors.category} />
                      </div>

                      <div>
                        <label>
                          Frequência
                          <select
                            name="frequency"
                            onChange={(event) =>
                              setRecurringExpenseForm({
                                ...recurringExpenseForm,
                                frequency: event.target.value as RecurringExpenseFrequency,
                              })
                            }
                            required
                            value={recurringExpenseForm.frequency}
                            aria-invalid={!!recurringExpenseValidation.errors.frequency}
                            aria-describedby={recurringExpenseValidation.errors.frequency ? "recurring-expense-frequency-error" : undefined}
                            className={recurringExpenseValidation.errors.frequency ? "field-error" : ""}
                          >
                            {recurringFrequencyOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="recurring-expense-frequency-error" message={recurringExpenseValidation.errors.frequency} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div>
                        <label>
                          Valor
                          <input
                            inputMode="decimal"
                            name="amount"
                            onChange={(event) =>
                              setRecurringExpenseForm({
                                ...recurringExpenseForm,
                                amount: event.target.value,
                              })
                            }
                            placeholder="Ex: 120,35"
                            required
                            type="text"
                            value={recurringExpenseForm.amount}
                            aria-invalid={!!recurringExpenseValidation.errors.amount}
                            aria-describedby={recurringExpenseValidation.errors.amount ? "recurring-expense-amount-error" : undefined}
                            className={recurringExpenseValidation.errors.amount ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="recurring-expense-amount-error" message={recurringExpenseValidation.errors.amount} />
                      </div>

                      <div>
                        <label>
                          Veículo
                          <select
                            name="vehicle_id"
                            onChange={(event) =>
                              setRecurringExpenseForm({
                                ...recurringExpenseForm,
                                vehicle_id: event.target.value,
                              })
                            }
                            value={recurringExpenseForm.vehicle_id}
                            aria-invalid={!!recurringExpenseValidation.errors.vehicle_id}
                            aria-describedby={recurringExpenseValidation.errors.vehicle_id ? "recurring-expense-vehicle_id-error" : undefined}
                            className={recurringExpenseValidation.errors.vehicle_id ? "field-error" : ""}
                          >
                            <option value="">Todos / sem veículo específico</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.name} - {vehicle.brand} {vehicle.model}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="recurring-expense-vehicle_id-error" message={recurringExpenseValidation.errors.vehicle_id} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div>
                        <label>
                          Data de início
                          <input
                            name="start_date"
                            onChange={(event) =>
                              setRecurringExpenseForm({
                                ...recurringExpenseForm,
                                start_date: event.target.value,
                              })
                            }
                            required
                            type="date"
                            value={recurringExpenseForm.start_date}
                            aria-invalid={!!recurringExpenseValidation.errors.start_date}
                            aria-describedby={recurringExpenseValidation.errors.start_date ? "recurring-expense-start_date-error" : undefined}
                            className={recurringExpenseValidation.errors.start_date ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="recurring-expense-start_date-error" message={recurringExpenseValidation.errors.start_date} />
                      </div>

                      <div>
                        <label>
                          Data de término <span className="optional-label">(opcional)</span>
                          <input
                            name="end_date"
                            onChange={(event) =>
                              setRecurringExpenseForm({
                                ...recurringExpenseForm,
                                end_date: event.target.value,
                              })
                            }
                            type="date"
                            value={recurringExpenseForm.end_date}
                            aria-invalid={!!recurringExpenseValidation.errors.end_date}
                            aria-describedby={recurringExpenseValidation.errors.end_date ? "recurring-expense-end_date-error" : undefined}
                            className={recurringExpenseValidation.errors.end_date ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="recurring-expense-end_date-error" message={recurringExpenseValidation.errors.end_date} />
                      </div>
                    </div>

                    <label>
                      Descrição <span className="optional-label">(opcional)</span>
                      <input
                        maxLength={255}
                        name="description"
                        onChange={(event) =>
                          setRecurringExpenseForm({
                            ...recurringExpenseForm,
                            description: event.target.value,
                          })
                        }
                        placeholder="Ex: Seguro, aluguel, lavagem"
                        type="text"
                        value={recurringExpenseForm.description}
                        aria-invalid={!!recurringExpenseValidation.errors.description}
                        aria-describedby={recurringExpenseValidation.errors.description ? "recurring-expense-description-error" : undefined}
                        className={recurringExpenseValidation.errors.description ? "field-error" : ""}
                      />
                    </label>
                    <ErrorMessage id="recurring-expense-description-error" message={recurringExpenseValidation.errors.description} />

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
                            ? "Salvar recorrência"
                            : "Cadastrar recorrência"}
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
                      <h3>Minhas recorrências</h3>
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
                      <FeedbackMessage kind="loading">Carregando despesas recorrentes...</FeedbackMessage>
                    ) : null}

                    {!isRecurringExpensesLoading && recurringExpenses.length === 0 ? (
                      <p className="empty-state">
                        Nenhuma despesa recorrente cadastrada ainda. Use esta área para guardar
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
                              <dt>Frequência</dt>
                              <dd>{getRecurringFrequencyLabel(recurringExpense.frequency)}</dd>
                            </div>
                            <div>
                              <dt>Veículo</dt>
                              <dd>
                                {recurringExpense.vehicle_id
                                  ? getVehicleLabel(recurringExpense.vehicle_id)
                                  : "Todos / sem veículo"}
                              </dd>
                            </div>
                            <div>
                              <dt>Período</dt>
                              <dd>
                                {formatDate(recurringExpense.start_date)} até{" "}
                                {recurringExpense.end_date
                                  ? formatDate(recurringExpense.end_date)
                                  : "sem término"}
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
                  <form className="auth-form vehicle-form" onSubmit={handleMaintenancePlanSubmit} onInvalid={maintenancePlanValidation.handleInvalid}>
                    <h3>{editingMaintenancePlanId ? "Editar manutencao" : "Adicionar manutencao"}</h3>

                    <div className="form-grid">
                      <div>
                        <label>
                          Nome
                          <input
                            maxLength={120}
                            name="name"
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
                            aria-invalid={!!maintenancePlanValidation.errors.name}
                            aria-describedby={maintenancePlanValidation.errors.name ? "maintenance-name-error" : undefined}
                            className={maintenancePlanValidation.errors.name ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="maintenance-name-error" message={maintenancePlanValidation.errors.name} />
                      </div>

                      <div>
                        <label>
                          Categoria
                          <select
                            name="category"
                            onChange={(event) =>
                              setMaintenancePlanForm({
                                ...maintenancePlanForm,
                                category: event.target.value as MaintenanceCategory,
                              })
                            }
                            required
                            value={maintenancePlanForm.category}
                            aria-invalid={!!maintenancePlanValidation.errors.category}
                            aria-describedby={maintenancePlanValidation.errors.category ? "maintenance-category-error" : undefined}
                            className={maintenancePlanValidation.errors.category ? "field-error" : ""}
                          >
                            {maintenanceCategoryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="maintenance-category-error" message={maintenancePlanValidation.errors.category} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div>
                        <label>
                          Veiculo
                          <select
                            name="vehicle_id"
                            onChange={(event) =>
                              setMaintenancePlanForm({
                                ...maintenancePlanForm,
                                vehicle_id: event.target.value,
                              })
                            }
                            required
                            value={maintenancePlanForm.vehicle_id}
                            aria-invalid={!!maintenancePlanValidation.errors.vehicle_id}
                            aria-describedby={maintenancePlanValidation.errors.vehicle_id ? "maintenance-vehicle_id-error" : undefined}
                            className={maintenancePlanValidation.errors.vehicle_id ? "field-error" : ""}
                          >
                            <option value="">Selecione</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.name} - {vehicle.brand} {vehicle.model}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="maintenance-vehicle_id-error" message={maintenancePlanValidation.errors.vehicle_id} />
                      </div>

                      <div>
                        <label>
                          Custo estimado <span className="optional-label">(opcional)</span>
                          <input
                            inputMode="decimal"
                            name="estimated_cost"
                            onChange={(event) =>
                              setMaintenancePlanForm({
                                ...maintenancePlanForm,
                                estimated_cost: event.target.value,
                              })
                            }
                            placeholder="Ex: 280,00"
                            type="text"
                            value={maintenancePlanForm.estimated_cost}
                            aria-invalid={!!maintenancePlanValidation.errors.estimated_cost}
                            aria-describedby={maintenancePlanValidation.errors.estimated_cost ? "maintenance-estimated_cost-error" : undefined}
                            className={maintenancePlanValidation.errors.estimated_cost ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="maintenance-estimated_cost-error" message={maintenancePlanValidation.errors.estimated_cost} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div>
                        <label>
                          Intervalo em km <span className="optional-label">(opcional)</span>
                          <input
                            inputMode="decimal"
                            name="interval_km"
                            onChange={(event) =>
                              setMaintenancePlanForm({
                                ...maintenancePlanForm,
                                interval_km: event.target.value,
                              })
                            }
                            placeholder="10000"
                            type="text"
                            value={maintenancePlanForm.interval_km}
                            aria-invalid={!!maintenancePlanValidation.errors.interval_km}
                            aria-describedby={maintenancePlanValidation.errors.interval_km ? "maintenance-interval_km-error" : undefined}
                            className={maintenancePlanValidation.errors.interval_km ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="maintenance-interval_km-error" message={maintenancePlanValidation.errors.interval_km} />
                      </div>

                      <div>
                        <label>
                          Intervalo em dias <span className="optional-label">(opcional)</span>
                          <input
                            inputMode="numeric"
                            min="1"
                            name="interval_days"
                            onChange={(event) =>
                              setMaintenancePlanForm({
                                ...maintenancePlanForm,
                                interval_days: event.target.value,
                              })
                            }
                            placeholder="180"
                            type="number"
                            value={maintenancePlanForm.interval_days}
                            aria-invalid={!!maintenancePlanValidation.errors.interval_days}
                            aria-describedby={maintenancePlanValidation.errors.interval_days ? "maintenance-interval_days-error" : undefined}
                            className={maintenancePlanValidation.errors.interval_days ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="maintenance-interval_days-error" message={maintenancePlanValidation.errors.interval_days} />
                      </div>
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
                      <FeedbackMessage kind="loading">Carregando manutencoes...</FeedbackMessage>
                    ) : null}

                    {!isMaintenanceLoading && maintenancePlans.length === 0 ? (
                      <p className="empty-state">
                        Configure suas manutencoes para saber quando revisar o veiculo e quanto reservar.{" "}
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => navigateTo("manutencao")}
                        >
                          Adicionar manutencao
                        </button>
                      </p>
                    ) : null}

                    {(["due", "due_soon", "ok"] as MaintenanceStatusType[]).map((statusValue) => {
                      const plans = maintenancePlansByStatus[statusValue];
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
                                        onInvalid={maintenanceRecordValidation.handleInvalid}
                                      >
                                        <div className="form-grid">
                                          <div>
                                            <label>
                                              Data
                                              <input
                                                name="service_date"
                                                onChange={(event) =>
                                                  setMaintenanceRecordForm({
                                                    ...maintenanceRecordForm,
                                                    service_date: event.target.value,
                                                  })
                                                }
                                                required
                                                type="date"
                                                value={maintenanceRecordForm.service_date}
                                                aria-invalid={!!maintenanceRecordValidation.errors.service_date}
                                                aria-describedby={maintenanceRecordValidation.errors.service_date ? "maintenance-record-service_date-error" : undefined}
                                                className={maintenanceRecordValidation.errors.service_date ? "field-error" : ""}
                                              />
                                            </label>
                                            <ErrorMessage id="maintenance-record-service_date-error" message={maintenanceRecordValidation.errors.service_date} />
                                          </div>
                                          <div>
                                            <label>
                                              Observacao <span className="optional-label">(opcional)</span>
                                              <input
                                                maxLength={255}
                                                name="notes"
                                                onChange={(event) =>
                                                  setMaintenanceRecordForm({
                                                    ...maintenanceRecordForm,
                                                    notes: event.target.value,
                                                  })
                                                }
                                                placeholder="Ex.: troca feita na oficina"
                                                type="text"
                                                value={maintenanceRecordForm.notes}
                                                aria-invalid={!!maintenanceRecordValidation.errors.notes}
                                                aria-describedby={maintenanceRecordValidation.errors.notes ? "maintenance-record-notes-error" : undefined}
                                                className={maintenanceRecordValidation.errors.notes ? "field-error" : ""}
                                              />
                                            </label>
                                            <ErrorMessage id="maintenance-record-notes-error" message={maintenanceRecordValidation.errors.notes} />
                                          </div>
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
                loadVehicles={() => loadVehicles(token, user?.id, true)}
                loadWorkSessions={() => loadWorkSessions(token, true)}
                loadExpenses={() => loadExpenses(token, true)}
                refreshDashboardData={() => refreshDashboardData()}
                onVehicleCreated={handleVehicleCreated}
              />
            </section>

            <section className="dashboard-area" id="area-mais" aria-label="Mais" hidden={activeArea !== "mais"} tabIndex={-1}>
              <div className="section-title">
                <h2>Mais</h2>
                <p className="subtle-note">Sua conta, importação e histórico de jornadas.</p>
              </div>
              <nav className="result-context-nav" aria-label="Outras opções">
                <a href="#conta">Conta e preferências</a>
                <a href="#jornadas">Jornadas e importação</a>
              </nav>

              <details className="account-menu" id="conta">
                <summary>Conta e preferências</summary>
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
                <AccountPlanPanel
                  accountPlan={accountPlan}
                  billingError={billingCheckoutError}
                  billingMessage={billingCheckoutMessage}
                  error={accountPlanError}
                  isCheckoutLoading={isBillingCheckoutLoading}
                  isLoading={isAccountPlanLoading}
                  onCheckoutPro={() => void handleCheckoutPro()}
                  onRetry={() => void loadAccountPlan()}
                />
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => {
                    setIsChangePasswordVisible((current) => !current);
                    setIsFeedbackVisible(false);
                    setMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Alterar senha
                </button>
                {isChangePasswordVisible ? (
                  <ChangePasswordForm
                    getAuthHeaders={getAuthHeaders}
                    onCancel={() => setIsChangePasswordVisible(false)}
                    onPasswordChanged={handlePasswordChanged}
                  />
                ) : null}
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => {
                    setIsFeedbackVisible((current) => !current);
                    setIsChangePasswordVisible(false);
                    setMessage("");
                    setSuccessMessage("");
                  }}
                >
                  Enviar feedback da beta
                </button>
                {isFeedbackVisible ? (
                  <form className="auth-form feedback-form" onSubmit={handleFeedbackSubmit}>
                    <h3>Feedback da beta</h3>
                    <label>
                      Tipo
                      <select
                        value={feedbackCategory}
                        onChange={(event) =>
                          setFeedbackCategory(event.target.value as BetaFeedbackCategory)
                        }
                      >
                        {feedbackCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      O que aconteceu?
                      <textarea
                        maxLength={2000}
                        minLength={10}
                        onChange={(event) => setFeedbackMessage(event.target.value)}
                        placeholder="Conte o que ficou confuso, travou ou faria diferenca para voce."
                        required
                        rows={4}
                        value={feedbackMessage}
                      />
                    </label>
                    <div className="form-actions">
                      <button className="button" disabled={isFeedbackSaving} type="submit">
                        {isFeedbackSaving ? "Enviando..." : "Enviar feedback"}
                      </button>
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => setIsFeedbackVisible(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : null}
                <button className="button button-secondary" type="button" onClick={handleLogout}>
                  Sair
                </button>
              </details>

              <section className="manager-section" id="jornadas">
                <Suspense fallback={<FeedbackMessage kind="loading">Carregando importacao...</FeedbackMessage>}>
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
                    loadWorkSessions={(currentToken = token) => loadWorkSessions(currentToken, true)}
                    loadExpenses={(currentToken = token) => loadExpenses(currentToken, true)}
                    refreshDashboardData={refreshDashboardData}
                  />
                </Suspense>
                <div className="vehicles-layout">
                  <form className="auth-form vehicle-form" onSubmit={handleWorkSessionSubmit} onInvalid={workSessionValidation.handleInvalid}>
                    <h3>{editingWorkSessionId ? "Editar jornada" : "Cadastrar jornada"}</h3>

                    <div className="form-grid">
                      <div>
                        <label>
                          Data
                          <input
                            name="work_date"
                            onChange={(event) =>
                              setWorkSessionForm({
                                ...workSessionForm,
                                work_date: event.target.value,
                              })
                            }
                            required
                            type="date"
                            value={workSessionForm.work_date}
                            aria-invalid={!!workSessionValidation.errors.work_date}
                            aria-describedby={workSessionValidation.errors.work_date ? "work-session-work_date-error" : undefined}
                            className={workSessionValidation.errors.work_date ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="work-session-work_date-error" message={workSessionValidation.errors.work_date} />
                      </div>

                      <div>
                        <label>
                          Veículo
                          <select
                            name="vehicle_id"
                            onChange={(event) =>
                              setWorkSessionForm({
                                ...workSessionForm,
                                vehicle_id: event.target.value,
                              })
                            }
                            required
                            value={workSessionForm.vehicle_id}
                            aria-invalid={!!workSessionValidation.errors.vehicle_id}
                            aria-describedby={workSessionValidation.errors.vehicle_id ? "work-session-vehicle_id-error" : undefined}
                            className={workSessionValidation.errors.vehicle_id ? "field-error" : ""}
                          >
                            <option value="">Selecione</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.name} - {vehicle.brand} {vehicle.model}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ErrorMessage id="work-session-vehicle_id-error" message={workSessionValidation.errors.vehicle_id} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div>
                        <label>
                          Faturamento bruto
                          <input
                            inputMode="decimal"
                            name="gross_revenue"
                            onChange={(event) =>
                              setWorkSessionForm({
                                ...workSessionForm,
                                gross_revenue: event.target.value,
                              })
                            }
                            placeholder="Ex: 250,50"
                            required
                            type="text"
                            value={workSessionForm.gross_revenue}
                            aria-invalid={!!workSessionValidation.errors.gross_revenue}
                            aria-describedby={workSessionValidation.errors.gross_revenue ? "work-session-gross_revenue-error" : undefined}
                            className={workSessionValidation.errors.gross_revenue ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="work-session-gross_revenue-error" message={workSessionValidation.errors.gross_revenue} />
                      </div>

                      <div>
                        <label>
                          Km rodados
                          <input
                            inputMode="decimal"
                            name="distance_km"
                            onChange={(event) =>
                              setWorkSessionForm({
                                ...workSessionForm,
                                distance_km: event.target.value,
                              })
                            }
                            placeholder="Ex: 87,5"
                            required
                            type="text"
                            value={workSessionForm.distance_km}
                            aria-invalid={!!workSessionValidation.errors.distance_km}
                            aria-describedby={workSessionValidation.errors.distance_km ? "work-session-distance_km-error" : undefined}
                            className={workSessionValidation.errors.distance_km ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="work-session-distance_km-error" message={workSessionValidation.errors.distance_km} />
                      </div>
                    </div>

                    <div className="form-grid form-grid-three">
                      <div>
                        <label>
                          Tempo trabalhado
                          <input
                            inputMode="text"
                            name="worked_duration"
                            onChange={(event) =>
                              setWorkSessionForm({
                                ...workSessionForm,
                                worked_duration: event.target.value,
                              })
                            }
                            placeholder="Ex: 8:30"
                            required
                            type="text"
                            value={workSessionForm.worked_duration}
                            aria-invalid={!!workSessionValidation.errors.worked_duration}
                            aria-describedby={workSessionValidation.errors.worked_duration ? "work-session-worked_duration-error" : undefined}
                            className={workSessionValidation.errors.worked_duration ? "field-error" : ""}
                          />
                          <small>Ex.: 8:30 ou 8h30.</small>
                        </label>
                        <ErrorMessage id="work-session-worked_duration-error" message={workSessionValidation.errors.worked_duration} />
                      </div>

                      <div>
                        <label>
                          Número de corridas
                          <input
                            min="0"
                            name="trip_count"
                            onChange={(event) =>
                              setWorkSessionForm({
                                ...workSessionForm,
                                trip_count: event.target.value,
                              })
                            }
                            required
                            type="number"
                            value={workSessionForm.trip_count}
                            aria-invalid={!!workSessionValidation.errors.trip_count}
                            aria-describedby={workSessionValidation.errors.trip_count ? "work-session-trip_count-error" : undefined}
                            className={workSessionValidation.errors.trip_count ? "field-error" : ""}
                          />
                        </label>
                        <ErrorMessage id="work-session-trip_count-error" message={workSessionValidation.errors.trip_count} />
                      </div>
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
                      <FeedbackMessage kind="loading">Carregando jornadas...</FeedbackMessage>
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
            </section>
          </div>
        ) : (
          <>
            {isResetPasswordRoute ? (
              <ResetPasswordForm
                token={resetPasswordToken}
                onBackToLogin={handleBackToLogin}
                onRequestNewLink={handleRequestNewResetLink}
                onResetComplete={handleResetComplete}
              />
            ) : (
              <>
                {mode === "forgot-password" ? null : (
                  <div className="tabs" role="group" aria-label="Autenticacao">
                    <button
                      className={mode === "login" ? "tab tab-active" : "tab"}
                      aria-pressed={mode === "login"}
                      type="button"
                      onClick={() => resetForm("login")}
                    >
                      Login
                    </button>
                    <button
                      className={mode === "register" ? "tab tab-active" : "tab"}
                      aria-pressed={mode === "register"}
                      type="button"
                      onClick={() => resetForm("register")}
                    >
                      Cadastro
                    </button>
                  </div>
                )}

                {mode === "forgot-password" ? (
                  <ForgotPasswordForm initialEmail={email} onBackToLogin={handleBackToLogin} />
                ) : (
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

                    {message ? <FeedbackMessage kind="error">{message}</FeedbackMessage> : null}
                    {successMessage ? <FeedbackMessage kind="success">{successMessage}</FeedbackMessage> : null}

                    <button className="button" disabled={isLoading} type="submit">
                      {isLoading ? "Enviando..." : mode === "login" ? "Entrar" : "Cadastrar"}
                    </button>
                    {mode === "login" ? (
                      <button
                        className="text-button inline-action"
                        type="button"
                        onClick={() => {
                          setMode("forgot-password");
                          setMessage("");
                          setSuccessMessage("");
                          setPassword("");
                        }}
                      >
                        Esqueci minha senha
                      </button>
                    ) : null}
                  </form>
                )}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
