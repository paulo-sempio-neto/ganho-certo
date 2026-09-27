import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { VehiclesSection } from "./VehiclesSection";

describe("vehicle onboarding", () => {
  it("keeps essential registration separate from optional cost setup", () => {
    const html = renderToStaticMarkup(createElement(VehiclesSection, {
      vehicles: [], pendingQuickStartAction: null, isVehiclesLoading: false,
      getAuthHeaders: () => ({}), endSession: vi.fn(), setMessage: vi.fn(),
      setSuccessMessage: vi.fn(), loadVehicles: vi.fn(), loadWorkSessions: vi.fn(),
      loadExpenses: vi.fn(), refreshDashboardData: vi.fn(), onVehicleCreated: vi.fn(),
    }));
    expect(html).toContain("O cadastro básico já permite registrar jornadas.");
    expect(html).toContain("configurados depois");
    expect(html).toContain("Cadastrar veiculo");
    expect(html).not.toContain('class="auth-form cost-profile-panel"');
  });
});
