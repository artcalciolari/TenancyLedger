import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
import { ApiError } from '../../api/problem';

interface ProblemAlertProps {
  error: unknown;
  onRetry?: () => void;
}

export function ProblemAlert({ error, onRetry }: ProblemAlertProps) {
  const problem = error instanceof ApiError ? error.problem : null;
  return (
    <Alert
      severity="error"
      action={onRetry ? <Button onClick={onRetry}>Tentar novamente</Button> : undefined}
    >
      <AlertTitle>Não foi possível concluir a operação</AlertTitle>
      <Stack spacing={0.5}>
        <Typography variant="body2">
          {problem?.detail ?? 'Ocorreu um erro inesperado. Tente novamente.'}
        </Typography>
        {problem?.errors?.map((message) => (
          <Typography component="span" variant="body2" key={message}>
            {message}
          </Typography>
        ))}
        {problem?.requestId && (
          <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            Referência: {problem.requestId}
          </Box>
        )}
      </Stack>
    </Alert>
  );
}
