import { describe, expect, it } from "vitest";

import {
  getHistoryComparisonUnavailableMessage,
  getHistoryEmptyStateMessage,
} from "./HistoricalPerformanceSection";
import {
  getWorkPatternsEmptyStateMessage,
  getWorkPatternsGuidance,
  getWorkPatternsLimitedMessage,
  getWorkPatternsPerformanceScopeMessage,
} from "./WorkPatternsSection";
import { getHistoryComparisonScopeMessage } from "./HistoricalPerformanceSection";

describe("retention guidance messages", () => {
  it("explains what more history unlocks", () => {
    expect(getHistoryEmptyStateMessage()).toContain("Registre mais dias");
    expect(getHistoryComparisonUnavailableMessage()).toContain("periodo anterior");
    expect(getHistoryComparisonScopeMessage()).toContain("nao aponta a causa");
    expect(getWorkPatternsEmptyStateMessage()).toContain("comparacoes por dia da semana");
  });

  it("changes work pattern guidance as saved days grow", () => {
    expect(getWorkPatternsGuidance(1)).toContain("primeiro registro");
    expect(getWorkPatternsGuidance(2)).toContain("Ja ha registros");
    expect(getWorkPatternsLimitedMessage()).toContain("dados iniciais");
    expect(getWorkPatternsPerformanceScopeMessage()).toContain("descrevem seus registros");
  });
});
