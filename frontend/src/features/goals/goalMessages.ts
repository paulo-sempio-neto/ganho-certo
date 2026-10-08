import type { FinancialGoal } from "../../types/financial";

export function getGoalProgressScopeMessage(): string {
  return "O valor atual usa os dados do periodo. Ritmo e fechamento sao estimativas baseadas no periodo ate agora, nao garantias.";
}

export function getGoalCurrentValueLabel(goalType: FinancialGoal["goal_type"]): string {
  return goalType === "projected" ? "Resultado projetado apurado" : "Sobra registrada";
}

export function getGoalRequiredPaceMessage(daysRemaining: number, isReached: boolean): string {
  if (isReached) {
    return "Meta atingida com os registros deste periodo.";
  }

  return daysRemaining > 0
    ? "Ritmo necessario para os dias restantes. Nao e uma previsao de ganho."
    : "O periodo terminou. Nao ha dias restantes para calcular um ritmo diario.";
}

export function getMatchingNetGoal(
  goals: FinancialGoal[],
  workDate: string,
  vehicleId: number,
): FinancialGoal | null {
  const matchingGoals = goals.filter(
    (goal) =>
      goal.active &&
      goal.goal_type === "net" &&
      goal.start_date <= workDate &&
      workDate <= goal.end_date &&
      (goal.vehicle_id === null || goal.vehicle_id === vehicleId),
  );

  return matchingGoals.find((goal) => goal.vehicle_id === vehicleId) ?? matchingGoals[0] ?? null;
}

export function getGoalProgressStatusMessage(
  isReached: boolean,
  hasUsablePace: boolean,
  onTrack: boolean,
): string {
  if (isReached) {
    return "Meta atingida com os registros deste periodo.";
  }

  if (!hasUsablePace) {
    return "Ainda nao ha dados suficientes para estimar seu ritmo.";
  }

  return onTrack
    ? "Ate aqui, seus registros estao no ritmo necessario para esta meta."
    : "Ate aqui, seus registros estao abaixo do ritmo necessario para esta meta.";
}

export function getGoalUpdatedAfterWorkMessage(hasActiveGoals: boolean): string {
  return hasActiveGoals
    ? "Dia registrado. As metas ativas foram atualizadas com os registros deste periodo."
    : "Dia registrado. Veja a sobra no resumo de Hoje.";
}
