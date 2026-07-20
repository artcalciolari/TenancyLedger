import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, Stack, Typography } from '@mui/material';
import type { PropsWithChildren } from 'react';
import { brand } from '../app/theme/theme';

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <Box
      component="main"
      sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100dvh' }}
    >
      <Box
        sx={{
          flex: { md: '0 0 46%' },
          bgcolor: brand.sidebarBg,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 3, sm: 5, md: 7.5 },
          py: { xs: 4, md: 7 },
          minHeight: { xs: 260, md: 'auto' },
        }}
      >
        <Box
          component="svg"
          aria-hidden
          viewBox="0 0 400 400"
          sx={{
            position: 'absolute',
            top: -130,
            right: -130,
            width: 420,
            height: 420,
            opacity: 0.1,
          }}
        >
          {Array.from({ length: 14 }, (_, ring) => (
            <circle
              key={ring}
              cx="200"
              cy="200"
              r={30 + ring * 12}
              fill="none"
              stroke={brand.latao}
              strokeWidth="0.8"
            />
          ))}
        </Box>
        <Box
          component="svg"
          aria-hidden
          viewBox="0 0 400 400"
          sx={{
            position: 'absolute',
            bottom: -150,
            left: -110,
            width: 380,
            height: 380,
            opacity: 0.08,
          }}
        >
          {Array.from({ length: 12 }, (_, ring) => (
            <circle
              key={ring}
              cx="200"
              cy="200"
              r={34 + ring * 13}
              fill="none"
              stroke={brand.accentBright}
              strokeWidth="0.8"
            />
          ))}
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', position: 'relative' }}>
          <Box
            aria-hidden
            sx={{
              width: 40,
              height: 40,
              borderRadius: '4px',
              border: `1px solid ${brand.latao}`,
              color: brand.latao,
              fontFamily: brand.fontDisplay,
              fontWeight: 560,
              fontSize: '1.15rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            TL
          </Box>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Tenancy Ledger
          </Typography>
        </Stack>
        <Box sx={{ mt: 'auto', pt: { xs: 4, md: 0 }, position: 'relative' }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: brand.fontDisplay,
              fontSize: { xs: '2rem', md: '2.7rem' },
              lineHeight: 1.12,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              mb: 2.5,
            }}
          >
            Suas locações, organizadas com calma.
          </Typography>
          <Typography
            sx={{
              fontSize: '1.05rem',
              lineHeight: 1.6,
              color: brand.sidebarItemInactiveFg,
              maxWidth: '38ch',
            }}
          >
            Contratos, faturas e pagamentos em um só lugar — com uma tela clara para cada tarefa do
            dia.
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: 'center',
            mt: 6,
            color: brand.sidebarFooterMuted,
            fontSize: '0.85rem',
            position: 'relative',
          }}
        >
          <Box sx={{ width: 28, height: 2, bgcolor: brand.latao }} />
          <LockOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
            Acesso seguro e privado
          </Typography>
        </Stack>
      </Box>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: brand.surface,
          p: { xs: 3, sm: 5 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Typography
            component="h2"
            sx={{
              fontFamily: brand.fontDisplay,
              fontSize: '2rem',
              fontWeight: 500,
              color: brand.textPrimary,
              mb: 0.75,
            }}
          >
            Entrar
          </Typography>
          <Typography sx={{ color: brand.textSecondary, fontSize: '0.98rem', mb: 4 }}>
            Use o e-mail e a senha da sua conta.
          </Typography>
          {children}
          <Typography
            sx={{ mt: 3.5, fontSize: '0.82rem', color: brand.textSecondary, textAlign: 'center' }}
          >
            Problemas para acessar? Fale com o administrador do sistema.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
