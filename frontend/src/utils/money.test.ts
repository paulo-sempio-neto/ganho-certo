import { describe, expect, it } from "vitest";

import { formatMoney, formatMoneyPerKm, moneyInputToApi, optionalMoneyInputToApi } from "./money";

describe("money utilities", () => {
  it("normalizes common Brazilian and decimal money inputs", () => {
    expect(moneyInputToApi("250.50")).toBe("250.50");
    expect(moneyInputToApi("250,50")).toBe("250.50");
    expect(moneyInputToApi("1.250,50")).toBe("1250.50");
    expect(moneyInputToApi("1250,50")).toBe("1250.50");
    expect(moneyInputToApi("1250.50")).toBe("1250.50");
  });

  it("keeps zero and optional empty semantics", () => {
    expect(moneyInputToApi("0")).toBe("0.00");
    expect(optionalMoneyInputToApi("")).toBeNull();
    expect(optionalMoneyInputToApi("   ")).toBeNull();
  });

  it("rejects invalid money inputs with current validation behavior", () => {
    expect(() => moneyInputToApi("abc")).toThrow("Informe um valor em reais");
    expect(() => moneyInputToApi("250,")).toThrow("Informe um valor em reais");
  });

  it("formats money values without producing NaN or Infinity", () => {
    expect(formatMoney("1250.50")).toBe("R$ 1.250,50");
    expect(formatMoneyPerKm("0")).toBe("R$ 0/km");
  });
});
