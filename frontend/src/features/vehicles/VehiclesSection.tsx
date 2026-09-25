import {
  forwardRef,
  type FormEvent,
  useImperativeHandle,
  useState,
} from "react";

import {
  createVehicle,
  deleteVehicle,
  getVehicleCostProfile,
  updateVehicle,
  updateVehicleCostProfile,
} from "../../api/vehicles";
import type {
  FuelType,
  OwnershipType,
  Vehicle,
  VehicleCostProfile,
} from "../../types/domain";
import {
  formatOptionalDecimalForInput,
  formatOptionalMoneyForInput,
  optionalDecimalInputToApi,
  optionalMoneyInputToApi,
} from "../../utils/money";

type VehicleForm = {
  name: string;
  brand: string;
  model: string;
  year: string;
  fuel_type: FuelType;
};

type VehicleCostProfileForm = {
  ownership_type: OwnershipType;
  rental_monthly: string;
  financing_monthly: string;
  insurance_monthly: string;
  ipva_annual: string;
  other_fixed_monthly: string;
  maintenance_per_km: string;
  tires_per_km: string;
  oil_per_km: string;
  depreciation_per_km: string;
  fuel_efficiency_km_per_liter: string;
};

export type CostProfileDraft = Partial<
  Pick<VehicleCostProfileForm, "ownership_type" | "rental_monthly" | "financing_monthly">
>;

export type VehiclesSectionHandle = {
  openCostProfile: (vehicle: Vehicle, draft?: CostProfileDraft) => Promise<void>;
};

type VehiclesSectionProps = {
  vehicles: Vehicle[];
  pendingQuickStartAction: "register" | "configure" | null;
  isVehiclesLoading: boolean;
  getAuthHeaders: () => Record<string, string>;
  endSession: (message: string) => void;
  setMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  loadVehicles: () => Promise<void>;
  loadWorkSessions: () => Promise<void>;
  loadExpenses: () => Promise<void>;
  refreshDashboardData: () => Promise<void>;
  onVehicleCreated: (vehicle: Vehicle) => Promise<void>;
};

const fuelOptions: Array<{ label: string; value: FuelType }> = [
  { label: "Gasolina", value: "gasoline" },
  { label: "Etanol", value: "ethanol" },
  { label: "Flex", value: "flex" },
  { label: "Diesel", value: "diesel" },
  { label: "Elétrico", value: "electric" },
  { label: "Híbrido", value: "hybrid" },
  { label: "Outro", value: "other" },
];

const ownershipOptions: Array<{ label: string; value: OwnershipType }> = [
  { label: "Proprio", value: "owned" },
  { label: "Financiado", value: "financed" },
  { label: "Alugado", value: "rented" },
];

const emptyVehicleForm: VehicleForm = {
  name: "",
  brand: "",
  model: "",
  year: "",
  fuel_type: "flex",
};

const emptyCostProfileForm: VehicleCostProfileForm = {
  ownership_type: "owned",
  rental_monthly: "",
  financing_monthly: "",
  insurance_monthly: "",
  ipva_annual: "",
  other_fixed_monthly: "",
  maintenance_per_km: "",
  tires_per_km: "",
  oil_per_km: "",
  depreciation_per_km: "",
  fuel_efficiency_km_per_liter: "",
};

function getFuelLabel(value: FuelType): string {
  return fuelOptions.find((option) => option.value === value)?.label ?? value;
}

function costProfileToForm(profile: VehicleCostProfile): VehicleCostProfileForm {
  return {
    ownership_type: profile.ownership_type,
    rental_monthly: formatOptionalMoneyForInput(profile.rental_monthly),
    financing_monthly: formatOptionalMoneyForInput(profile.financing_monthly),
    insurance_monthly: formatOptionalMoneyForInput(profile.insurance_monthly),
    ipva_annual: formatOptionalMoneyForInput(profile.ipva_annual),
    other_fixed_monthly: formatOptionalMoneyForInput(profile.other_fixed_monthly),
    maintenance_per_km: formatOptionalDecimalForInput(profile.maintenance_per_km),
    tires_per_km: formatOptionalDecimalForInput(profile.tires_per_km),
    oil_per_km: formatOptionalDecimalForInput(profile.oil_per_km),
    depreciation_per_km: formatOptionalDecimalForInput(profile.depreciation_per_km),
    fuel_efficiency_km_per_liter: formatOptionalDecimalForInput(
      profile.fuel_efficiency_km_per_liter,
    ),
  };
}

