import { FormEvent, useEffect, useState } from "react";

import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";

type AuthMode = "login" | "register";
type FuelType = "gasoline" | "ethanol" | "flex" | "diesel" | "electric" | "hybrid" | "other";
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

type FinancialDailySummary = {
  date: string;
  gross_revenue: string;
  expenses: string;
  estimated_net_profit: string;
};

type FinancialSummary = {
  gross_revenue: string;
  total_expenses: string;
  estimated_net_profit: string;
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

function formatMoney(value: string): string {
  const [reais, cents = "00"] = value.split(".");
  const groupedReais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${groupedReais},${`${cents}00`.slice(0, 2)}`;
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
  const [workSessionForm, setWorkSessionForm] =
    useState<WorkSessionForm>(emptyWorkSessionForm);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
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
  const [isVehicleSaving, setIsVehicleSaving] = useState(false);
  const [isWorkSessionSaving, setIsWorkSessionSaving] = useState(false);
  const [isExpenseSaving, setIsExpenseSaving] = useState(false);

  function endSession(nextMessage = "") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setVehicles([]);
    setWorkSessions([]);
    setExpenses([]);
    setFinancialSummary(null);
    setEditingVehicleId(null);
    setEditingWorkSessionId(null);
    setEditingExpenseId(null);
    setVehicleForm(emptyVehicleForm);
    setWorkSessionForm(emptyWorkSessionForm);
    setExpenseForm(emptyExpenseForm);
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

  useEffect(() => {
    if (!token) {
      setUser(null);
      setVehicles([]);
      setWorkSessions([]);
      setExpenses([]);
      setFinancialSummary(null);
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
      if (editingVehicleId) {
        await requestApi<Vehicle>(`/vehicles/${editingVehicleId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Veiculo atualizado com sucesso.");
      } else {
        await requestApi<Vehicle>("/vehicles", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Veiculo cadastrado com sucesso.");
      }

      resetVehicleForm();
      await loadVehicles();
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
              <a href="#dashboard">Dashboard</a>
              <a href="#jornadas">Jornadas</a>
              <a href="#despesas">Despesas</a>
              <a href="#veiculos">Veículos</a>
            </nav>

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
