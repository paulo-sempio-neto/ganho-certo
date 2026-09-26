import { ChangeEvent, DragEvent, useEffect, useState } from "react";

import {
  createImportProfile,
  deleteImportProfile,
  executeExpenseImport,
  executeWorkSessionImport,
  listImportProfiles,
  matchImportProfile,
  previewExpenseImport,
  previewWorkSessionImport,
  renameImportProfile,
} from "../../api/imports";
import type {
  CsvImportColumnMapping,
  CsvImportProfile,
  ExpenseCategory,
  ExpenseImportField,
  ExpenseImportMapping,
  ExpenseImportPreview,
  ExpenseImportResult,
  Vehicle,
  WorkSessionImportField,
  WorkSessionImportMapping,
  WorkSessionImportPreview,
  WorkSessionImportResult,
} from "../../types/domain";
import {
  formatDate,
  formatDistance,
  formatFileSize,
  formatWorkTime,
  getImportFieldLabel,
  getImportProfileTypeLabel,
} from "../../utils/formatters";
import { formatMoney } from "../../utils/money";

const emptyWorkSessionImportMapping: WorkSessionImportMapping = {
  date: "",
  gross_revenue: "",
  distance_km: "",
  worked_minutes: "",
  trip_count: "",
};

const emptyExpenseImportMapping: ExpenseImportMapping = {
  expense_date: "",
  amount: "",
  category: "",
  description: "",
};

const workSessionImportMappingFields: Array<{
  field: WorkSessionImportField;
  label: string;
  optional?: boolean;
}> = [
  { field: "date", label: "Data" },
  { field: "gross_revenue", label: "Faturamento" },
  { field: "distance_km", label: "Km" },
  { field: "worked_minutes", label: "Tempo trabalhado" },
  { field: "trip_count", label: "Corridas", optional: true },
];

const expenseImportMappingFields: Array<{
  field: ExpenseImportField;
  label: string;
  optional?: boolean;
}> = [
  { field: "expense_date", label: "Data" },
  { field: "amount", label: "Valor" },
  { field: "category", label: "Categoria", optional: true },
  { field: "description", label: "Descricao", optional: true },
];

export type CsvImportSectionProps = {
  type: "work_sessions" | "expenses";
  token: string | null;
  vehicles: Vehicle[];
  getAuthHeaders: (currentToken?: string | null) => Record<string, string>;
  getVehicleLabel: (vehicleId: number) => string;
  getExpenseCategoryLabel: (category: ExpenseCategory) => string;
  endSession: (message: string) => void;
  setMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  loadWorkSessions: () => Promise<void>;
  loadExpenses: () => Promise<void>;
  refreshDashboardData: () => Promise<void>;
};

function profileToWorkSessionImportMapping(
  mapping: CsvImportColumnMapping | null,
): WorkSessionImportMapping {
  return {
    ...emptyWorkSessionImportMapping,
    date: mapping?.date ?? "",
    gross_revenue: mapping?.gross_revenue ?? "",
    distance_km: mapping?.distance_km ?? "",
    worked_minutes: mapping?.worked_minutes ?? "",
    trip_count: mapping?.trip_count ?? "",
  };
}

function profileToExpenseImportMapping(mapping: CsvImportColumnMapping | null): ExpenseImportMapping {
  return {
    ...emptyExpenseImportMapping,
    expense_date: mapping?.expense_date ?? "",
    amount: mapping?.amount ?? "",
    category: mapping?.category ?? "",
    description: mapping?.description ?? "",
  };
}

function previewToWorkSessionImportMapping(
  preview: WorkSessionImportPreview,
): WorkSessionImportMapping {
  return {
    ...emptyWorkSessionImportMapping,
    ...preview.suggested_mapping,
    ...preview.column_mapping,
  };
}

function previewToExpenseImportMapping(preview: ExpenseImportPreview): ExpenseImportMapping {
  return {
    ...emptyExpenseImportMapping,
    ...preview.suggested_mapping,
    ...preview.column_mapping,
  };
}

function areWorkSessionImportMappingsEqual(
  first: Partial<Record<WorkSessionImportField, string>>,
  second: CsvImportColumnMapping,
): boolean {
  return workSessionImportMappingFields.every(
    (item) => (first[item.field] ?? "") === (second[item.field] ?? ""),
  );
}

function areExpenseImportMappingsEqual(
  first: Partial<Record<ExpenseImportField, string>>,
  second: CsvImportColumnMapping,
): boolean {
  return expenseImportMappingFields.every(
    (item) => (first[item.field] ?? "") === (second[item.field] ?? ""),
  );
}

