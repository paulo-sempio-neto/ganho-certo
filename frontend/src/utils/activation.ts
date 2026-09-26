export type BetaActivationNextStep = {
  title: string;
  message: string;
  actionLabel: string;
  targetId: string;
};

export type BetaActivationState = {
  vehicleCount: number;
  workSessionCount: number;
  expenseCount: number;
  hasQuickDailyResult: boolean;
};

export function getBetaActivationNextStep({
  vehicleCount,
  workSessionCount,
  expenseCount,
  hasQuickDailyResult,
}: BetaActivationState): BetaActivationNextStep | null {
  if (vehicleCount === 0) {
    return {
      title: "Primeiro passo da beta",
      message:
        "Cadastre o veiculo ou preencha o dia agora. Se salvar antes, seus dados ficam guardados.",
      actionLabel: "Cadastrar veiculo",
      targetId: "veiculos",
    };
  }

  if (workSessionCount === 0) {
    return {
      title: "Registre seu primeiro dia",
      message: "Informe faturamento, km e horas para ver quanto sobrou apos os gastos.",
      actionLabel: "Registrar meu dia",
      targetId: "hoje",
    };
  }

  if (expenseCount === 0) {
    return {
      title: "Inclua o primeiro gasto",
      message: "Combustivel, recarga ou manutencao deixam a sobra do dia mais fiel.",
      actionLabel: "Adicionar gasto",
      targetId: "hoje",
    };
  }

  if (!hasQuickDailyResult && workSessionCount < 3) {
    return {
      title: "Continue por mais alguns dias",
      message: "Com mais registros, o historico e os padroes de trabalho ficam mais uteis.",
      actionLabel: "Registrar outro dia",
      targetId: "hoje",
    };
  }

  return null;
}
