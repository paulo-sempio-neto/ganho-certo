import { FormEvent, useState } from "react";

import { changePassword } from "../../api/auth";

type ChangePasswordFormProps = {
  getAuthHeaders: () => Record<string, string>;
  onCancel: () => void;
  onPasswordChanged: (message: string) => void;
};

export function ChangePasswordForm({
  getAuthHeaders,
  onCancel,
  onPasswordChanged,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function clearPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("As senhas nao conferem.");
      clearPasswordFields();
      return;
    }

    setIsLoading(true);

    try {
      await changePassword(currentPassword, newPassword, getAuthHeaders());
      clearPasswordFields();
      onPasswordChanged("Senha alterada com sucesso. Entre novamente.");
    } catch (error) {
      clearPasswordFields();
      setMessage(error instanceof Error ? error.message : "Nao foi possivel alterar a senha.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-form account-password-form" onSubmit={handleSubmit}>
      <h3>Alterar senha</h3>

      <label>
        Senha atual
        <input
          autoComplete="current-password"
          name="current-password"
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          type="password"
          value={currentPassword}
        />
      </label>

      <label>
        Nova senha
        <input
          autoComplete="new-password"
          minLength={6}
          name="change-new-password"
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
          name="change-confirm-password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />
      </label>

      {message ? <p className="form-message">{message}</p> : null}

      <div className="form-actions">
        <button className="button" disabled={isLoading} type="submit">
          {isLoading ? "Alterando..." : "Alterar senha"}
        </button>
        <button className="button button-ghost" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
