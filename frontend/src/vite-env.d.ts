/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_RELEASE?: string;
  /** E-mail ou URL de suporte exibido no menu de ajuda. */
  readonly VITE_SUPPORT_CONTACT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
