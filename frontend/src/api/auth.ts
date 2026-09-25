import { requestApi } from "./client";

type MessageResponse = {
  message: string;
};

export function forgotPassword(email: string): Promise<MessageResponse> {
  return requestApi<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
  return requestApi<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
  headers: Record<string, string>,
): Promise<MessageResponse> {
  return requestApi<MessageResponse>("/auth/change-password", {
    method: "POST",
    headers,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}
