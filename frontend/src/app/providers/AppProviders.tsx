import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo, useState, type PropsWithChildren } from 'react';
import { ApiError } from '../../api/problem';
import { AuthProvider } from '../../modules/auth/AuthProvider';
import { createAppTheme } from '../theme/theme';
import { ThemePreferenceProvider, useThemePreference } from '../theme/ThemePreferenceContext';

function canRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  return error instanceof ApiError ? error.status === 0 || error.status >= 500 : true;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: canRetry,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <ThemePreferenceProvider>
      <ThemedProviders queryClient={queryClient}>{children}</ThemedProviders>
    </ThemePreferenceProvider>
  );
}

function ThemedProviders({
  children,
  queryClient,
}: PropsWithChildren<{ queryClient: QueryClient }>) {
  const { resolvedMode } = useThemePreference();
  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
