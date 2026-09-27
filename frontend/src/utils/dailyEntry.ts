import { toDateInputValue } from "./dates";

export function getDailyEntryDate(selectedDate: string, now = new Date()): string {
  return selectedDate || toDateInputValue(now);
}

export function readLastDailyVehicle(userId: number): string {
  try {
    const value = localStorage.getItem(`ganhocerto.dailyVehicle.${userId}`) ?? "";
    return /^\d+$/.test(value) ? value : "";
  } catch {
    return "";
  }
}

export function writeLastDailyVehicle(userId: number, vehicleId: string): void {
  try {
    const key = `ganhocerto.dailyVehicle.${userId}`;
    if (/^\d+$/.test(vehicleId)) {
      localStorage.setItem(key, vehicleId);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Remembering a choice is optional when browser storage is unavailable.
  }
}

export function getDefaultDailyVehicleId(
  vehicleIds: number[],
  currentVehicleId: string,
  lastSelectedVehicleId: string,
): string {
  const availableIds = new Set(vehicleIds.map(String));

  if (availableIds.has(currentVehicleId)) {
    return currentVehicleId;
  }

  if (availableIds.has(lastSelectedVehicleId)) {
    return lastSelectedVehicleId;
  }

  return vehicleIds.length === 1 ? String(vehicleIds[0]) : "";
}
