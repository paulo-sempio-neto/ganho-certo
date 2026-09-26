export type BetaActivationNextStep = {
  title: string;
  message: string;
  actionLabel: string;
  targetId: string;
};

export type BetaActivationState = {
  vehicleCount: number;
  workSessionCount: number;
};

export function getBetaActivationNextStep({
  vehicleCount,
  workSessionCount,
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

  if (workSessionCount === 1) {
    return {
      title: "Registre mais um dia para comparar",
      message:
        "Com outro registro, voce podera comparar seus resultados e entender melhor sua evolucao.",
      actionLabel: "Registrar outro dia",
      targetId: "hoje",
    };
  }

  if (workSessionCount > 1) {
    return {
      title: "Revise suas tendencias",
      message:
        "Voce ja tem varios dias salvos. Revise o Resultado para acompanhar sua evolucao e seus padroes.",
      actionLabel: "Ver tendencias",
      targetId: "resultado",
    };
  }

  return null;
}
