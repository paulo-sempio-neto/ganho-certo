import { describe, expect, it } from "vitest";

import type { FinancialGoal } from "../../types/financial";
import { selectTodayGoal } from "./todayGoal";

const globalNetGoal: FinancialGoal = {
  id: 1,
  vehicle_id: null,
  goal_type: "net",
  target_amount: "1000.00",
  start_date: "2026-10-01",
  end_date: "2026-10-31",
  active: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

describe("today goal selection", () => {
  it("prefers the global net goal over projected and vehicle goals", () => {
    const goals: FinancialGoal[] = [
      { ...globalNetGoal, id: 2, vehicle_id: 7 },
      { ...globalNetGoal, id: 3, goal_type: "projected" },
      globalNetGoal,
    ];

    expect(selectTodayGoal(goals, "2026-10-07", [7])).toBe(globalNetGoal);
  });

  it("excludes inactive, expired and future goals and includes both period boundaries", () => {
    const invalidGoals: FinancialGoal[] = [
      { ...globalNetGoal, active: false },
      { ...globalNetGoal, id: 2, end_date: "2026-10-06" },
      { ...globalNetGoal, id: 3, start_date: "2026-10-08" },
    ];

    expect(selectTodayGoal(invalidGoals, "2026-10-07", [])).toBeNull();
    expect(selectTodayGoal([globalNetGoal], "2026-10-01", [])).toBe(globalNetGoal);
    expect(selectTodayGoal([globalNetGoal], "2026-10-31", [])).toBe(globalNetGoal);
  });

  it("uses a projected global goal before a vehicle goal and preserves its type", () => {
    const projected: FinancialGoal = { ...globalNetGoal, goal_type: "projected" };
    const vehicleGoal: FinancialGoal = { ...globalNetGoal, id: 2, vehicle_id: 7 };

    expect(selectTodayGoal([vehicleGoal, projected], "2026-10-07", [7])).toBe(projected);
    expect(selectTodayGoal([projected], "2026-10-07", [])?.goal_type).toBe("projected");
  });

  it("matches the only applicable vehicle goal and ignores other vehicles", () => {
    const matching: FinancialGoal = { ...globalNetGoal, vehicle_id: 7 };
    const other: FinancialGoal = { ...globalNetGoal, id: 2, vehicle_id: 8 };

    expect(selectTodayGoal([other, matching], "2026-10-07", [7, 7])).toBe(matching);
    expect(selectTodayGoal([other], "2026-10-07", [7])).toBeNull();
    expect(selectTodayGoal([matching], "2026-10-07", [])).toBeNull();
  });

  it("prefers a unique net vehicle goal and falls back to projected when needed", () => {
    const net: FinancialGoal = { ...globalNetGoal, vehicle_id: 7 };
    const projected: FinancialGoal = {
      ...globalNetGoal, id: 2, vehicle_id: 7, goal_type: "projected",
    };

    expect(selectTodayGoal([projected, net], "2026-10-07", [7])).toBe(net);
    expect(selectTodayGoal([projected], "2026-10-07", [7])).toBe(projected);
  });

  it("chooses the closest vehicle deadline, breaks ties by id and preserves input order", () => {
    const later: FinancialGoal = { ...globalNetGoal, vehicle_id: 7 };
    const closest: FinancialGoal = {
      ...globalNetGoal, id: 3, vehicle_id: 8, end_date: "2026-10-15",
    };
    const tied: FinancialGoal = { ...closest, id: 4, vehicle_id: 9 };
    const projected: FinancialGoal = {
      ...globalNetGoal, id: 2, vehicle_id: 7, goal_type: "projected", end_date: "2026-10-08",
    };
    const goals = [later, tied, projected, closest];
    const original = [...goals];

    expect(selectTodayGoal(goals, "2026-10-07", [7, 8, 9])).toBe(closest);
    expect(selectTodayGoal([...goals].reverse(), "2026-10-07", [9, 8, 7])).toBe(closest);
    expect(goals).toEqual(original);

    const projectedGoals: FinancialGoal[] = [
      { ...later, goal_type: "projected" },
      { ...tied, goal_type: "projected" },
      { ...closest, goal_type: "projected" },
    ];
    expect(selectTodayGoal(projectedGoals, "2026-10-07", [7, 8, 9])?.id).toBe(closest.id);
  });
});
