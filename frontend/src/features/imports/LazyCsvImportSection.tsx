import { lazy, Suspense, useState } from "react";

import type { CsvImportSectionProps } from "./CsvImportSection";

const CsvImportSection = lazy(() =>
  import("./CsvImportSection").then((module) => ({ default: module.CsvImportSection })),
);

export function LazyCsvImportSection(props: CsvImportSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const isWorkSession = props.type === "work_sessions";

  return (
    <>
      <div className="section-title">
        <p className="eyebrow">{isWorkSession ? "Jornadas" : "Despesas"}</p>
        <h3>{isWorkSession ? "Registro diario de trabalho" : "Custos da operação"}</h3>
        <button
          className="button button-ghost inline-action"
          type="button"
          onClick={() => {
            setHasOpened(true);
            setIsVisible((current) => !current);
          }}
        >
          {isWorkSession ? "Importar jornadas" : "Importar despesas"}
        </button>
      </div>
      {hasOpened ? (
        <Suspense fallback={isVisible ? <p className="empty-state">Carregando importacao...</p> : null}>
          <CsvImportSection {...props} isVisible={isVisible} />
        </Suspense>
      ) : null}
    </>
  );
}
