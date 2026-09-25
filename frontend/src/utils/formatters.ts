import type { CsvImportType } from "../types/domain";

export function formatDistance(value: string): string {
  return value.replace(".", ",");
}

export function formatWorkTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} bytes`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1).replace(".", ",")} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function getImportFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    date: "Data",
    gross_revenue: "Faturamento",
    distance_km: "Km rodados",
    worked_minutes: "Minutos trabalhados",
    trip_count: "Corridas",
    expense_date: "Data",
    amount: "Valor",
    category: "Categoria",
    description: "Descricao",
    header: "CabeÃ§alho",
    file: "Arquivo",
  };

  return labels[field] ?? field;
}

export function getImportProfileTypeLabel(importType: CsvImportType): string {
  return importType === "expenses" ? "Despesas" : "Jornadas";
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function formatPercent(value: string | null): string {
  if (value === null) {
    return "â€”";
  }

  const normalized = value.replace(".", ",");
  return normalized.endsWith(",00") ? `${normalized.slice(0, -3)}%` : `${normalized}%`;
}

export function getProgressWidth(value: string | null): string {
  if (value === null) {
    return "0%";
  }

  const percentage = Number(value);
  if (!Number.isFinite(percentage)) {
    return "0%";
  }

  return `${Math.min(100, Math.max(0, percentage))}%`;
}

export function formatHours(value: string | null): string {
  if (value === null) {
    return "â€”";
  }

  return `${value.replace(".", ",")} h`;
}
