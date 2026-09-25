import { requestApi } from "./client";
import type { Vehicle } from "../types/domain";

type AuthHeaders = Record<string, string>;

export function listVehicles(headers: AuthHeaders) {
  return requestApi<Vehicle[]>("/vehicles", { headers });
}

export function createVehicle(headers: AuthHeaders, payload: unknown) {
  return requestApi<Vehicle>("/vehicles", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export function updateVehicle(headers: AuthHeaders, vehicleId: number, payload: unknown) {
  return requestApi<Vehicle>(`/vehicles/${vehicleId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

export function deleteVehicle(headers: AuthHeaders, vehicleId: number) {
  return requestApi<void>(`/vehicles/${vehicleId}`, {
    method: "DELETE",
    headers,
  });
}
