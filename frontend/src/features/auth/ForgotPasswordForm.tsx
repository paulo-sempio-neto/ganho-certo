import { FormEvent, useState } from "react";

import { forgotPassword } from "../../api/auth";

const safeForgotPasswordMessage =
  "Se existir uma conta com este e-mail, enviaremos as instrucoes para redefinir sua senha.";

type ForgotPasswordFormProps = {
  initialEmail: string;
  onBackToLogin: (message?: string) => void;
};

export function ForgotPasswordForm({ initialEmail, onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      await forgotPassword(email);
      setSuccessMessage(safeForgotPasswordMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a solicitacao.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Recuperar senha</h2>

      <label>
        E-mail
        <input
          autoComplete="email"
          name="forgot-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      {message ? <p className="form-message">{message}</p> : null}
      {successMessage ? <p className="success-message">{successMessage}</p> : null}

      <button className="button" disabled={isLoading} type="submit">
        {isLoading ? "Enviando..." : "Enviar instrucoes"}
      </button>
      <button
        className="text-button inline-action"
        type="button"
        onClick={() => onBackToLogin(successMessage)}
      >
        Voltar para login
      </button>
    </form>
  );
}
