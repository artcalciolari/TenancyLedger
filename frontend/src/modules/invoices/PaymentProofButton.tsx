import { LaunchOutlined, ReceiptOutlined } from '@mui/icons-material';
import { Alert, Button, Link, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api/problem';
import { brand } from '../../app/theme/theme';
import { invoicesApi } from './api';

interface ProofAccess {
  url: string;
  expiresAt: number;
}

export function PaymentProofButton({
  invoiceId,
  paymentId,
}: {
  invoiceId: string;
  paymentId: string;
}) {
  const [access, setAccess] = useState<ProofAccess | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!access) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((access.expiresAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setAccess(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [access]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoicesApi.proof(invoiceId, paymentId);
      setAccess({ url: response.url, expiresAt: Date.now() + response.expiresInSeconds * 1000 });
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError ? caught.problem.detail : 'Não foi possível gerar o acesso.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      {access ? (
        <>
          <Link
            href={access.url}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{
              display: 'inline-flex',
              gap: 0.75,
              alignItems: 'center',
              fontSize: '0.86rem',
              fontWeight: 600,
              color: 'primary.main',
            }}
          >
            Abrir comprovante <LaunchOutlined sx={{ fontSize: 18 }} />
          </Link>
          <Typography variant="caption" sx={{ color: brand.textTertiary }}>
            Link temporário: {remaining}s restantes
          </Typography>
        </>
      ) : (
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReceiptOutlined sx={{ fontSize: 19 }} />}
          onClick={generate}
          disabled={loading}
          sx={{
            height: 40,
            borderColor: brand.borderInput,
            color: 'primary.main',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          {loading ? 'Gerando…' : 'Ver comprovante'}
        </Button>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
