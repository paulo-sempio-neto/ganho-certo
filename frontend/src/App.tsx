import { FormEvent, useEffect, useState } from "react";

import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";

type AuthMode = "login" | "register";
type FuelType = "gasoline" | "ethanol" | "flex" | "diesel" | "electric" | "hybrid" | "other";
type OwnershipType = "owned" | "financed" | "rented";
type DashboardPeriod = "today" | "last7" | "month" | "custom";

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

type FinancialSummary = {
  gross_revenue: string;
  total_expenses: string;
  estimated_net_profit: string;
  estimated_structural_costs: string;
  estimated_economic_costs: string;
  estimated_economic_result: string;
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
  work_date: new Date().toISOString().slice(0, 10),
  vehicle_id: "",
  gross_revenue: "",
  distance_km: "",
  worked_hours: "",
  worked_minutes: "",
  trip_count: "",
};

const emptyExpenseForm: ExpenseForm = {
  expense_date: new Date().toISOString().slice(0, 10),
  category: "fuel",
  amount: "",
  vehicle_id: "",
  description: "",
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
  work_date: new Date().toISOString().slice(0, 10),
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

function getErrorMessage(status: number): string {
  if (status === 401) {
    return "Sessao expirada ou invalida. Entre novamente.";
  }

  if (status === 409) {
    return "Este email ja esta cadastrado.";
  }

  if (status === 422) {
    return "Verifique os campos informados.";
  }

  if (status === 404) {
    return "Registro nao encontrado.";
  }

  return "Nao foi possivel concluir a solicitacao.";
}

function normalizeDecimalInput(value: string): string {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Verifique os campos numericos informados.");
  }

  return normalized;
}

