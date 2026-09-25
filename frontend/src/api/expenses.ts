import { requestApi } from "./client";
import type { Expense, RecurringExpense } from "../types/domain";

type AuthHeaders = Record<string, string>;

export function listExpenses(headers: AuthHeaders) {
  return requestApi<Expense[]>("/expenses", { headers });
}

export function createExpense(headers: AuthHeaders, payload: unknown) {
  return requestApi<Expense>("/expenses", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export function updateExpense(headers: AuthHeaders, expenseId: number, payload: unknown) {
  return requestApi<Expense>(`/expenses/${expenseId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

export function deleteExpense(headers: AuthHeaders, expenseId: number) {
  return requestApi<void>(`/expenses/${expenseId}`, {
    method: "DELETE",
    headers,
  });
}

export function listRecurringExpenses(headers: AuthHeaders) {
  return requestApi<RecurringExpense[]>("/recurring-expenses", { headers });
}

export function createRecurringExpense(headers: AuthHeaders, payload: unknown) {
  return requestApi<RecurringExpense>("/recurring-expenses", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export function updateRecurringExpense(
  headers: AuthHeaders,
  recurringExpenseId: number,
  payload: unknown,
) {
  return requestApi<RecurringExpense>(`/recurring-expenses/${recurringExpenseId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

export function deleteRecurringExpense(headers: AuthHeaders, recurringExpenseId: number) {
  return requestApi<void>(`/recurring-expenses/${recurringExpenseId}`, {
    method: "DELETE",
    headers,
  });
}
