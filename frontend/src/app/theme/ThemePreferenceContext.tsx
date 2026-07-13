/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { PaletteMode } from '@mui/material/styles';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCE_STORAGE_KEY = 'tenancy-ledger:theme-preference:v1';

interface ThemePreferenceValue {
  preference: ThemePreference;
  resolvedMode: PaletteMode;
  setPreference: (preference: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemMode(): PaletteMode {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [preferredSystemMode, setPreferredSystemMode] = useState<PaletteMode>(systemMode);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) =>
      setPreferredSystemMode(event.matches ? 'dark' : 'light');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    try {
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextPreference);
    } catch {
      // A preferência continua válida para a sessão mesmo sem armazenamento local.
    }
  }, []);

  const value = useMemo<ThemePreferenceValue>(
    () => ({
      preference,
      resolvedMode: preference === 'system' ? preferredSystemMode : preference,
      setPreference,
    }),
    [preference, preferredSystemMode, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference deve ser usado dentro de ThemePreferenceProvider.');
  }
  return context;
}
