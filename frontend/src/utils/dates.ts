import type {
  DashboardPeriod,
  FinancialHistoryGrouping,
  HistoryPeriodPreset,
} from "../types/domain";

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getInclusiveDateCount(startDate: string, endDate: string): number {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
}

export function getPeriodDates(
  period: DashboardPeriod,
  customStartDate: string,
  customEndDate: string,
) {
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

export function getHistoryPeriodDates(
  period: HistoryPeriodPreset,
  customStartDate: string,
  customEndDate: string,
) {
  const today = new Date();

  if (period === "last7") {
    return { startDate: toDateInputValue(addDays(today, -6)), endDate: toDateInputValue(today) };
  }

  if (period === "last30") {
    return { startDate: toDateInputValue(addDays(today, -29)), endDate: toDateInputValue(today) };
  }

  if (period === "last90") {
    return { startDate: toDateInputValue(addDays(today, -89)), endDate: toDateInputValue(today) };
  }

  if (period === "month") {
    return {
      startDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: toDateInputValue(today),
    };
  }

  return { startDate: customStartDate, endDate: customEndDate };
}

export function getDefaultHistoryGrouping(
  startDate: string,
  endDate: string,
): FinancialHistoryGrouping {
  const days = getInclusiveDateCount(startDate, endDate);
  if (days <= 14) {
    return "daily";
  }

  if (days <= 60) {
    return "weekly";
  }

  return "monthly";
}
