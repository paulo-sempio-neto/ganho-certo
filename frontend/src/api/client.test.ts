import { describe, expect, it } from "vitest";

import {
  getDefaultErrorMessage,
  getEntitlementErrorMessage,
  getErrorMessage,
  getRequestTimeoutMs,
  getSafeApiDetail,
  NETWORK_ERROR_MESSAGE,
  PLAN_LIMIT_REACHED_MESSAGE,
  PRO_FEATURE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  TEMPORARY_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from "./client";

describe("api client error handling", () => {
  it("uses friendly messages for session, timeout, network and temporary server errors", () => {
    expect(getDefaultErrorMessage(401)).toBe(SESSION_EXPIRED_MESSAGE);
    expect(getDefaultErrorMessage(408)).toBe(TIMEOUT_ERROR_MESSAGE);
    expect(getDefaultErrorMessage(503)).toBe(TEMPORARY_ERROR_MESSAGE);
    expect(NETWORK_ERROR_MESSAGE).toBe(
      "Nao foi possivel conectar ao servidor. Tente novamente.",
    );
  });

  it("keeps safe API details and hides internal details", () => {
    expect(getSafeApiDetail("Email already registered.")).toBe("Este email ja esta cadastrado.");
    expect(getSafeApiDetail("Campo obrigatorio.")).toBe("Campo obrigatorio.");
    expect(getSafeApiDetail("Erro em http://localhost:8000/internal")).toBeNull();
    expect(getSafeApiDetail("Traceback: falha interna")).toBeNull();
  });

  it("falls back to generic messages when API details are unsafe", async () => {
    const response = new Response(
      JSON.stringify({ detail: "Erro em http://localhost:8000/internal" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

    await expect(getErrorMessage(response)).resolves.toBe("Nao foi possivel concluir a solicitacao.");
  });

  it("maps entitlement errors to friendly plan messages", async () => {
    expect(
      getEntitlementErrorMessage({
        code: "plan_limit_reached",
        detail: "Seu plano atual atingiu o limite de veiculos cadastrados.",
      }),
    ).toBe(PLAN_LIMIT_REACHED_MESSAGE);
    expect(
      getEntitlementErrorMessage({
        code: "plan_limit_reached",
        detail: "Seu plano atual nao inclui importacao CSV.",
      }),
    ).toBe(PRO_FEATURE_MESSAGE);

    const response = new Response(
      JSON.stringify({
        code: "plan_limit_reached",
        detail: "Seu plano atual nao inclui historico avancado.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );

    await expect(getErrorMessage(response)).resolves.toBe(PRO_FEATURE_MESSAGE);
  });

  it("allows more time for upload requests", () => {
    expect(getRequestTimeoutMs({ method: "GET" })).toBe(15_000);
    expect(getRequestTimeoutMs({ method: "POST", body: "plain json body" })).toBe(15_000);
    expect(getRequestTimeoutMs({ method: "POST", body: new Blob(["csv"]) })).toBe(60_000);
  });
});
