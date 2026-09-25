import { requestApi } from "./client";
import type {
  CsvImportColumnMapping,
  CsvImportProfile,
  CsvImportProfileMatchResponse,
  CsvImportType,
  ExpenseImportMapping,
  ExpenseImportPreview,
  ExpenseImportResult,
  WorkSessionImportMapping,
  WorkSessionImportPreview,
  WorkSessionImportResult,
} from "../types/domain";

type AuthHeaders = Record<string, string>;

type CreateImportProfilePayload = {
  name: string;
  import_type: CsvImportType;
  headers: string[];
  column_mapping: CsvImportColumnMapping;
  vehicle_id: number | null;
};

function buildColumnMappingParam(mapping: Partial<Record<string, string>>): string | null {
  const entries = Object.entries(mapping).filter(([, value]) => value);
  if (entries.length === 0) {
    return null;
  }

  return JSON.stringify(Object.fromEntries(entries));
}

function buildWorkSessionImportPath(
  preview: boolean,
  vehicleId: string,
  mapping: Partial<WorkSessionImportMapping> = {},
): string {
  const params = new URLSearchParams({ vehicle_id: vehicleId });
  const mappingParam = buildColumnMappingParam(mapping);
  if (mappingParam) {
    params.set("column_mapping", mappingParam);
  }

  return `/imports/work-sessions${preview ? "/preview" : ""}?${params.toString()}`;
}

function buildExpenseImportPath(
  preview: boolean,
  vehicleId: string,
  mapping: Partial<ExpenseImportMapping> = {},
): string {
  const params = new URLSearchParams();
  if (vehicleId) {
    params.set("vehicle_id", vehicleId);
  }

  const mappingParam = buildColumnMappingParam(mapping);
  if (mappingParam) {
    params.set("column_mapping", mappingParam);
  }

  const query = params.toString();
  return `/imports/expenses${preview ? "/preview" : ""}${query ? `?${query}` : ""}`;
}

export function listImportProfiles(headers: AuthHeaders) {
  return requestApi<CsvImportProfile[]>("/import-profiles", { headers });
}

export function matchImportProfile(
  headers: AuthHeaders,
  importType: CsvImportType,
  csvHeaders: string[],
) {
  return requestApi<CsvImportProfileMatchResponse>("/import-profiles/match", {
    method: "POST",
    headers,
    body: JSON.stringify({ import_type: importType, headers: csvHeaders }),
  });
}

export function createImportProfile(headers: AuthHeaders, payload: CreateImportProfilePayload) {
  return requestApi<CsvImportProfile>("/import-profiles", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export function renameImportProfile(headers: AuthHeaders, profileId: number, name: string) {
  return requestApi<CsvImportProfile>(`/import-profiles/${profileId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ name }),
  });
}

export function deleteImportProfile(headers: AuthHeaders, profileId: number) {
  return requestApi<void>(`/import-profiles/${profileId}`, {
    method: "DELETE",
    headers,
  });
}

export function previewWorkSessionImport(
  headers: AuthHeaders,
  vehicleId: string,
  mapping: Partial<WorkSessionImportMapping>,
  file: File,
) {
  return requestApi<WorkSessionImportPreview>(
    buildWorkSessionImportPath(true, vehicleId, mapping),
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "text/csv",
      },
      body: file,
    },
  );
}

export function executeWorkSessionImport(
  headers: AuthHeaders,
  vehicleId: string,
  mapping: Partial<WorkSessionImportMapping>,
  file: File,
) {
  return requestApi<WorkSessionImportResult>(
    buildWorkSessionImportPath(false, vehicleId, mapping),
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "text/csv",
      },
      body: file,
    },
  );
}

export function previewExpenseImport(
  headers: AuthHeaders,
  vehicleId: string,
  mapping: Partial<ExpenseImportMapping>,
  file: File,
) {
  return requestApi<ExpenseImportPreview>(buildExpenseImportPath(true, vehicleId, mapping), {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "text/csv",
    },
    body: file,
  });
}

export function executeExpenseImport(
  headers: AuthHeaders,
  vehicleId: string,
  mapping: Partial<ExpenseImportMapping>,
  file: File,
) {
  return requestApi<ExpenseImportResult>(buildExpenseImportPath(false, vehicleId, mapping), {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "text/csv",
    },
    body: file,
  });
}
