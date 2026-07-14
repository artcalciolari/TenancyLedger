import CodeOutlined from '@mui/icons-material/CodeOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { brand } from '../../app/theme/theme';

export function TechnicalDetails({ id }: { id: string }) {
  return (
    <Box component="details" sx={{ mt: 2, pt: 1.75, borderTop: `1px solid ${brand.borderRow}` }}>
      <Box
        component="summary"
        sx={{
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: brand.textTertiary,
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          '&::-webkit-details-marker': { display: 'none' },
        }}
      >
        <CodeOutlined sx={{ fontSize: 18 }} /> Dados técnicos
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 1.25,
          alignItems: 'center',
          bgcolor: brand.surfaceSubtle,
          border: `1px solid ${brand.borderCard}`,
          borderRadius: '9px',
          px: 1.5,
          py: 1,
        }}
      >
        <Typography
          sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '0.78rem',
            color: brand.textSecondary,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {id}
        </Typography>
        <IconButton size="small" aria-label="Copiar identificador" onClick={() => navigator.clipboard.writeText(id)}>
          <ContentCopyOutlined fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}
