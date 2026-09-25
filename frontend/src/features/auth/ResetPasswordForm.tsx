import { FormEvent, useState } from "react";

import { resetPassword } from "../../api/auth";

type ResetPasswordFormProps = {
  token: string;
  onBackToLogin: (message?: string) => void;
  onRequestNewLink: () => void;
  onResetComplete: () => void;
};

export function ResetPasswordForm({
  token,
  onBackToLogin,
  onRequestNewLink,
  onResetComplete,
}: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(token ? "" : "Link invalido ou expirado. Solicite um novo link.");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccessMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("As senhas nao conferem.");
      setNewPassword("");
      setConfirmPassword("");
      return;
    }

    if (!token) {
      setMessage("Link invalido ou expirado. Solicite um novo link.");
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Senha redefinida com sucesso.");
      onResetComplete();
    } catch (error) {
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel redefinir a senha. Solicite um novo link.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Redefinir senha</h2>

      <label>
        Nova senha
        <input
          autoComplete="new-password"
          minLength={6}
          name="reset-new-password"
          onChange={(event) => setNewPassword(event.target.value)}
          required
          type="password"
          value={newPassword}
        />
      </label>

      <label>
        Confirmar nova senha
        <input
          autoComplete="new-password"
          minLength={6}
          name="reset-confirm-password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />
      </label>

      {message ? <p className="form-message">{message}</p> : null}
      {successMessage ? <p className="success-message">{successMessage}</p> : null}

      {successMessage ? (
        <button className="button" type="button" onClick={() => onBackToLogin(successMessage)}>
          Entrar
        </button>
      ) : (
        <button className="button" disabled={isLoading || !token} type="submit">
          {isLoading ? "Redefinindo..." : "Redefinir senha"}
        </button>
      )}
      <button className="text-button inline-action" type="button" onClick={onRequestNewLink}>
        Solicitar novo link
      </button>
    </form>
  );
}
