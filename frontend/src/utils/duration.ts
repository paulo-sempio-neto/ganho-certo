export function parseDurationToMinutes(value: string): number {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(?::|h)\s*(\d{1,2})\s*m?$/) ?? normalized.match(/^(\d+)\s*h$/);
  const hoursOnly = normalized.match(/^(\d+)$/);

  if (!match && !hoursOnly) {
    throw new Error("Informe o tempo trabalhado, por exemplo 8:30.");
  }

  const hours = Number((match ?? hoursOnly)?.[1]);
  const minutes = match?.[2] ? Number(match[2]) : 0;
  const totalMinutes = hours * 60 + minutes;

  if (
    !Number.isSafeInteger(hours) ||
    !Number.isSafeInteger(minutes) ||
    minutes > 59 ||
    !Number.isSafeInteger(totalMinutes) ||
    totalMinutes <= 0
  ) {
    throw new Error("Verifique o tempo trabalhado.");
  }

  return totalMinutes;
}

export function formatDurationInput(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}
