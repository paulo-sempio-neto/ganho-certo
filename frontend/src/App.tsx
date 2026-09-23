import { FormEvent, useEffect, useState } from "react";

import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_STORAGE_KEY = "ganhocerto.accessToken";

type AuthMode = "login" | "register";

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

function getErrorMessage(status: number): string {
  if (status === 401) {
    return "Credenciais invalidas.";
  }

  if (status === 409) {
    return "Este email ja esta cadastrado.";
  }

  if (status === 422) {
    return "Verifique os campos informados.";
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

  return response.json() as Promise<T>;
}

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    async function loadSession() {
      try {
        const currentUser = await requestApi<User>("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(currentUser);
        setMessage("");
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
        setMessage("Sessao expirada ou invalida. Entre novamente.");
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
  }

  async function handleRegister() {
    await requestApi<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    setMode("login");
    setPassword("");
    setMessage("Cadastro realizado. Agora entre com seu email e senha.");
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
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setMode("login");
    setPassword("");
    setMessage("");
  }

  return (
    <main className="page">
      <section className="intro" aria-labelledby="page-title">
        <p className="brand">GanhoCerto</p>
        <h1 id="page-title">Seu faturamento não é seu lucro.</h1>
        <p className="subtitle">Descubra quanto você realmente ganha dirigindo.</p>
      </section>

      <section className="auth-panel" aria-live="polite">
        {user ? (
          <div className="session">
            <p className="eyebrow">Sessao autenticada</p>
            <h2>Bem-vindo ao GanhoCerto, {user.name}.</h2>
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
            <button className="button button-secondary" type="button" onClick={handleLogout}>
              Sair
            </button>
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
