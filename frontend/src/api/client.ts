const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

export const API_BASE_URL = /^https?:\/\//.test(configuredBaseUrl)
  ? configuredBaseUrl
  : new URL(configuredBaseUrl, `${browserOrigin}/`).toString().replace(/\/$/, '');
