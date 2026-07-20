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
        height: 24,
        px: 1,
        borderRadius: '3px',
        border: `1px solid ${palette.dot}80`,
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: palette.fg,
        whiteSpace: 'nowrap',
      }}
    >
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
