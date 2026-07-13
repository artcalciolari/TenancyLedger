import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Component, useEffect, useRef, type PropsWithChildren } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { reportClientError } from '../../lib/observability/client-observability';

interface ErrorFallbackProps {
  description?: string;
  title?: string;
}

export function AppErrorFallback({
  title = 'Não foi possível exibir esta página',
  description = 'Ocorreu um erro inesperado. Recarregue a aplicação ou volte ao início.',
}: ErrorFallbackProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <Box
      component="main"
      role="alert"
      sx={{ display: 'grid', minHeight: '100dvh', p: 2, placeItems: 'center' }}
    >
      <Paper variant="outlined" sx={{ maxWidth: 640, p: { xs: 3, sm: 5 }, width: '100%' }}>
        <Stack spacing={3}>
          <Box>
            <Typography ref={heading} component="h1" variant="h1" tabIndex={-1} gutterBottom>
              {title}
            </Typography>
            <Typography color="text.secondary">{description}</Typography>
          </Box>
          <Alert severity="error">Se o problema persistir, informe o horário da ocorrência.</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button startIcon={<RefreshOutlinedIcon />} onClick={() => window.location.reload()}>
              Recarregar
            </Button>
            <Button component="a" href="/" variant="outlined">
              Voltar ao início
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

interface AppRenderErrorBoundaryState {
  failed: boolean;
}

export class AppRenderErrorBoundary extends Component<
  PropsWithChildren,
  AppRenderErrorBoundaryState
> {
  state: AppRenderErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppRenderErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    reportClientError(error, { kind: 'RENDER' });
  }

  render() {
    return this.state.failed ? <AppErrorFallback /> : this.props.children;
  }
}

export function RouteErrorPage() {
  const error: unknown = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <AppErrorFallback
      title={notFound ? 'Página não encontrada' : undefined}
      description={
        notFound ? 'O endereço solicitado não existe. Volte ao início para continuar.' : undefined
      }
    />
  );
}
