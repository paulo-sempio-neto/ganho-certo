const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;

export const SESSION_EXPIRED_MESSAGE = "Sessao expirada ou invalida. Entre novamente.";
export const NETWORK_ERROR_MESSAGE = "Nao foi possivel conectar ao servidor. Tente novamente.";
export const TIMEOUT_ERROR_MESSAGE =
  "A conexao demorou demais. Verifique sua internet e tente novamente.";
export const TEMPORARY_ERROR_MESSAGE =
  "Servidor temporariamente indisponivel. Tente novamente em instantes.";

export function getDefaultErrorMessage(status: number): string {
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (status === 408) {
    return TIMEOUT_ERROR_MESSAGE;
  }

  if (status === 429) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
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

  if (status >= 500) {
    return TEMPORARY_ERROR_MESSAGE;
  }

  return "Nao foi possivel concluir a solicitacao.";
}

function hasSensitiveDetails(message: string): boolean {
  return (
    /https?:\/\//i.test(message) ||
    /\b(localhost|127\.0\.0\.1)\b/i.test(message) ||
    /\b(traceback|stack trace|authorization|bearer)\b/i.test(message) ||
    /\b[A-Za-z]:\\/.test(message) ||
    message.includes("\n") ||
    message.length > 180
  );
}

export function getSafeApiDetail(detail: string): string | null {
  const normalizedDetail = detail.trim().replace(/\s+/g, " ");

  if (normalizedDetail === "Email already registered.") {
    return "Este email ja esta cadastrado.";
  }

  if (!normalizedDetail || hasSensitiveDetails(normalizedDetail)) {
    return null;
  }

  return normalizedDetail;
}

export async function getErrorMessage(response: Response): Promise<string> {
  if (response.status !== 400 && response.status !== 409) {
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
      return getSafeApiDetail(payload.detail) ?? getDefaultErrorMessage(response.status);
    }
  } catch {
    // Fall back to a generic message when the API does not return JSON.
  }

  return getDefaultErrorMessage(response.status);
}

function isUploadRequest(options: RequestInit): boolean {
  const { body } = options;
  return body !== undefined && body !== null && typeof body !== "string";
}

export function getRequestTimeoutMs(options: RequestInit = {}): number {
  return isUploadRequest(options) ? UPLOAD_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
}

function getHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && !isUploadRequest(options)) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("Configure VITE_API_BASE_URL para conectar ao backend.");
  }

  let response: Response;
  let didTimeout = false;
  const timeoutMs = getRequestTimeoutMs(options);
  const requestController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    requestController.abort();
  }, timeoutMs);
  const abortRequest = () => requestController.abort();

  try {
    if (options.signal?.aborted) {
      requestController.abort();
    } else {
      options.signal?.addEventListener("abort", abortRequest, { once: true });
    }

    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: getHeaders(options),
      signal: requestController.signal,
    });
  } catch (error) {
    if (didTimeout || isAbortError(error)) {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw new Error(NETWORK_ERROR_MESSAGE);
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortRequest);
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