function downloadCsvTemplate(csvTemplate: string, filename: string) {
  const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CsvImportSection({
  isVisible,
  type,
  token,
  vehicles,
  getAuthHeaders,
  getVehicleLabel,
  getExpenseCategoryLabel,
  endSession,
  setMessage,
  setSuccessMessage,
  loadWorkSessions,
  loadExpenses,
  refreshDashboardData,
}: CsvImportSectionProps & { isVisible: boolean }) {
  const [importProfiles, setImportProfiles] = useState<CsvImportProfile[]>([]);
  const [isImportProfilesLoading, setIsImportProfilesLoading] = useState(false);
  const [isImportProfileSaving, setIsImportProfileSaving] = useState(false);

  const [workSessionImportVehicleId, setWorkSessionImportVehicleId] = useState("");
  const [workSessionImportFile, setWorkSessionImportFile] = useState<File | null>(null);
  const [workSessionImportPreview, setWorkSessionImportPreview] =
    useState<WorkSessionImportPreview | null>(null);
  const [workSessionImportColumns, setWorkSessionImportColumns] = useState<string[]>([]);
  const [workSessionImportMapping, setWorkSessionImportMapping] =
    useState<WorkSessionImportMapping>(emptyWorkSessionImportMapping);
  const [workSessionImportResult, setWorkSessionImportResult] =
    useState<WorkSessionImportResult | null>(null);
  const [workSessionImportError, setWorkSessionImportError] = useState("");
  const [workSessionImportProfileName, setWorkSessionImportProfileName] = useState("");
  const [matchedWorkSessionImportProfile, setMatchedWorkSessionImportProfile] =
    useState<CsvImportProfile | null>(null);
  const isWorkSessionImportVisible = type === "work_sessions" && isVisible;
  const [isWorkSessionImportMappingVisible, setIsWorkSessionImportMappingVisible] = useState(false);
  const [isWorkSessionImportDragging, setIsWorkSessionImportDragging] = useState(false);
  const [isWorkSessionImportPreviewLoading, setIsWorkSessionImportPreviewLoading] =
    useState(false);
  const [isWorkSessionImportSaving, setIsWorkSessionImportSaving] = useState(false);

  const [expenseImportVehicleId, setExpenseImportVehicleId] = useState("");
  const [expenseImportFile, setExpenseImportFile] = useState<File | null>(null);
  const [expenseImportPreview, setExpenseImportPreview] = useState<ExpenseImportPreview | null>(
    null,
  );
  const [expenseImportColumns, setExpenseImportColumns] = useState<string[]>([]);
  const [expenseImportMapping, setExpenseImportMapping] =
    useState<ExpenseImportMapping>(emptyExpenseImportMapping);
  const [expenseImportResult, setExpenseImportResult] = useState<ExpenseImportResult | null>(null);
  const [expenseImportError, setExpenseImportError] = useState("");
  const [expenseImportProfileName, setExpenseImportProfileName] = useState("");
  const [matchedExpenseImportProfile, setMatchedExpenseImportProfile] =
    useState<CsvImportProfile | null>(null);
  const isExpenseImportVisible = type === "expenses" && isVisible;
  const [isExpenseImportMappingVisible, setIsExpenseImportMappingVisible] = useState(false);
  const [isExpenseImportDragging, setIsExpenseImportDragging] = useState(false);
  const [isExpenseImportPreviewLoading, setIsExpenseImportPreviewLoading] = useState(false);
  const [isExpenseImportSaving, setIsExpenseImportSaving] = useState(false);

  async function loadProfiles(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setIsImportProfilesLoading(true);
    try {
      const nextProfiles = await listImportProfiles(getAuthHeaders(currentToken));
      setImportProfiles(nextProfiles);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Erro ao carregar configuracoes de importacao.",
        );
      }
    } finally {
      setIsImportProfilesLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setImportProfiles([]);
      return;
    }

    void loadProfiles(token);
  }, [token]);

  useEffect(() => {
    setWorkSessionImportVehicleId((currentVehicleId) => {
      if (vehicles.length === 1) {
        return String(vehicles[0].id);
      }

      if (vehicles.some((vehicle) => String(vehicle.id) === currentVehicleId)) {
        return currentVehicleId;
      }

      return "";
    });

    setExpenseImportVehicleId((currentVehicleId) => {
      if (vehicles.some((vehicle) => String(vehicle.id) === currentVehicleId)) {
        return currentVehicleId;
      }

      return "";
    });
  }, [vehicles]);

  function getWorkSessionImportVehicleLabel(): string {
    const vehicle = vehicles.find((item) => String(item.id) === workSessionImportVehicleId);
    return vehicle ? `${vehicle.name} - ${vehicle.brand} ${vehicle.model}` : "veículo selecionado";
  }

  function getImportProfileVehicleLabel(profile: CsvImportProfile): string {
    if (!profile.vehicle_id) {
      return "Sem veiculo salvo";
    }

    return getVehicleLabel(profile.vehicle_id);
  }

  function clearWorkSessionImportFile() {
    setWorkSessionImportFile(null);
    setWorkSessionImportPreview(null);
    setWorkSessionImportColumns([]);
    setWorkSessionImportMapping(emptyWorkSessionImportMapping);
    setWorkSessionImportResult(null);
    setWorkSessionImportError("");
    setWorkSessionImportProfileName("");
    setMatchedWorkSessionImportProfile(null);
    setIsWorkSessionImportMappingVisible(false);
    setIsWorkSessionImportDragging(false);
  }

  function handleWorkSessionImportFile(file: File | null) {
    if (!file) {
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    if (!isCsv) {
      clearWorkSessionImportFile();
      setWorkSessionImportError("Selecione um arquivo CSV.");
      return;
    }

    setWorkSessionImportFile(file);
    setWorkSessionImportPreview(null);
    setWorkSessionImportColumns([]);
    setWorkSessionImportMapping(emptyWorkSessionImportMapping);
    setWorkSessionImportResult(null);
    setWorkSessionImportError("");
    setWorkSessionImportProfileName("");
    setMatchedWorkSessionImportProfile(null);
    setIsWorkSessionImportMappingVisible(false);
  }

  function handleWorkSessionImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleWorkSessionImportFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleWorkSessionImportDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsWorkSessionImportDragging(false);
    handleWorkSessionImportFile(event.dataTransfer.files[0] ?? null);
  }

  function downloadWorkSessionImportTemplate() {
    downloadCsvTemplate(
      "date,gross_revenue,distance_km,worked_minutes,trip_count\n" +
        "2026-09-20,350.50,180.4,480,22\n" +
        "2026-09-21,410.00,205.0,530,25\n",
      "modelo-jornadas-ganhocerto.csv",
    );
  }

  async function matchWorkSessionProfile(headers: string[], preview: WorkSessionImportPreview) {
    if (!headers.length) {
      setMatchedWorkSessionImportProfile(null);
      return;
    }

    try {
      const match = await matchImportProfile(getAuthHeaders(), "work_sessions", headers);
      if (!match.profile) {
        setMatchedWorkSessionImportProfile(null);
        return;
      }

      setMatchedWorkSessionImportProfile(match.profile);
      setWorkSessionImportMapping(profileToWorkSessionImportMapping(match.column_mapping));
      setIsWorkSessionImportMappingVisible(false);
      if (
        match.column_mapping &&
        !areWorkSessionImportMappingsEqual(preview.column_mapping, match.column_mapping)
      ) {
        setWorkSessionImportPreview(null);
      }
      if (match.vehicle_id && vehicles.some((vehicle) => vehicle.id === match.vehicle_id)) {
        setWorkSessionImportVehicleId(String(match.vehicle_id));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      }
    }
  }

  async function handleSaveWorkSessionImportProfile() {
    if (
      !workSessionImportPreview ||
      workSessionImportPreview.invalid_rows > 0 ||
      !workSessionImportColumns.length ||
      !workSessionImportProfileName.trim()
    ) {
      return;
    }

    setIsImportProfileSaving(true);
    setWorkSessionImportError("");
    setExpenseImportError("");

    try {
      const profile = await createImportProfile(getAuthHeaders(), {
        name: workSessionImportProfileName,
        import_type: "work_sessions",
        headers: workSessionImportColumns,
        column_mapping: workSessionImportPreview.column_mapping,
        vehicle_id: workSessionImportVehicleId ? Number(workSessionImportVehicleId) : null,
      });
      setMatchedWorkSessionImportProfile(profile);
      setWorkSessionImportProfileName("");
      setSuccessMessage("Configuracao de importacao salva.");
      await loadProfiles();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setWorkSessionImportError(
          error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao.",
        );
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleRenameImportProfile(profile: CsvImportProfile) {
    const nextName = window.prompt("Novo nome da configuracao", profile.name)?.trim();
    if (!nextName || nextName === profile.name) {
      return;
    }

    setIsImportProfileSaving(true);
    setWorkSessionImportError("");

    try {
      const updatedProfile = await renameImportProfile(getAuthHeaders(), profile.id, nextName);
      setImportProfiles((currentProfiles) =>
        currentProfiles.map((item) => (item.id === updatedProfile.id ? updatedProfile : item)),
      );
      if (matchedWorkSessionImportProfile?.id === updatedProfile.id) {
        setMatchedWorkSessionImportProfile(updatedProfile);
      }
      if (matchedExpenseImportProfile?.id === updatedProfile.id) {
        setMatchedExpenseImportProfile(updatedProfile);
      }
      setSuccessMessage("Configuracao renomeada.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Nao foi possivel renomear a configuracao.";
        setWorkSessionImportError(errorMessage);
        setExpenseImportError(errorMessage);
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleDeleteImportProfile(profile: CsvImportProfile) {
    const shouldDelete = window.confirm(`Excluir configuracao "${profile.name}"?`);
    if (!shouldDelete) {
      return;
    }

    setIsImportProfileSaving(true);
    setWorkSessionImportError("");
    setExpenseImportError("");

    try {
      await deleteImportProfile(getAuthHeaders(), profile.id);
      setImportProfiles((currentProfiles) =>
        currentProfiles.filter((item) => item.id !== profile.id),
      );
      if (matchedWorkSessionImportProfile?.id === profile.id) {
        setMatchedWorkSessionImportProfile(null);
      }
      if (matchedExpenseImportProfile?.id === profile.id) {
        setMatchedExpenseImportProfile(null);
      }
      setSuccessMessage("Configuracao excluida.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Nao foi possivel excluir a configuracao.";
        setWorkSessionImportError(errorMessage);
        setExpenseImportError(errorMessage);
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleWorkSessionImportPreview() {
    if (!workSessionImportVehicleId) {
      setWorkSessionImportError("Selecione um veículo para importar as jornadas.");
      return;
    }

    if (!workSessionImportFile) {
      setWorkSessionImportError("Selecione um arquivo CSV para continuar.");
      return;
    }

    setIsWorkSessionImportPreviewLoading(true);
    setWorkSessionImportError("");
    setWorkSessionImportResult(null);

    try {
      const preview = await previewWorkSessionImport(
        getAuthHeaders(),
        workSessionImportVehicleId,
        workSessionImportMapping,
        workSessionImportFile,
      );
      const nextMapping = previewToWorkSessionImportMapping(preview);
      setWorkSessionImportPreview(preview);
      setWorkSessionImportColumns(preview.columns_found);
      setWorkSessionImportMapping(nextMapping);
      setIsWorkSessionImportMappingVisible(
        !workSessionImportMappingFields.every(
          (item) => item.optional || Boolean(nextMapping[item.field]),
        ),
      );
      await matchWorkSessionProfile(preview.columns_found, preview);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setWorkSessionImportPreview(null);
        setWorkSessionImportError(
          error instanceof Error ? error.message : "Não foi possível validar o CSV.",
        );
      }
    } finally {
      setIsWorkSessionImportPreviewLoading(false);
    }
  }

  async function handleConfirmWorkSessionImport() {
    if (!workSessionImportPreview || !workSessionImportFile || !workSessionImportVehicleId) {
      return;
    }

    if (workSessionImportPreview.invalid_rows > 0 || workSessionImportPreview.valid_rows === 0) {
      return;
    }

    const shouldImport = window.confirm(
      `Confirmar importação de ${workSessionImportPreview.valid_rows} jornadas para ${getWorkSessionImportVehicleLabel()}?`,
    );
    if (!shouldImport) {
      return;
    }

    setIsWorkSessionImportSaving(true);
    setWorkSessionImportError("");
    setWorkSessionImportResult(null);

    try {
      const result = await executeWorkSessionImport(
        getAuthHeaders(),
        workSessionImportVehicleId,
        workSessionImportPreview.column_mapping,
        workSessionImportFile,
      );
      setWorkSessionImportResult(result);
      setWorkSessionImportPreview(null);
      setWorkSessionImportFile(null);
      setWorkSessionImportColumns([]);
      setWorkSessionImportMapping(emptyWorkSessionImportMapping);
      setMatchedWorkSessionImportProfile(null);
      setWorkSessionImportProfileName("");
      setSuccessMessage("Importação concluída.");
      await loadWorkSessions();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setWorkSessionImportError(
          error instanceof Error ? error.message : "Não foi possível importar o CSV.",
        );
      }
    } finally {
      setIsWorkSessionImportSaving(false);
    }
  }

  function clearExpenseImportFile() {
    setExpenseImportFile(null);
    setExpenseImportPreview(null);
    setExpenseImportColumns([]);
    setExpenseImportMapping(emptyExpenseImportMapping);
    setExpenseImportResult(null);
    setExpenseImportError("");
    setExpenseImportProfileName("");
    setMatchedExpenseImportProfile(null);
    setIsExpenseImportMappingVisible(false);
    setIsExpenseImportDragging(false);
  }

  function handleExpenseImportFile(file: File | null) {
    if (!file) {
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    if (!isCsv) {
      clearExpenseImportFile();
      setExpenseImportError("Selecione um arquivo CSV.");
      return;
    }

    setExpenseImportFile(file);
    setExpenseImportPreview(null);
    setExpenseImportColumns([]);
    setExpenseImportMapping(emptyExpenseImportMapping);
    setExpenseImportResult(null);
    setExpenseImportError("");
    setExpenseImportProfileName("");
    setMatchedExpenseImportProfile(null);
    setIsExpenseImportMappingVisible(false);
  }

  function handleExpenseImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleExpenseImportFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleExpenseImportDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsExpenseImportDragging(false);
    handleExpenseImportFile(event.dataTransfer.files[0] ?? null);
  }

  function downloadExpenseImportTemplate() {
    downloadCsvTemplate(
      "expense_date,amount,category,description\n" +
        "2026-09-20,95.50,fuel,Abastecimento\n" +
        "2026-09-21,18.00,toll,Pedagio\n",
      "modelo-despesas-ganhocerto.csv",
    );
  }

  async function matchExpenseProfile(headers: string[], preview: ExpenseImportPreview) {
    if (!headers.length) {
      setMatchedExpenseImportProfile(null);
      return;
    }

    try {
      const match = await matchImportProfile(getAuthHeaders(), "expenses", headers);
      if (!match.profile) {
        setMatchedExpenseImportProfile(null);
        return;
      }

      setMatchedExpenseImportProfile(match.profile);
      setExpenseImportMapping(profileToExpenseImportMapping(match.column_mapping));
      setIsExpenseImportMappingVisible(false);
      if (
        match.column_mapping &&
        !areExpenseImportMappingsEqual(preview.column_mapping, match.column_mapping)
      ) {
        setExpenseImportPreview(null);
      }
      if (match.vehicle_id && vehicles.some((vehicle) => vehicle.id === match.vehicle_id)) {
        setExpenseImportVehicleId(String(match.vehicle_id));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      }
    }
  }

  function handleIgnoreExpenseImportProfile() {
    setMatchedExpenseImportProfile(null);
    if (expenseImportPreview) {
      setExpenseImportMapping(previewToExpenseImportMapping(expenseImportPreview));
    }
  }

  async function handleSaveExpenseImportProfile() {
    if (
      !expenseImportPreview ||
      expenseImportPreview.invalid_rows > 0 ||
      !expenseImportColumns.length
    ) {
      return;
    }

    setIsImportProfileSaving(true);
    setExpenseImportError("");

    try {
      const profile = await createImportProfile(getAuthHeaders(), {
        name: expenseImportProfileName.trim() || "Despesas CSV",
        import_type: "expenses",
        headers: expenseImportColumns,
        column_mapping: expenseImportPreview.column_mapping,
        vehicle_id: expenseImportVehicleId ? Number(expenseImportVehicleId) : null,
      });
      setMatchedExpenseImportProfile(profile);
      setExpenseImportProfileName("");
      setSuccessMessage("Configuracao de importacao salva.");
      await loadProfiles();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setExpenseImportError(
          error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao.",
        );
      }
    } finally {
      setIsImportProfileSaving(false);
    }
  }

  async function handleExpenseImportPreview() {
    if (!expenseImportFile) {
      setExpenseImportError("Selecione um arquivo CSV para continuar.");
      return;
    }

    setIsExpenseImportPreviewLoading(true);
    setExpenseImportError("");
    setExpenseImportResult(null);

    try {
      const preview = await previewExpenseImport(
        getAuthHeaders(),
        expenseImportVehicleId,
        expenseImportMapping,
        expenseImportFile,
      );
      const nextMapping = previewToExpenseImportMapping(preview);
      setExpenseImportPreview(preview);
      setExpenseImportColumns(preview.columns_found);
      setExpenseImportMapping(nextMapping);
      setIsExpenseImportMappingVisible(
        !expenseImportMappingFields.every(
          (item) => item.optional || Boolean(nextMapping[item.field]),
        ),
      );
      await matchExpenseProfile(preview.columns_found, preview);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setExpenseImportPreview(null);
        setExpenseImportError(
          error instanceof Error ? error.message : "Nao foi possivel validar o CSV.",
        );
      }
    } finally {
      setIsExpenseImportPreviewLoading(false);
    }
  }

  async function handleConfirmExpenseImport() {
    if (!expenseImportPreview || !expenseImportFile) {
      return;
    }

    if (expenseImportPreview.invalid_rows > 0 || expenseImportPreview.valid_rows === 0) {
      return;
    }

    const shouldImport = window.confirm(
      `Confirmar importacao de ${expenseImportPreview.valid_rows} despesas?`,
    );
    if (!shouldImport) {
      return;
    }

    setIsExpenseImportSaving(true);
    setExpenseImportError("");
    setExpenseImportResult(null);

    try {
      const result = await executeExpenseImport(
        getAuthHeaders(),
        expenseImportVehicleId,
        expenseImportPreview.column_mapping,
        expenseImportFile,
      );
      setExpenseImportResult(result);
      setExpenseImportPreview(null);
      setExpenseImportFile(null);
      setExpenseImportColumns([]);
      setExpenseImportMapping(emptyExpenseImportMapping);
      setMatchedExpenseImportProfile(null);
      setExpenseImportProfileName("");
      setSuccessMessage("Importacao concluida.");
      await loadExpenses();
      await refreshDashboardData();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setExpenseImportError(
          error instanceof Error ? error.message : "Nao foi possivel importar o CSV.",
        );
      }
    } finally {
      setIsExpenseImportSaving(false);
    }
  }

  const workSessionProfiles = importProfiles.filter(
    (profile) => profile.import_type === "work_sessions",
  );
  const expenseProfiles = importProfiles.filter((profile) => profile.import_type === "expenses");

  if (type === "work_sessions") {
    return (
      <>
        {isWorkSessionImportVisible ? (
          <div
            className="import-panel"
            aria-busy={
              isWorkSessionImportPreviewLoading ||
              isWorkSessionImportSaving ||
              isImportProfileSaving
            }
          >
            <div className="list-header">
              <div>
                <h3>Importar jornadas por CSV</h3>
                <p className="subtle-note">
                  Escolha o veículo, envie o arquivo e revise os registros antes de gravar.
                </p>
              </div>
              <button className="text-button" type="button" onClick={downloadWorkSessionImportTemplate}>
                Baixar modelo CSV
              </button>
            </div>

            <div className="import-template-help">
              <span>Data</span>
              <span>Faturamento</span>
              <span>Km rodados</span>
              <span>Tempo trabalhado</span>
              <span>Corridas</span>
            </div>

            <details className="import-preview secondary-import-options">
              <summary>Configurações salvas</summary>
              <div className="list-header">
                <div>
                  <h4>Modelos salvos</h4>
                  <p className="subtle-note">
                    Use modelos para lembrar colunas de arquivos iguais.
                  </p>
                </div>
                <button
                  className="text-button"
                  disabled={isImportProfilesLoading}
                  type="button"
                  onClick={() => void loadProfiles()}
                >
                  Atualizar
                </button>
              </div>
              {workSessionProfiles.length === 0 ? (
                <p className="subtle-note">Nenhuma configuracao salva ainda.</p>
              ) : (
                <div className="import-preview-list">
                  {workSessionProfiles.map((profile) => (
                    <article className="vehicle-card session-card" key={profile.id}>
                      <div>
                        <h4>{profile.name}</h4>
                        <p className="subtle-note">
                          {getImportProfileTypeLabel(profile.import_type)} ·{" "}
                          {getImportProfileVehicleLabel(profile)}
                        </p>
                      </div>
                      <div className="card-actions">
                        <button
                          className="text-button"
                          disabled={isImportProfileSaving}
                          type="button"
                          onClick={() => void handleRenameImportProfile(profile)}
                        >
                          Renomear
                        </button>
                        <button
                          className="text-button danger"
                          disabled={isImportProfileSaving}
                          type="button"
                          onClick={() => void handleDeleteImportProfile(profile)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </details>

            {vehicles.length === 0 ? (
              <p className="empty-state compact-empty-state">
                Cadastre um veículo antes de importar jornadas.{" "}
                <a href="#veiculos">Ir para Veículos</a>
              </p>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Veículo
                    <select
                      disabled={vehicles.length === 1}
                      onChange={(event) => setWorkSessionImportVehicleId(event.target.value)}
                      required
                      value={workSessionImportVehicleId}
                    >
                      <option value="">Selecione</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} - {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label
                    className={
                      isWorkSessionImportDragging
                        ? "import-dropzone import-dropzone-active"
                        : "import-dropzone"
                    }
                    onDragLeave={() => setIsWorkSessionImportDragging(false)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsWorkSessionImportDragging(true);
                    }}
                    onDrop={handleWorkSessionImportDrop}
                  >
                    <span>Selecionar ou arrastar CSV</span>
                    <small>Clique aqui ou solte o arquivo nesta área.</small>
                    <input
                      accept=".csv,text/csv"
                      type="file"
                      onChange={handleWorkSessionImportFileChange}
                    />
                  </label>
                </div>

                {workSessionImportFile ? (
                  <div className="import-file">
                    <div>
                      <strong>{workSessionImportFile.name}</strong>
                      <span>{formatFileSize(workSessionImportFile.size)}</span>
                    </div>
                    <button className="text-button danger" type="button" onClick={clearWorkSessionImportFile}>
                      Remover
                    </button>
                  </div>
                ) : null}

                {matchedWorkSessionImportProfile ? (
                  <p className="form-message compact-message">
                    Configuracao aplicada: {matchedWorkSessionImportProfile.name}.
                  </p>
                ) : null}

                {workSessionImportColumns.length && !isWorkSessionImportMappingVisible ? (
                  <p className="subtle-note">
                    Colunas reconhecidas.{" "}
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setIsWorkSessionImportMappingVisible(true)}
                    >
                      Editar colunas
                    </button>
                  </p>
                ) : null}

                {workSessionImportColumns.length && isWorkSessionImportMappingVisible ? (
                  <div className="import-mapping">
                    <div>
                      <h4>Qual coluna corresponde a cada informação?</h4>
                      <p className="subtle-note">
                        O GanhoCerto sugeriu o que encontrou. Confira e ajuste se precisar.
                      </p>
                    </div>
                    <div className="form-grid">
                      {workSessionImportMappingFields.map((item) => (
                        <label key={item.field}>
                          {item.label}
                          {item.optional ? " (opcional)" : ""}
                          <select
                            value={workSessionImportMapping[item.field]}
                            onChange={(event) => {
                              setWorkSessionImportMapping({
                                ...workSessionImportMapping,
                                [item.field]: event.target.value,
                              });
                              setWorkSessionImportPreview(null);
                              setWorkSessionImportResult(null);
                              setMatchedWorkSessionImportProfile(null);
                            }}
                          >
                            <option value="">
                              {item.optional ? "Sem coluna / usar 0" : "Selecione"}
                            </option>
                            {workSessionImportColumns.map((column) => (
                              <option key={`${item.field}-${column}`} value={column}>
                                {column}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="form-actions import-actions">
                  <button
                    className="button"
                    disabled={
                      isWorkSessionImportPreviewLoading ||
                      isWorkSessionImportSaving ||
                      !workSessionImportVehicleId ||
                      !workSessionImportFile
                    }
                    type="button"
                    onClick={() => void handleWorkSessionImportPreview()}
                  >
                    {isWorkSessionImportPreviewLoading
                      ? "Validando..."
                      : workSessionImportColumns.length
                        ? "Conferir registros"
                        : "Ler arquivo e conferir registros"}
                  </button>
                </div>

                {workSessionImportError ? (
                  <p className="form-message compact-message">{workSessionImportError}</p>
                ) : null}

                {workSessionImportPreview ? (
                  <div className="import-preview">
                    <dl className="session-metrics import-summary">
                      <div>
                        <dt>Total</dt>
                        <dd>{workSessionImportPreview.total_rows}</dd>
                      </div>
                      <div>
                        <dt>Válidas</dt>
                        <dd>{workSessionImportPreview.valid_rows}</dd>
                      </div>
                      <div>
                        <dt>Inválidas</dt>
                        <dd>{workSessionImportPreview.invalid_rows}</dd>
                      </div>
                    </dl>

                    {workSessionImportPreview.errors.length > 0 ? (
                      <div className="import-errors">
                        <h4>Corrija o CSV e envie novamente</h4>
                        {workSessionImportPreview.errors.map((error, index) => (
                          <article key={`${error.row}-${error.field}-${index}`}>
                            <strong>Linha {error.row}</strong>
                            <span>
                              {getImportFieldLabel(error.field)}: {error.message}
                            </span>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    {workSessionImportPreview.rows.length > 0 ? (
                      <div className="import-preview-list">
                        {workSessionImportPreview.rows.map((row) => (
                          <article className="vehicle-card session-card" key={row.row}>
                            <div>
                              <h4>{formatDate(row.date)}</h4>
                              <dl className="session-metrics">
                                <div>
                                  <dt>Faturamento</dt>
                                  <dd>{formatMoney(row.gross_revenue)}</dd>
                                </div>
                                <div>
                                  <dt>Km</dt>
                                  <dd>{formatDistance(row.distance_km)}</dd>
                                </div>
                                <div>
                                  <dt>Tempo</dt>
                                  <dd>{formatWorkTime(row.worked_minutes)}</dd>
                                </div>
                                <div>
                                  <dt>Corridas</dt>
                                  <dd>{row.trip_count}</dd>
                                </div>
                              </dl>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    {workSessionImportPreview.invalid_rows > 0 ? (
                      <p className="empty-state compact-empty-state">
                        Existem linhas inválidas. A importação só ficará disponível após corrigir o arquivo.
                      </p>
                    ) : (
                      <>
                        <div className="import-mapping">
                          <div>
                            <h4>Salvar esta configuracao</h4>
                            <p className="subtle-note">
                              Opcional: lembre este modelo para arquivos com as mesmas colunas.
                            </p>
                          </div>
                          <div className="form-grid">
                            <label>
                              Nome da configuracao
                              <input
                                onChange={(event) =>
                                  setWorkSessionImportProfileName(event.target.value)
                                }
                                placeholder="Ex.: CSV semanal do app"
                                value={workSessionImportProfileName}
                              />
                            </label>
                          </div>
                          <button
                            className="button button-ghost"
                            disabled={isImportProfileSaving || !workSessionImportProfileName.trim()}
                            type="button"
                            onClick={() => void handleSaveWorkSessionImportProfile()}
                          >
                            {isImportProfileSaving ? "Salvando..." : "Salvar configuracao"}
                          </button>
                        </div>

                        <button
                          className="button"
                          disabled={
                            isWorkSessionImportSaving ||
                            workSessionImportPreview.valid_rows === 0
                          }
                          type="button"
                          onClick={() => void handleConfirmWorkSessionImport()}
                        >
                          {isWorkSessionImportSaving
                            ? "Importando..."
                            : `Importar ${workSessionImportPreview.valid_rows} jornadas`}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}

                {workSessionImportResult ? (
                  <div className="import-result">
                    <h4>Importação concluída</h4>
                    <dl className="session-metrics import-summary">
                      <div>
                        <dt>Importadas</dt>
                        <dd>{workSessionImportResult.imported}</dd>
                      </div>
                      <div>
                        <dt>Duplicadas</dt>
                        <dd>{workSessionImportResult.duplicates_skipped}</dd>
                      </div>
                      <div>
                        <dt>Falhas</dt>
                        <dd>{workSessionImportResult.failed}</dd>
                      </div>
                    </dl>
                    {workSessionImportResult.duplicates_skipped > 0 ? (
                      <p className="subtle-note">
                        O GanhoCerto ignorou registros que já haviam sido importados.
                      </p>
                    ) : null}
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() =>
                        document.getElementById("lista-jornadas")?.scrollIntoView({
                          behavior: "smooth",
                        })
                      }
                    >
                      Ver minhas jornadas
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {isExpenseImportVisible ? (
        <div
          className="import-panel"
          aria-busy={
            isExpenseImportPreviewLoading || isExpenseImportSaving || isImportProfileSaving
          }
        >
          <div className="list-header">
            <div>
              <h3>Importar despesas por CSV</h3>
              <p className="subtle-note">
                Envie o arquivo, confira os registros e grave apenas depois da revisão.
              </p>
            </div>
            <button className="text-button" type="button" onClick={downloadExpenseImportTemplate}>
              Baixar modelo CSV
            </button>
          </div>

          <div className="import-template-help">
            <span>Data</span>
            <span>Valor</span>
            <span>Categoria</span>
            <span>Descrição</span>
          </div>

          <details className="import-preview secondary-import-options">
            <summary>Configurações salvas</summary>
            <div className="list-header">
              <div>
                <h4>Modelos salvos</h4>
                <p className="subtle-note">
                  Modelos de despesas ficam separados dos modelos de jornadas.
                </p>
              </div>
              <button
                className="text-button"
                disabled={isImportProfilesLoading}
                type="button"
                onClick={() => void loadProfiles()}
              >
                Atualizar
              </button>
            </div>
            {expenseProfiles.length === 0 ? (
              <p className="subtle-note">Nenhuma configuracao de despesas salva ainda.</p>
            ) : (
              <div className="import-preview-list">
                {expenseProfiles.map((profile) => (
                  <article className="vehicle-card session-card" key={profile.id}>
                    <div>
                      <h4>{profile.name}</h4>
                      <p className="subtle-note">
                        {getImportProfileTypeLabel(profile.import_type)} ·{" "}
                        {getImportProfileVehicleLabel(profile)}
                      </p>
                    </div>
                    <div className="card-actions">
                      <button
                        className="text-button"
                        disabled={isImportProfileSaving}
                        type="button"
                        onClick={() => void handleRenameImportProfile(profile)}
                      >
                        Renomear
                      </button>
                      <button
                        className="text-button danger"
                        disabled={isImportProfileSaving}
                        type="button"
                        onClick={() => void handleDeleteImportProfile(profile)}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </details>

          <div className="form-grid">
            <label>
              Veiculo
              <select
                onChange={(event) => setExpenseImportVehicleId(event.target.value)}
                value={expenseImportVehicleId}
              >
                <option value="">Sem veiculo especifico</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            </label>

            <label
              className={
                isExpenseImportDragging
                  ? "import-dropzone import-dropzone-active"
                  : "import-dropzone"
              }
              onDragLeave={() => setIsExpenseImportDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsExpenseImportDragging(true);
              }}
              onDrop={handleExpenseImportDrop}
            >
              <span>Selecionar ou arrastar CSV</span>
              <small>Clique aqui ou solte o arquivo nesta area.</small>
              <input accept=".csv,text/csv" type="file" onChange={handleExpenseImportFileChange} />
            </label>
          </div>

          {expenseImportFile ? (
            <div className="import-file">
              <div>
                <strong>{expenseImportFile.name}</strong>
                <span>{formatFileSize(expenseImportFile.size)}</span>
              </div>
              <button className="text-button danger" type="button" onClick={clearExpenseImportFile}>
                Remover
              </button>
            </div>
          ) : null}

          {matchedExpenseImportProfile ? (
            <p className="form-message compact-message">
              Configuracao aplicada: {matchedExpenseImportProfile.name}.{" "}
              <button className="text-button" type="button" onClick={handleIgnoreExpenseImportProfile}>
                Ignorar
              </button>
            </p>
          ) : null}

          {expenseImportColumns.length && !isExpenseImportMappingVisible ? (
            <p className="subtle-note">
              Colunas reconhecidas.{" "}
              <button
                className="text-button"
                type="button"
                onClick={() => setIsExpenseImportMappingVisible(true)}
              >
                Editar colunas
              </button>
            </p>
          ) : null}

          {expenseImportColumns.length && isExpenseImportMappingVisible ? (
            <div className="import-mapping">
              <div>
                <h4>Qual coluna corresponde a cada informacao?</h4>
                <p className="subtle-note">
                  Confira as sugestoes e ajuste se precisar antes de revisar.
                </p>
              </div>
              <div className="form-grid">
                {expenseImportMappingFields.map((item) => (
                  <label key={item.field}>
                    {item.label}
                    {item.optional ? " (opcional)" : ""}
                    <select
                      value={expenseImportMapping[item.field]}
                      onChange={(event) => {
                        setExpenseImportMapping({
                          ...expenseImportMapping,
                          [item.field]: event.target.value,
                        });
                        setExpenseImportPreview(null);
                        setExpenseImportResult(null);
                        setMatchedExpenseImportProfile(null);
                      }}
                    >
                      <option value="">{item.optional ? "Nao mapear" : "Selecione"}</option>
                      {expenseImportColumns.map((column) => (
                        <option key={`${item.field}-${column}`} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="form-actions import-actions">
            <button
              className="button"
              disabled={
                isExpenseImportPreviewLoading || isExpenseImportSaving || !expenseImportFile
              }
              type="button"
              onClick={() => void handleExpenseImportPreview()}
            >
              {isExpenseImportPreviewLoading
                ? "Validando..."
                : expenseImportColumns.length
                  ? "Conferir registros"
                  : "Ler arquivo e conferir registros"}
            </button>
          </div>

          {expenseImportError ? (
            <p className="form-message compact-message">{expenseImportError}</p>
          ) : null}

          {expenseImportPreview ? (
            <div className="import-preview">
              <dl className="session-metrics import-summary">
                <div>
                  <dt>Total</dt>
                  <dd>{expenseImportPreview.total_rows}</dd>
                </div>
                <div>
                  <dt>Validas</dt>
                  <dd>{expenseImportPreview.valid_rows}</dd>
                </div>
                <div>
                  <dt>Invalidas</dt>
                  <dd>{expenseImportPreview.invalid_rows}</dd>
                </div>
              </dl>

              {expenseImportPreview.errors.length > 0 ? (
                <div className="import-errors">
                  <h4>Corrija o CSV e envie novamente</h4>
                  {expenseImportPreview.errors.map((error, index) => (
                    <article key={`${error.row}-${error.field}-${index}`}>
                      <strong>Linha {error.row}</strong>
                      <span>
                        {getImportFieldLabel(error.field)}: {error.message}
                      </span>
                    </article>
                  ))}
                </div>
              ) : null}

              {expenseImportPreview.rows.length > 0 ? (
                <div className="import-preview-list">
                  {expenseImportPreview.rows.map((row) => (
                    <article className="vehicle-card session-card" key={row.row}>
                      <div>
                        <h4>{formatDate(row.expense_date)}</h4>
                        <p>{getExpenseCategoryLabel(row.category)}</p>
                        <dl className="session-metrics expense-metrics">
                          <div>
                            <dt>Valor</dt>
                            <dd>{formatMoney(row.amount)}</dd>
                          </div>
                          <div>
                            <dt>Descricao</dt>
                            <dd>{row.description ?? "—"}</dd>
                          </div>
                        </dl>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {expenseImportPreview.invalid_rows > 0 ? (
                <p className="empty-state compact-empty-state">
                  Existem linhas invalidas. Corrija o arquivo e envie novamente.
                </p>
              ) : (
                <>
                  <div className="import-mapping">
                    <div>
                      <h4>Salvar este modelo para proximas importacoes</h4>
                      <p className="subtle-note">
                        Opcional: informe um nome amigavel para lembrar estas colunas.
                      </p>
                    </div>
                    <div className="form-grid">
                      <label>
                        Nome da configuracao
                        <input
                          onChange={(event) => setExpenseImportProfileName(event.target.value)}
                          placeholder="Ex.: Despesas do cartao"
                          value={expenseImportProfileName}
                        />
                      </label>
                    </div>
                    <button
                      className="button button-ghost"
                      disabled={isImportProfileSaving}
                      type="button"
                      onClick={() => void handleSaveExpenseImportProfile()}
                    >
                      {isImportProfileSaving ? "Salvando..." : "Salvar configuracao"}
                    </button>
                  </div>

                  <button
                    className="button"
                    disabled={isExpenseImportSaving || expenseImportPreview.valid_rows === 0}
                    type="button"
                    onClick={() => void handleConfirmExpenseImport()}
                  >
                    {isExpenseImportSaving
                      ? "Importando..."
                      : `Importar ${expenseImportPreview.valid_rows} despesas`}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {expenseImportResult ? (
            <div className="import-result">
              <h4>Importacao concluida</h4>
              <dl className="session-metrics import-summary">
                <div>
                  <dt>Importadas</dt>
                  <dd>{expenseImportResult.imported}</dd>
                </div>
                <div>
                  <dt>Duplicadas</dt>
                  <dd>{expenseImportResult.duplicates_skipped}</dd>
                </div>
                <div>
                  <dt>Falhas</dt>
                  <dd>{expenseImportResult.failed}</dd>
                </div>
              </dl>
              {expenseImportResult.duplicates_skipped > 0 ? (
                <p className="subtle-note">
                  O GanhoCerto ignorou despesas que ja haviam sido importadas.
                </p>
              ) : null}
              <button
                className="button button-ghost"
                type="button"
                onClick={() =>
                  document.getElementById("lista-despesas")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                Ver minhas despesas
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
