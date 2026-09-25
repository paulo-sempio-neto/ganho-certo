const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function getDefaultErrorMessage(status: number): string {
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

export async function getErrorMessage(response: Response): Promise<string> {
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

export async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
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
