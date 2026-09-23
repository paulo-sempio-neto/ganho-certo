import { FormEvent, useEffect, useState } from "react";

import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";

type AuthMode = "login" | "register";
type FuelType = "gasoline" | "ethanol" | "flex" | "diesel" | "electric" | "hybrid" | "other";

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

type VehicleForm = {
  name: string;
  brand: string;
  model: string;
  year: string;
  fuel_type: FuelType;
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

const emptyVehicleForm: VehicleForm = {
  name: "",
  brand: "",
  model: "",
  year: "",
  fuel_type: "flex",
};

function getFuelLabel(value: FuelType): string {
  return fuelOptions.find((option) => option.value === value)?.label ?? value;
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
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);
  const [isVehicleSaving, setIsVehicleSaving] = useState(false);

  function endSession(nextMessage = "") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setVehicles([]);
    setEditingVehicleId(null);
    setVehicleForm(emptyVehicleForm);
    setMode("login");
    setPassword("");
    setSuccessMessage("");
    setMessage(nextMessage);
  }

  function getAuthHeaders(currentToken = token): HeadersInit {
    return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
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

  useEffect(() => {
    if (!token) {
      setUser(null);
      setVehicles([]);
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
      } catch {
        endSession("Sessao expirada ou invalida. Entre novamente.");
      }
    }

    void loadSession();
  }, [token]);

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
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir veiculo.");
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

                {message ? <p className="form-message">{message}</p> : null}
                {successMessage ? <p className="success-message">{successMessage}</p> : null}

                {isVehiclesLoading ? <p className="empty-state">Carregando veiculos...</p> : null}

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
