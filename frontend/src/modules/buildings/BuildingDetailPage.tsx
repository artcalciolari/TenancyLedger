import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { Box, Card, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { BuildingOccupancyChip, UnitOccupancyChip } from '../../components/data-display/OccupancyChip';
import { TechnicalDetails } from '../../components/data-display/TechnicalDetails';
import { EmptyState } from '../../components/feedback/QueryState';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { unitTypeLabel } from '../properties/labels';
import { buildingsApi } from './api';

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: brand.textTertiary,
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={uppercaseLabelSx}>{label}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere', mt: 0.5, color: brand.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}

export function BuildingDetailPage() {
  const { buildingId = '' } = useParams();
  const building = useQuery({
    queryKey: queryKeys.building(buildingId),
    queryFn: () => buildingsApi.get(buildingId),
    enabled: Boolean(buildingId),
  });

  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/buildings"
        spacing={0.75}
        sx={{
          alignItems: 'center',
          width: 'fit-content',
          mb: 1.75,
          color: brand.textSecondary,
          textDecoration: 'none',
          fontSize: '0.88rem',
          fontWeight: 600,
          '&:hover': { color: brand.textPrimary },
        }}
      >
        <ArrowBackOutlined sx={{ fontSize: 19 }} />
        Voltar para prédios
      </Stack>
      {building.isPending ? (
        <LoadingState label="Carregando prédio…" />
      ) : building.isError ? (
        <ProblemAlert error={building.error} onRetry={() => void building.refetch()} />
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.75}
            sx={{ alignItems: { sm: 'center' }, mb: 3 }}
          >
            <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '14px',
                  bgcolor: brand.accentTint,
                  color: brand.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ApartmentOutlinedIcon sx={{ fontSize: 26 }} />
              </Box>
              <Box>
                <Typography component="h1" variant="h1">
                  {building.data.name}
                </Typography>
                <Typography sx={{ color: brand.textSecondary }}>
                  {building.data.neighborhood}
                  {building.data.address ? ` · ${building.data.address}` : ''}
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ ml: { sm: 'auto' } }}>
              <BuildingOccupancyChip
                occupiedUnits={building.data.occupiedUnits}
                totalUnits={building.data.totalUnits}
              />
            </Box>
          </Stack>
          <Card sx={{ p: { xs: 2.25, sm: 2.75 }, mb: 2.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 3,
              }}
            >
              <DetailField label="Bairro" value={building.data.neighborhood} />
              <DetailField label="Endereço" value={building.data.address ?? '—'} />
            </Box>
            <TechnicalDetails id={building.data.id} />
          </Card>
          <Typography component="h2" variant="h2" sx={{ mb: 1.5 }}>
            Unidades
          </Typography>
          {building.data.units.length === 0 ? (
            <EmptyState title="Nenhuma unidade vinculada a este prédio" />
          ) : (
            <Card sx={{ p: 0 }}>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Unidade</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Situação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {building.data.units.map((unit) => (
                      <TableRow key={unit.id} hover>
                        <TableCell>
                          <Typography
                            component={RouterLink}
                            to={`/properties/${unit.id}`}
                            sx={{
                              fontWeight: 600,
                              color: brand.textPrimary,
                              textDecoration: 'none',
                              '&:hover': { color: brand.accent },
                            }}
                          >
                            {unit.unitNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>{unitTypeLabel(unit.type)}</TableCell>
                        <TableCell>
                          <UnitOccupancyChip occupied={unit.occupied} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      )}
    </>
  );
}
