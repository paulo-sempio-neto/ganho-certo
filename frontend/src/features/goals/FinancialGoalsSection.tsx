import { useState, type FormEvent } from "react";

import { requestApi } from "../../api/client";
import { FeedbackMessage } from "../../components/FeedbackMessage";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useFormValidation } from "../../utils/formValidation";
import type { FinancialGoalType, Vehicle } from "../../types/domain";
import type { FinancialGoal, FinancialGoalProgress } from "../../types/financial";
import { toDateInputValue } from "../../utils/dates";
import { formatDate, formatHours, formatPercent, getProgressWidth } from "../../utils/formatters";
import { formatMoney, moneyInputToApi } from "../../utils/money";
import {
  getGoalCurrentValueLabel,
  getGoalProgressScopeMessage,
  getGoalProgressStatusMessage,
  getGoalRequiredPaceMessage,
} from "./goalMessages";

type FinancialGoalForm = {
  goal_type: FinancialGoalType;
  target_amount: string;
  start_date: string;
  end_date: string;
  vehicle_id: string;
};

type FinancialGoalsSectionProps = {
  financialGoals: FinancialGoal[];
  financialGoalProgressById: Record<number, FinancialGoalProgress>;
  isFinancialGoalsLoading: boolean;
  vehicles: Vehicle[];
  getVehicleLabel: (vehicleId: number) => string;
  getAuthHeaders: () => Record<string, string>;
  endSession: (message: string) => void;
  setMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  loadFinancialGoals: () => Promise<void>;
};

const financialGoalTypeOptions: Array<{ label: string; value: FinancialGoalType }> = [
  { label: "Meta de sobra apos despesas", value: "net" },
  { label: "Meta de resultado projetado", value: "projected" },
];

const emptyFinancialGoalForm: FinancialGoalForm = {
  goal_type: "net",
  target_amount: "",
  start_date: toDateInputValue(new Date()),
  end_date: toDateInputValue(new Date()),
  vehicle_id: "",
};

