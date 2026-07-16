import { Box } from '@mui/material';
import { statusTones, type StatusTone } from '../../app/theme/theme';

function ToneChip({ tone, label }: { tone: StatusTone; label: string }) {
  const palette = statusTones[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.85,
        height: 26,
        px: 1.35,
        borderRadius: '8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        bgcolor: palette.bg,
        color: palette.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: palette.dot, flexShrink: 0 }}
      />
      {label}
    </Box>
  );
}

export function UnitOccupancyChip({ occupied }: { occupied: boolean }) {
  return <ToneChip tone={occupied ? 'success' : 'neutral'} label={occupied ? 'Ocupado' : 'Vago'} />;
}

export function BuildingOccupancyChip({
  occupiedUnits,
  totalUnits,
}: {
  occupiedUnits: number;
  totalUnits: number;
}) {
  if (totalUnits === 0) {
    return <ToneChip tone="neutral" label="Sem unidades" />;
  }
  const tone: StatusTone =
    occupiedUnits >= totalUnits ? 'success' : occupiedUnits === 0 ? 'neutral' : 'info';
  return <ToneChip tone={tone} label={`${occupiedUnits} ocupadas / ${totalUnits} unidades`} />;
}
