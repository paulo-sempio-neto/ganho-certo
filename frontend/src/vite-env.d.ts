/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Optional public support e-mail shown in the footer and legal pages. */
  readonly VITE_SUPPORT_EMAIL?: string;
}
