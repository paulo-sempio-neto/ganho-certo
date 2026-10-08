import type { FinancialGoal } from "../../types/financial";

export function selectTodayGoal(
  goals: FinancialGoal[],
  date: string,
  vehicleIds: number[],
): FinancialGoal | null {
  const currentGoals = goals.filter(
    (goal) => goal.active && goal.start_date <= date && date <= goal.end_date,
  );

  const globalGoals = currentGoals.filter((goal) => goal.vehicle_id === null);
  const globalGoal = globalGoals.find((goal) => goal.goal_type === "net")
    ?? globalGoals.find((goal) => goal.goal_type === "projected");
  if (globalGoal) return globalGoal;

  const vehicleGoals = currentGoals.filter(
    (goal) => goal.vehicle_id !== null && vehicleIds.includes(goal.vehicle_id),
  );
  for (const goalType of ["net", "projected"] as const) {
    const candidates = vehicleGoals.filter((goal) => goal.goal_type === goalType);
    candidates.sort((left, right) =>
      left.end_date.localeCompare(right.end_date) || left.id - right.id,
    );
    if (candidates.length > 0) return candidates[0];
  }

  return null;
}
