import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import type { PropsWithChildren } from 'react';

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <Box
      component="main"
      sx={{
        alignItems: 'center',
        background: 'linear-gradient(135deg, #eef4fa 0%, #f8fafc 55%, #e8f0f8 100%)',
        display: 'flex',
        minHeight: '100dvh',
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={2} sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1} sx={{ mb: 4 }}>
            <Typography component="h1" variant="h1" color="primary.dark">
              Tenancy Ledger
            </Typography>
            <Typography color="text.secondary">Gestão de locações</Typography>
          </Stack>
          {children}
        </Paper>
      </Container>
    </Box>
  );
}
