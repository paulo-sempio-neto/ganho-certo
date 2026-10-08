import { useCallback, useEffect, useRef, useState } from "react";
import { SESSION_EXPIRED_MESSAGE } from "../../api/client";
import { createLatestRequest } from "../../utils/latestRequest";
import { getFinancialSummary } from "../../api/financial";
import type { FinancialDailySummary } from "../../types/financial";
import { toDateInputValue } from "../../utils/dates";

export async function loadDailySummary(headers: Record<string, string>, date: string) {
  const summary = await getFinancialSummary(headers, {
    period: "custom",
    customStartDate: date,
    customEndDate: date,
    vehicleId: "",
  });
  return summary.daily.find((day) => day.date === date) ?? null;
}

export function useTodaySummary(token: string | null, onSessionExpired?: (message: string) => void) {
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [state, setState] = useState<{
    token: string | null;
    date: string;
    daily: FinancialDailySummary | null;
    isLoading: boolean;
    error: string;
  }>({ token: null, date, daily: null, isLoading: true, error: "" });
  const request = useRef(createLatestRequest());
  const context = useRef({ token, date, onSessionExpired });
  context.current = { token, date, onSessionExpired };

  useEffect(() => {
    let timer: number;
    const updateDate = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setDate(toDateInputValue(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(updateDate, midnight.getTime() - now.getTime());
    };
    updateDate();
    window.addEventListener("focus", updateDate);
    document.addEventListener("visibilitychange", updateDate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", updateDate);
      document.removeEventListener("visibilitychange", updateDate);
    };
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (!token || context.current.token !== token || context.current.date !== date) return;
    if (refresh) request.current.invalidate();
    await request.current.run(JSON.stringify([token, date]), async (isLatest) => {
      const isCurrent = () => isLatest() && context.current.token === token && context.current.date === date;
      if (!isCurrent()) return;
      setState({ token, date, daily: null, isLoading: true, error: "" });
      try {
        const daily = await loadDailySummary({ Authorization: `Bearer ${token}` }, date);
        if (isCurrent()) setState({ token, date, daily, isLoading: false, error: "" });
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : "Não foi possível carregar o resumo do dia.";
        setState({ token, date, daily: null, isLoading: false, error: message });
        if (message === SESSION_EXPIRED_MESSAGE) context.current.onSessionExpired?.(message);
      }
    });
  }, [token, date]);

  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(() => { if (!disposed) void load(); });
    return () => {
      disposed = true;
      request.current.invalidate();
    };
  }, [load]);

  const isCurrent = state.date === date && state.token === token;
  return {
    date,
    daily: isCurrent ? state.daily : null,
    isLoading: !isCurrent || state.isLoading,
    error: isCurrent ? state.error : "",
    reload,
  };
}