function getFinancialGoalTypeLabel(value: FinancialGoalType): string {
  return financialGoalTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function FinancialGoalsSection({
  financialGoals,
  financialGoalProgressById,
  isFinancialGoalsLoading,
  vehicles,
  getVehicleLabel,
  getAuthHeaders,
  endSession,
  setMessage,
  setSuccessMessage,
  loadFinancialGoals,
}: FinancialGoalsSectionProps) {
  const [financialGoalForm, setFinancialGoalForm] =
    useState<FinancialGoalForm>(emptyFinancialGoalForm);
  const financialGoalValidation = useFormValidation();
  const [editingFinancialGoalId, setEditingFinancialGoalId] = useState<number | null>(null);
  const [isFinancialGoalSaving, setIsFinancialGoalSaving] = useState(false);

  function resetFinancialGoalForm() {
    setEditingFinancialGoalId(null);
    setFinancialGoalForm(emptyFinancialGoalForm);
  }

  function handleEditFinancialGoal(goal: FinancialGoal) {
    setEditingFinancialGoalId(goal.id);
    setFinancialGoalForm({
      goal_type: goal.goal_type,
      target_amount: formatMoney(goal.target_amount).replace("R$ ", ""),
      start_date: goal.start_date,
      end_date: goal.end_date,
      vehicle_id: goal.vehicle_id ? String(goal.vehicle_id) : "",
    });
    setMessage("");
    setSuccessMessage("");
  }

  function buildFinancialGoalPayload(form: FinancialGoalForm, active = true) {
    return {
      goal_type: form.goal_type,
      target_amount: moneyInputToApi(form.target_amount),
      start_date: form.start_date,
      end_date: form.end_date,
      active,
      ...(form.vehicle_id ? { vehicle_id: Number(form.vehicle_id) } : {}),
    };
  }

  async function handleFinancialGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsFinancialGoalSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const currentGoal = financialGoals.find((goal) => goal.id === editingFinancialGoalId);
      const payload = buildFinancialGoalPayload(financialGoalForm, currentGoal?.active ?? true);

      if (editingFinancialGoalId) {
        await requestApi<FinancialGoal>(`/financial-goals/${editingFinancialGoalId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Meta atualizada com sucesso.");
      } else {
        await requestApi<FinancialGoal>("/financial-goals", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Meta cadastrada com sucesso.");
      }

      resetFinancialGoalForm();
      await loadFinancialGoals();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao salvar meta.");
      }
    } finally {
      setIsFinancialGoalSaving(false);
    }
  }

  async function handleToggleFinancialGoal(goal: FinancialGoal) {
    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<FinancialGoal>(`/financial-goals/${goal.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          goal_type: goal.goal_type,
          target_amount: goal.target_amount,
          start_date: goal.start_date,
          end_date: goal.end_date,
          active: !goal.active,
          ...(goal.vehicle_id ? { vehicle_id: goal.vehicle_id } : {}),
        }),
      });
      setSuccessMessage(goal.active ? "Meta desativada." : "Meta ativada.");
      await loadFinancialGoals();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao alterar meta.");
      }
    }
  }

  async function handleDeleteFinancialGoal(goal: FinancialGoal) {
    const shouldDelete = window.confirm(`Excluir a meta de ${formatMoney(goal.target_amount)}?`);
    if (!shouldDelete) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    try {
      await requestApi<void>(`/financial-goals/${goal.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSuccessMessage("Meta excluida com sucesso.");
      await loadFinancialGoals();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Sessao")) {
        endSession(error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao excluir meta.");
      }
    }
  }

  return (
    <section className="manager-section" id="metas">
      <div className="section-title">
        <p className="eyebrow">Metas</p>
        <h3>Metas financeiras</h3>
        <p className="subtle-note">
          Acompanhe o valor registrado, quanto falta e o ritmo necessario dentro do
          periodo da meta. Ritmo e fechamento sao referencias baseadas nos registros, nao
          garantias.
        </p>
      </div>

      <div className="vehicles-layout">
        <form className="auth-form vehicle-form" onSubmit={handleFinancialGoalSubmit} onInvalid={financialGoalValidation.handleInvalid}>
          <h3>{editingFinancialGoalId ? "Editar meta" : "Criar meta"}</h3>

          <div className="simple-goal-intro">
            <strong>Quanto você quer que sobre?</strong>
            <p>
              Por padrão, a meta acompanha a sobra após as despesas que você registrou.
            </p>
          </div>

          <details
            className="advanced-options"
            open={financialGoalForm.goal_type === "projected"}
          >
            <summary>Opção avançada</summary>
            <label className="toggle-field">
              <input
                checked={financialGoalForm.goal_type === "projected"}
                name="financial-goal-type"
                onChange={(event) =>
                  setFinancialGoalForm({
                    ...financialGoalForm,
                    goal_type: event.target.checked ? "projected" : "net",
                  })
                }
                type="checkbox"
              />
              <span>Usar resultado projetado</span>
            </label>
            {financialGoalForm.goal_type === "projected" ? (
              <p className="subtle-note">
                O resultado projetado também considera custos do veículo e despesas
                recorrentes previstas.
              </p>
            ) : null}
          </details>

          <label>
            Valor da meta
            <input
              inputMode="decimal"
              name="target_amount"
              onChange={(event) =>
                setFinancialGoalForm({
                  ...financialGoalForm,
                  target_amount: event.target.value,
                })
              }
              placeholder="Ex: 4000,00"
              required
              type="text"
              value={financialGoalForm.target_amount}
              aria-invalid={!!financialGoalValidation.errors.target_amount}
              aria-describedby={financialGoalValidation.errors.target_amount ? "financial-goal-target_amount-error" : undefined}
              className={financialGoalValidation.errors.target_amount ? "field-error" : ""}
            />
          </label>
          <ErrorMessage id="financial-goal-target_amount-error" message={financialGoalValidation.errors.target_amount} />

          <div className="form-grid">
            <div>
              <label>
                Data inicial
                <input
                  name="start_date"
                  onChange={(event) =>
                    setFinancialGoalForm({
                      ...financialGoalForm,
                      start_date: event.target.value,
                    })
                  }
                  required
                  type="date"
                  value={financialGoalForm.start_date}
                  aria-invalid={!!financialGoalValidation.errors.start_date}
                  aria-describedby={financialGoalValidation.errors.start_date ? "financial-goal-start_date-error" : undefined}
                  className={financialGoalValidation.errors.start_date ? "field-error" : ""}
                />
              </label>
              <ErrorMessage id="financial-goal-start_date-error" message={financialGoalValidation.errors.start_date} />
            </div>

            <div>
              <label>
                Data final
                <input
                  name="end_date"
                  onChange={(event) =>
                    setFinancialGoalForm({
                      ...financialGoalForm,
                      end_date: event.target.value,
                    })
                  }
                  required
                  type="date"
                  value={financialGoalForm.end_date}
                  aria-invalid={!!financialGoalValidation.errors.end_date}
                  aria-describedby={financialGoalValidation.errors.end_date ? "financial-goal-end_date-error" : undefined}
                  className={financialGoalValidation.errors.end_date ? "field-error" : ""}
                />
              </label>
              <ErrorMessage id="financial-goal-end_date-error" message={financialGoalValidation.errors.end_date} />
            </div>
          </div>

          <label>
            Veiculo <span className="optional-label">(opcional)</span>
            <select
              name="vehicle_id"
              onChange={(event) =>
                setFinancialGoalForm({
                  ...financialGoalForm,
                  vehicle_id: event.target.value,
                })
              }
              value={financialGoalForm.vehicle_id}
              aria-invalid={!!financialGoalValidation.errors.vehicle_id}
              aria-describedby={financialGoalValidation.errors.vehicle_id ? "financial-goal-vehicle_id-error" : undefined}
              className={financialGoalValidation.errors.vehicle_id ? "field-error" : ""}
            >
              <option value="">Todos / sem veiculo especifico</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.brand} {vehicle.model}
                </option>
              ))}
            </select>
          </label>
          <ErrorMessage id="financial-goal-vehicle_id-error" message={financialGoalValidation.errors.vehicle_id} />

          <div className="form-actions">
            <button className="button" disabled={isFinancialGoalSaving} type="submit">
              {isFinancialGoalSaving
                ? "Salvando..."
                : editingFinancialGoalId
                  ? "Salvar meta"
                  : "Criar meta"}
            </button>
            {editingFinancialGoalId ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={resetFinancialGoalForm}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div className="vehicles-list" aria-busy={isFinancialGoalsLoading}>
          <div className="list-header">
            <h3>Minhas metas</h3>
            <button
              className="text-button"
              disabled={isFinancialGoalsLoading}
              type="button"
              onClick={() => void loadFinancialGoals()}
            >
              Atualizar
            </button>
          </div>

          {isFinancialGoalsLoading ? <FeedbackMessage kind="loading">Carregando metas...</FeedbackMessage> : null}

          {!isFinancialGoalsLoading && financialGoals.length === 0 ? (
            <p className="empty-state">
              Nenhuma meta cadastrada ainda. Crie uma meta para acompanhar seu progresso.
            </p>
          ) : null}

          {financialGoals.map((goal) => {
            const progress = financialGoalProgressById[goal.id];
            const isReached = progress?.remaining_amount === "0.00";
            const averagePerHour =
              goal.goal_type === "net"
                ? progress?.average_net_per_hour
                : progress?.average_projected_per_hour;

            return (
              <article className="vehicle-card session-card goal-card" key={goal.id}>
                <div>
                  <div className="recurring-card-title">
                    <h4>{getFinancialGoalTypeLabel(goal.goal_type)}</h4>
                    <span
                      className={
                        goal.active
                          ? "status-pill status-active"
                          : "status-pill status-inactive"
                      }
                    >
                      {goal.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>

                  <p>
                    {formatMoney(goal.target_amount)} de {formatDate(goal.start_date)} ate{" "}
                    {formatDate(goal.end_date)}
                  </p>

                  {progress ? (
                    <div className="goal-progress-panel">
                      <p className="subtle-note">{getGoalProgressScopeMessage()}</p>
                      <div className="goal-progress-main">
                        <span>{isReached ? "Status" : "Valor restante"}</span>
                        <strong>
                          {isReached ? "Meta atingida" : formatMoney(progress.remaining_amount)}
                        </strong>
                        {!isReached && progress.days_remaining > 0 ? (
                          <small>
                            Ritmo necessario: aproximadamente{" "}
                            {formatMoney(progress.required_daily_amount)} por dia ate{" "}
                            {formatDate(goal.end_date)}.
                          </small>
                        ) : null}
                        {!isReached ? (
                          <small>
                            {getGoalRequiredPaceMessage(progress.days_remaining, isReached)}
                          </small>
                        ) : null}
                        {!isReached && progress.estimated_hours_remaining ? (
                          <small>
                            Estimativa: {formatHours(progress.estimated_hours_remaining)} de
                            trabalho no seu ritmo atual.
                          </small>
                        ) : null}
                      </div>

                      <div className="goal-progress-bar" aria-label="Progresso da meta">
                        <i style={{ width: getProgressWidth(progress.progress_percentage) }} />
                      </div>
                      <p className="goal-progress-status">
                        {getGoalProgressStatusMessage(
                          isReached,
                          progress.estimated_hours_remaining !== null && averagePerHour != null,
                          progress.on_track,
                        )}
                      </p>

                      <dl className="session-metrics goal-metrics">
                        <div>
                          <dt>{getGoalCurrentValueLabel(goal.goal_type)}</dt>
                          <dd>{formatMoney(progress.current_amount)}</dd>
                        </div>
                        <div>
                          <dt>Progresso</dt>
                          <dd>{formatPercent(progress.progress_percentage)}</dd>
                        </div>
                        <div>
                          <dt>Dias decorridos</dt>
                          <dd>
                            {progress.days_elapsed} de {progress.days_total}
                          </dd>
                        </div>
                        <div>
                          <dt>Dias restantes</dt>
                          <dd>{progress.days_remaining}</dd>
                        </div>
                        <div>
                          <dt>Ritmo necessario por dia</dt>
                          <dd>
                            {isReached || progress.days_remaining === 0
                              ? "—"
                              : formatMoney(progress.required_daily_amount)}
                          </dd>
                        </div>
                        <div>
                          <dt>Ritmo atual por hora</dt>
                          <dd>{averagePerHour ? formatMoney(averagePerHour) : "Dados insuficientes"}</dd>
                        </div>
                        <div>
                          <dt>Horas estimadas restantes</dt>
                          <dd>{isReached ? "—" : formatHours(progress.estimated_hours_remaining)}</dd>
                        </div>
                        <div>
                          <dt>Fechamento estimado</dt>
                          <dd>
                            {progress.days_elapsed > 0
                              ? formatMoney(progress.projected_completion_amount)
                              : "Dados insuficientes"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <FeedbackMessage kind="loading" compact>Carregando progresso...</FeedbackMessage>
                  )}

                  <dl className="session-metrics goal-summary-metrics">
                    <div>
                      <dt>Veiculo</dt>
                      <dd>
                        {goal.vehicle_id ? getVehicleLabel(goal.vehicle_id) : "Todos / sem veiculo"}
                      </dd>
                    </div>
                    <div>
                      <dt>Resumo</dt>
                      <dd>
                        {progress
                          ? `${formatPercent(progress.progress_percentage)} concluida`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="card-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => handleEditFinancialGoal(goal)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => void handleToggleFinancialGoal(goal)}
                  >
                    {goal.active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => void handleDeleteFinancialGoal(goal)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
