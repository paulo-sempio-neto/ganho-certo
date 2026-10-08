import { FeedbackMessage } from "../../components/FeedbackMessage";
import type { BetaActivationNextStep } from "../../utils/activation";

type DashboardStartProps = {
  nextStep: BetaActivationNextStep | null;
  hasWorkdays: boolean;
  isLoading: boolean;
  onRegister: () => void;
};

export function DashboardStart({ nextStep, hasWorkdays, isLoading, onRegister }: DashboardStartProps) {
  return (
    <section className="dashboard-start" aria-labelledby="dashboard-start-title">
      <div className="section-title">
        <p className="eyebrow">Próximo passo</p>
        <h2 id="dashboard-start-title">
          {isLoading ? "Seu dia de trabalho" : hasWorkdays ? nextStep?.title : "Registre seu primeiro dia"}
        </h2>
        {isLoading ? (
          <FeedbackMessage kind="loading" compact>Carregando seus registros...</FeedbackMessage>
        ) : (
          <p className="subtle-note">
            {hasWorkdays
              ? nextStep?.message
              : "Informe faturamento, quilômetros e tempo trabalhado para ver quanto sobrou após os gastos registrados."}
          </p>
        )}
      </div>
      <div className="dashboard-start-actions">
        <button className="button" type="button" onClick={onRegister} disabled={isLoading}>
          Registrar meu dia
        </button>
        {hasWorkdays ? (
          <a className="dashboard-result-link" href="#resultado">Ver resultado</a>
        ) : !isLoading ? (
          <p className="subtle-note" id="primeiro-resultado" tabIndex={-1}>
            Depois de salvar, acompanhe a sobra no resumo de Hoje.
          </p>
        ) : null}
      </div>
    </section>
  );
}
