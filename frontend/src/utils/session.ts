type SessionState = {
  token: string | null;
  hasUser: boolean;
  hasError: boolean;
  isResetPasswordRoute: boolean;
};

/**
 * A stored token with no loaded user and no error means /auth/me is still
 * answering: show a neutral splash instead of flashing the public landing.
 */
export function isRestoringSession({ token, hasUser, hasError, isResetPasswordRoute }: SessionState): boolean {
  return Boolean(token) && !hasUser && !hasError && !isResetPasswordRoute;
}