export const VehiclesSection = forwardRef<VehiclesSectionHandle, VehiclesSectionProps>(
  function VehiclesSection(
    {
      vehicles,
      pendingQuickStartAction,
      isVehiclesLoading,
      getAuthHeaders,
      endSession,
      setMessage,
      setSuccessMessage,
      loadVehicles,
      loadWorkSessions,
      loadExpenses,
      refreshDashboardData,
      onVehicleCreated,
    },
    ref,
  ) {
    const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
    const [costProfileForm, setCostProfileForm] =
      useState<VehicleCostProfileForm>(emptyCostProfileForm);
    const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
    const [costProfileVehicleId, setCostProfileVehicleId] = useState<number | null>(null);
    const [isVehicleSaving, setIsVehicleSaving] = useState(false);
    const [isCostProfileLoading, setIsCostProfileLoading] = useState(false);
    const [isCostProfileSaving, setIsCostProfileSaving] = useState(false);

    const selectedCostProfileVehicle =
      vehicles.find((vehicle) => vehicle.id === costProfileVehicleId) ?? null;

    function handleEditVehicle(vehicle: Vehicle) {
      setEditingVehicleId(vehicle.id);
      setVehicleForm({
        name: vehicle.name,
        brand: vehicle.brand,
        model: vehicle.model,
        year: String(vehicle.year),
        fuel_type: vehicle.fuel_type,
      });
      setMessage("");
      setSuccessMessage("");
    }

    function resetVehicleForm() {
      setEditingVehicleId(null);
      setVehicleForm(emptyVehicleForm);
    }

    function closeCostProfileForm() {
      setCostProfileVehicleId(null);
      setCostProfileForm(emptyCostProfileForm);
      setMessage("");
    }

    async function loadVehicleCostProfile(vehicleId: number) {
      setIsCostProfileLoading(true);
      setMessage("");
      try {
        const profile = await getVehicleCostProfile(getAuthHeaders(), vehicleId);
        setCostProfileForm(costProfileToForm(profile));
      } catch (error) {
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else if (error instanceof Error && error.message.includes("Registro nao encontrado")) {
          setCostProfileForm(emptyCostProfileForm);
        } else {
          setMessage(
            error instanceof Error ? error.message : "Erro ao carregar perfil de custos.",
          );
        }
      } finally {
        setIsCostProfileLoading(false);
      }
    }

    async function openCostProfile(vehicle: Vehicle, draft?: CostProfileDraft) {
      setCostProfileVehicleId(vehicle.id);
      setCostProfileForm(emptyCostProfileForm);
      setMessage("");
      setSuccessMessage("");
      await loadVehicleCostProfile(vehicle.id);

      if (draft) {
        setCostProfileForm((currentForm) => ({
          ...currentForm,
          ...draft,
        }));
      }
    }

    useImperativeHandle(ref, () => ({ openCostProfile }));

    async function handleVehicleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setIsVehicleSaving(true);
      setMessage("");
      setSuccessMessage("");

      const payload = {
        name: vehicleForm.name,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: Number(vehicleForm.year),
        fuel_type: vehicleForm.fuel_type,
      };

      try {
        let savedVehicle: Vehicle | null = null;
        if (editingVehicleId) {
          await updateVehicle(getAuthHeaders(), editingVehicleId, payload);
          setSuccessMessage("Veiculo atualizado com sucesso.");
        } else {
          savedVehicle = await createVehicle(getAuthHeaders(), payload);
          setSuccessMessage("Veiculo cadastrado com sucesso.");
        }

        resetVehicleForm();
        await loadVehicles();
        if (savedVehicle) {
          await onVehicleCreated(savedVehicle);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(error instanceof Error ? error.message : "Erro ao salvar veiculo.");
        }
      } finally {
        setIsVehicleSaving(false);
      }
    }

    async function handleDeleteVehicle(vehicle: Vehicle) {
      const shouldDelete = window.confirm(`Excluir o veiculo "${vehicle.name}"?`);
      if (!shouldDelete) {
        return;
      }

      setMessage("");
      setSuccessMessage("");

      try {
        await deleteVehicle(getAuthHeaders(), vehicle.id);
        setSuccessMessage("Veiculo excluido com sucesso.");
        if (costProfileVehicleId === vehicle.id) {
          closeCostProfileForm();
        }
        await loadVehicles();
        await loadWorkSessions();
        await loadExpenses();
        await refreshDashboardData();
      } catch (error) {
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(error instanceof Error ? error.message : "Erro ao excluir veiculo.");
        }
      }
    }

    async function handleCostProfileSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();

      if (!costProfileVehicleId) {
        return;
      }

      setIsCostProfileSaving(true);
      setMessage("");
      setSuccessMessage("");

      try {
        const payload = {
          ownership_type: costProfileForm.ownership_type,
          rental_monthly: optionalMoneyInputToApi(costProfileForm.rental_monthly),
          financing_monthly: optionalMoneyInputToApi(costProfileForm.financing_monthly),
          insurance_monthly: optionalMoneyInputToApi(costProfileForm.insurance_monthly),
          ipva_annual: optionalMoneyInputToApi(costProfileForm.ipva_annual),
          other_fixed_monthly: optionalMoneyInputToApi(costProfileForm.other_fixed_monthly),
          maintenance_per_km: optionalDecimalInputToApi(costProfileForm.maintenance_per_km),
          tires_per_km: optionalDecimalInputToApi(costProfileForm.tires_per_km),
          oil_per_km: optionalDecimalInputToApi(costProfileForm.oil_per_km),
          depreciation_per_km: optionalDecimalInputToApi(costProfileForm.depreciation_per_km),
          fuel_efficiency_km_per_liter: optionalDecimalInputToApi(
            costProfileForm.fuel_efficiency_km_per_liter,
          ),
        };

        const profile = await updateVehicleCostProfile(
          getAuthHeaders(),
          costProfileVehicleId,
          payload,
        );
        setCostProfileForm(costProfileToForm(profile));
        setSuccessMessage("Perfil de custos salvo com sucesso.");
      } catch (error) {
        if (error instanceof Error && error.message.includes("Sessao")) {
          endSession(error.message);
        } else {
          setMessage(error instanceof Error ? error.message : "Erro ao salvar perfil de custos.");
        }
      } finally {
        setIsCostProfileSaving(false);
      }
    }

    return (
      <section className="manager-section" id="veiculos">
        <div className="section-title">
          <p className="eyebrow">Veículos</p>
          <h3>Carros disponíveis para jornadas</h3>
          {pendingQuickStartAction ? (
            <p className="subtle-note">
              Cadastre os dados básicos do veículo para continuar sem perder sua simulação.
            </p>
          ) : null}
        </div>

        <div className="vehicles-layout">
          <form className="auth-form vehicle-form" onSubmit={handleVehicleSubmit}>
            <h3>{editingVehicleId ? "Editar veiculo" : "Cadastrar veiculo"}</h3>

            <label>
              Nome
              <input
                name="vehicle-name"
                onChange={(event) => setVehicleForm({ ...vehicleForm, name: event.target.value })}
                required
                type="text"
                value={vehicleForm.name}
              />
            </label>

            <div className="form-grid">
              <label>
                Marca
                <input
                  name="brand"
                  onChange={(event) =>
                    setVehicleForm({ ...vehicleForm, brand: event.target.value })
                  }
                  required
                  type="text"
                  value={vehicleForm.brand}
                />
              </label>

              <label>
                Modelo
                <input
                  name="model"
                  onChange={(event) =>
                    setVehicleForm({ ...vehicleForm, model: event.target.value })
                  }
                  required
                  type="text"
                  value={vehicleForm.model}
                />
              </label>
            </div>

            <div className="form-grid">
              <label>
                Ano
                <input
                  max="2100"
                  min="1900"
                  name="year"
                  onChange={(event) =>
                    setVehicleForm({ ...vehicleForm, year: event.target.value })
                  }
                  required
                  type="number"
                  value={vehicleForm.year}
                />
              </label>

              <label>
                Combustivel
                <select
                  name="fuel-type"
                  onChange={(event) =>
                    setVehicleForm({
                      ...vehicleForm,
                      fuel_type: event.target.value as FuelType,
                    })
                  }
                  value={vehicleForm.fuel_type}
                >
                  {fuelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-actions">
              <button className="button" disabled={isVehicleSaving} type="submit">
                {isVehicleSaving
                  ? "Salvando..."
                  : editingVehicleId
                    ? "Salvar alteracoes"
                    : "Cadastrar veiculo"}
              </button>
              {editingVehicleId ? (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={resetVehicleForm}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="vehicles-list" aria-busy={isVehiclesLoading}>
            <div className="list-header">
              <h3>Meus veiculos</h3>
              <button
                className="text-button"
                disabled={isVehiclesLoading}
                type="button"
                onClick={() => void loadVehicles()}
              >
                Atualizar
              </button>
            </div>

            {isVehiclesLoading ? <p className="empty-state">Carregando veiculos...</p> : null}

            {!isVehiclesLoading && vehicles.length === 0 ? (
              <p className="empty-state">
                Nenhum veiculo cadastrado ainda. Adicione o carro que voce usa para dirigir.
              </p>
            ) : null}

            {vehicles.map((vehicle) => (
              <article className="vehicle-card" key={vehicle.id}>
                <div>
                  <h4>{vehicle.name}</h4>
                  <p>
                    {vehicle.brand} {vehicle.model} · {vehicle.year}
                  </p>
                  <span>{getFuelLabel(vehicle.fuel_type)}</span>
                </div>
                <div className="card-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => void openCostProfile(vehicle)}
                  >
                    Configurar custos
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => handleEditVehicle(vehicle)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => void handleDeleteVehicle(vehicle)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {selectedCostProfileVehicle ? (
          <form className="auth-form cost-profile-panel" onSubmit={handleCostProfileSubmit}>
            <div className="section-title">
              <p className="eyebrow">Custo real do veiculo</p>
              <h3>Custos de {selectedCostProfileVehicle.name}</h3>
              <p className="subtle-note">
                Esses valores ajudam o GanhoCerto a estimar custos que nem sempre aparecem como
                despesas no dia a dia.
              </p>
              <p className="subtle-note">
                Combustivel e recarga continuam sendo lancados em Despesas. Os custos abaixo
                melhoram as estimativas do Resultado.
              </p>
            </div>

            {isCostProfileLoading ? (
              <p className="empty-state">Carregando perfil de custos...</p>
            ) : null}

            <fieldset className="form-group" disabled={isCostProfileLoading}>
              <legend>Essencial</legend>
              <label>
                Tipo de posse
                <select
                  name="ownership-type"
                  onChange={(event) =>
                    setCostProfileForm({
                      ...costProfileForm,
                      ownership_type: event.target.value as OwnershipType,
                    })
                  }
                  value={costProfileForm.ownership_type}
                >
                  {ownershipOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <fieldset className="form-group" disabled={isCostProfileLoading}>
              <legend>Essencial - valores principais</legend>
              <div className="form-grid">
                <label
                  className={
                    costProfileForm.ownership_type === "rented"
                      ? "cost-field cost-field-active"
                      : "cost-field"
                  }
                >
                  Aluguel mensal
                  <input
                    inputMode="decimal"
                    name="rental-monthly"
                    onChange={(event) =>
                      setCostProfileForm({
                        ...costProfileForm,
                        rental_monthly: event.target.value,
                      })
                    }
                    placeholder="Ex: 2.200,00"
                    type="text"
                    value={costProfileForm.rental_monthly}
                  />
                </label>

                <label
                  className={
                    costProfileForm.ownership_type === "financed"
                      ? "cost-field cost-field-active"
                      : "cost-field"
                  }
                >
                  Financiamento mensal
                  <input
                    inputMode="decimal"
                    name="financing-monthly"
                    onChange={(event) =>
                      setCostProfileForm({
                        ...costProfileForm,
                        financing_monthly: event.target.value,
                      })
                    }
                    placeholder="Ex: 1.800,00"
                    type="text"
                    value={costProfileForm.financing_monthly}
                  />
                </label>
              </div>

              <div className="form-grid form-grid-three">
                <label>
                  Seguro mensal
                  <input
                    inputMode="decimal"
                    name="insurance-monthly"
                    onChange={(event) =>
                      setCostProfileForm({
                        ...costProfileForm,
                        insurance_monthly: event.target.value,
                      })
                    }
                    placeholder="Ex: 250,00"
                    type="text"
                    value={costProfileForm.insurance_monthly}
                  />
                </label>

                <label>
                  IPVA anual
                  <input
                    inputMode="decimal"
                    name="ipva-annual"
                    onChange={(event) =>
                      setCostProfileForm({
                        ...costProfileForm,
                        ipva_annual: event.target.value,
                      })
                    }
                    placeholder="Ex: 1.450,00"
                    type="text"
                    value={costProfileForm.ipva_annual}
                  />
                </label>
              </div>
            </fieldset>

            <details className="advanced-options cost-advanced-options">
              <summary>Avançado</summary>

              <fieldset className="form-group" disabled={isCostProfileLoading}>
                <legend>Provisões por km</legend>
                <div className="form-grid">
                  <label>
                    Manutenção por km
                    <input
                      inputMode="decimal"
                      name="maintenance-per-km"
                      onChange={(event) =>
                        setCostProfileForm({
                          ...costProfileForm,
                          maintenance_per_km: event.target.value,
                        })
                      }
                      placeholder="Ex: 0,18"
                      type="text"
                      value={costProfileForm.maintenance_per_km}
                    />
                  </label>

                  <label>
                    Pneus por km
                    <input
                      inputMode="decimal"
                      name="tires-per-km"
                      onChange={(event) =>
                        setCostProfileForm({
                          ...costProfileForm,
                          tires_per_km: event.target.value,
                        })
                      }
                      placeholder="Ex: 0,05"
                      type="text"
                      value={costProfileForm.tires_per_km}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    Oleo por km
                    <input
                      inputMode="decimal"
                      name="oil-per-km"
                      onChange={(event) =>
                        setCostProfileForm({
                          ...costProfileForm,
                          oil_per_km: event.target.value,
                        })
                      }
                      placeholder="Ex: 0,03"
                      type="text"
                      value={costProfileForm.oil_per_km}
                    />
                  </label>

                  <label>
                    Depreciacao por km
                    <input
                      inputMode="decimal"
                      name="depreciation-per-km"
                      onChange={(event) =>
                        setCostProfileForm({
                          ...costProfileForm,
                          depreciation_per_km: event.target.value,
                        })
                      }
                      placeholder="Ex: 0,21"
                      type="text"
                      value={costProfileForm.depreciation_per_km}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-group" disabled={isCostProfileLoading}>
                <legend>Adicional</legend>
                <label>
                  Outros fixos mensais
                  <input
                    inputMode="decimal"
                    name="other-fixed-monthly"
                    onChange={(event) =>
                      setCostProfileForm({
                        ...costProfileForm,
                        other_fixed_monthly: event.target.value,
                      })
                    }
                    placeholder="Ex: 75,00"
                    type="text"
                    value={costProfileForm.other_fixed_monthly}
                  />
                </label>

                <label>
                  Consumo medio em km/l
                  <input
                    inputMode="decimal"
                    name="fuel-efficiency"
                    onChange={(event) =>
                      setCostProfileForm({
                        ...costProfileForm,
                        fuel_efficiency_km_per_liter: event.target.value,
                      })
                    }
                    placeholder="Ex: 10,5"
                    type="text"
                    value={costProfileForm.fuel_efficiency_km_per_liter}
                  />
                </label>
              </fieldset>
            </details>

            <div className="form-actions">
              <button
                className="button"
                disabled={isCostProfileSaving || isCostProfileLoading}
                type="submit"
              >
                {isCostProfileSaving ? "Salvando..." : "Salvar perfil de custos"}
              </button>
              <button
                className="button button-ghost"
                disabled={isCostProfileSaving}
                type="button"
                onClick={closeCostProfileForm}
              >
                Fechar
              </button>
            </div>
          </form>
        ) : null}
      </section>
    );
  },
);
