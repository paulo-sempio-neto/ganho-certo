/** Public support address from VITE_SUPPORT_EMAIL, or null when the deploy does not set one. */
export const SUPPORT_EMAIL: string | null = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || null;
