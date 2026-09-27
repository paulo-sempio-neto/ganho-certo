import type { ReactNode } from "react";

type FeedbackMessageProps = {
  kind: "error" | "success" | "info" | "loading";
  children: ReactNode;
  compact?: boolean;
};

export function FeedbackMessage({ kind, children, compact = false }: FeedbackMessageProps) {
  const className = kind === "loading"
    ? "loading-state"
    : kind === "success" ? "success-message" : "form-message";

  return (
    <p
      className={`${className}${compact ? " compact-message" : ""}`}
      role={kind === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      {children}
    </p>
  );
}
