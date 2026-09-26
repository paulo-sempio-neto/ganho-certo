import { describe, expect, it } from "vitest";

import {
  getHistoryComparisonUnavailableMessage,
  getHistoryEmptyStateMessage,
} from "./HistoricalPerformanceSection";
import {
  getWorkPatternsEmptyStateMessage,
  getWorkPatternsGuidance,
  getWorkPatternsLimitedMessage,
} from "./WorkPatternsSection";

describe("retention guidance messages", () => {
  it("explains what more history unlocks", () => {
    expect(getHistoryEmptyStateMessage()).toContain("Registre mais dias");
    expect(getHistoryComparisonUnavailableMessage()).toContain("periodo anterior");
    expect(getWorkPatternsEmptyStateMessage()).toContain("comparacoes por dia da semana");
  });

  it("changes work pattern guidance as saved days grow", () => {
    expect(getWorkPatternsGuidance(1)).toContain("primeiro registro");
    expect(getWorkPatternsGuidance(2)).toContain("Ja ha registros");
    expect(getWorkPatternsLimitedMessage()).toContain("dados iniciais");
  });
});
