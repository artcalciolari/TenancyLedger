import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

interface PlaceholderPageProps {
  title: string;
  description: string;
  action?: { label: string; to: string };
  kind?: 'default' | 'forbidden' | 'not-found';
}

export function PlaceholderPage({
  title,
  description,
  action,
  kind = 'default',
}: PlaceholderPageProps) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" variant="h1" gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
      </Box>
      {kind === 'forbidden' && (
        <Alert severity="warning">Seu papel não permite acessar este recurso.</Alert>
      )}
      {kind === 'not-found' && <Alert severity="info">A página solicitada não existe.</Alert>}
      {kind === 'default' && (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
          <Typography color="text.secondary">
            A estrutura desta tela está pronta para receber o módulo de domínio.
          </Typography>
        </Paper>
      )}
      {action && (
        <Box>
          <Button component={RouterLink} to={action.to}>
            {action.label}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