function moneyInputToApi(value: string): string {
  const cleaned = value.trim().replace(/R\$/gi, "").replace(/\s/g, "").replace(/\./g, "");
  const normalized = cleaned.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe o faturamento em reais, por exemplo 250,50.");
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

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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
    throw new Error(getErrorMessage(response.status));
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
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [costProfileForm, setCostProfileForm] =
    useState<VehicleCostProfileForm>(emptyCostProfileForm);
  const [workSessionForm, setWorkSessionForm] =
    useState<WorkSessionForm>(emptyWorkSessionForm);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
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
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("last7");
  const [dashboardVehicleId, setDashboardVehicleId] = useState("");
  const [customStartDate, setCustomStartDate] = useState(toDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(toDateInputValue(new Date()));
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isWorkSessionsLoading, setIsWorkSessionsLoading] = useState(false);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isCostProfileLoading, setIsCostProfileLoading] = useState(false);
  const [isVehicleSaving, setIsVehicleSaving] = useState(false);
  const [isCostProfileSaving, setIsCostProfileSaving] = useState(false);
  const [isWorkSessionSaving, setIsWorkSessionSaving] = useState(false);
  const [isExpenseSaving, setIsExpenseSaving] = useState(false);
  const [isQuickDailyEntrySaving, setIsQuickDailyEntrySaving] = useState(false);
  const [isDailyExpenseSaving, setIsDailyExpenseSaving] = useState(false);

  function endSession(nextMessage = "") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setVehicles([]);
    setWorkSessions([]);
    setExpenses([]);
    setFinancialSummary(null);
    setEditingVehicleId(null);
    setCostProfileVehicleId(null);
    setEditingWorkSessionId(null);
    setEditingExpenseId(null);
    setVehicleForm(emptyVehicleForm);
    setCostProfileForm(emptyCostProfileForm);
    setWorkSessionForm(emptyWorkSessionForm);
    setExpenseForm(emptyExpenseForm);
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
    setMessage(nextMessage);
  }

  function getAuthHeaders(currentToken = token): HeadersInit {
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

  function buildFinancialSummaryPath() {
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
    return `/financial-summary${query ? `?${query}` : ""}`;
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
      setFinancialSummary(null);
      setCostProfileVehicleId(null);
      setCostProfileForm(emptyCostProfileForm);
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
        await loadFinancialSummary(token);
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

    void loadFinancialSummary(token);
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
    await loadFinancialSummary();
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
      await loadFinancialSummary();
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

    await requestApi<WorkSession>("/work-sessions", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        work_date: workDate,
        gross_revenue: moneyInputToApi(quickStartForm.gross_revenue),
        distance_km: normalizeDecimalInput(quickStartForm.distance_km),
        worked_minutes: workedMinutes,
        trip_count: tripCount,
      }),
    });

    if (fuelExpenseCents > 0n) {
      await requestApi<Expense>("/expenses", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          expense_date: workDate,
          category: quickStartForm.expense_category,
          amount: moneyInputToApi(quickStartForm.fuel_expense),
          description: "Registrado pelo início rápido",
        }),
      });
    }

    setPendingQuickStartAction(null);
    setSuccessMessage("Seu primeiro dia foi registrado com os dados da simulação.");
    await loadWorkSessions();
    await loadExpenses();
    await loadFinancialSummary();
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
      await loadFinancialSummary();
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
      await loadFinancialSummary();
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
      await loadFinancialSummary();
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
      await loadFinancialSummary();
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
      await loadFinancialSummary();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir despesa.");
      }
    }
  }

  const selectedCostProfileVehicle = getCostProfileVehicle();
  const isQuickStartVisible = workSessions.length === 0 || quickStartVisible;

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
              <a href="#jornadas">Jornadas</a>
              <a href="#despesas">Despesas</a>
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
                      <p className="eyebrow">Seu resultado de verdade</p>
                      <h3>Visao economica do periodo</h3>
                      <p className="subtle-note">
                        O resultado economico considera custos configurados do veiculo, como
                        aluguel, financiamento, seguro, IPVA, manutencao, pneus, oleo e
                        depreciacao.
                      </p>
                    </div>

                    <div className="metric-grid economic-flow">
                      <article className="metric-card">
                        <span>Faturamento bruto</span>
                        <strong>{formatMoney(financialSummary.gross_revenue)}</strong>
                      </article>
                      <article className="metric-card metric-expense">
                        <span>Despesas registradas</span>
                        <strong>{formatMoney(financialSummary.total_expenses)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Sobra apos despesas</span>
                        <strong>{formatMoney(financialSummary.estimated_net_profit)}</strong>
                      </article>
                      <article className="metric-card metric-expense">
                        <span>Custos estruturais estimados</span>
                        <strong>{formatMoney(financialSummary.estimated_structural_costs)}</strong>
                      </article>
                      <article
                        className={
                          isNegativeMoney(financialSummary.estimated_economic_result)
                            ? "metric-card economic-result-card metric-negative"
                            : "metric-card economic-result-card metric-profit"
                        }
                      >
                        <span>Resultado economico estimado</span>
                        <strong>{formatMoney(financialSummary.estimated_economic_result)}</strong>
                        <small>
                          Com base nas despesas registradas e nos custos configurados do seu
                          veiculo.
                        </small>
                        <small>
                          Custos economicos considerados:{" "}
                          {formatMoney(financialSummary.estimated_economic_costs)}
                        </small>
                      </article>
                    </div>

                    {!isPositiveMoney(financialSummary.estimated_structural_costs) ? (
                      <p className="empty-state">
                        Configure os custos do veiculo para obter uma estimativa economica mais
                        completa. <a href="#veiculos">Ir para Veiculos</a>
                      </p>
                    ) : null}
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

                  <div className="metric-grid highlights">
                    <article className="metric-card metric-profit">
                      <span>Lucro líquido estimado</span>
                      <strong>{formatMoney(financialSummary.estimated_net_profit)}</strong>
                    </article>
                    <article className="metric-card">
                      <span>Faturamento bruto</span>
                      <strong>{formatMoney(financialSummary.gross_revenue)}</strong>
                    </article>
                    <article className="metric-card metric-expense">
                      <span>Despesas</span>
                      <strong>{formatMoney(financialSummary.total_expenses)}</strong>
                    </article>
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
              </div>

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

                <div className="vehicles-list" aria-busy={isWorkSessionsLoading}>
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
              </div>

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

                <div className="vehicles-list" aria-busy={isExpensesLoading}>
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
