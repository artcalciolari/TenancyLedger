import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import HouseOutlinedIcon from '@mui/icons-material/HouseOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import type { UnitType } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { UnitOccupancyChip } from '../../components/data-display/OccupancyChip';
import { TechnicalDetails } from '../../components/data-display/TechnicalDetails';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatDateTime } from '../../lib/dates/dates';
import { propertiesApi } from './api';
import { unitTypeLabel } from './labels';
import { useAuth } from '../auth/useAuth';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { EditPropertyDialog } from './EditPropertyDialog';
import type { UpdatePropertyInput } from '../../api/contract';

const typeIcons: Record<UnitType, ReactNode> = {
  APARTMENT: <ApartmentOutlinedIcon sx={{ fontSize: 26 }} />,
  HOUSE: <HouseOutlinedIcon sx={{ fontSize: 26 }} />,
  COMMERCIAL: <StorefrontOutlinedIcon sx={{ fontSize: 26 }} />,
  KITNET: <BedOutlinedIcon sx={{ fontSize: 26 }} />,
  ROOM: <BedOutlinedIcon sx={{ fontSize: 26 }} />,
};

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: brand.textTertiary,
};

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography sx={uppercaseLabelSx}>{label}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere', mt: 0.5, color: brand.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}

export function PropertyDetailPage() {
  const { propertyId = '' } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const property = useQuery({
    queryKey: queryKeys.property(propertyId),
    queryFn: () => propertiesApi.get(propertyId),
    enabled: Boolean(propertyId),
  });
  const updateProperty = useMutation({
    mutationFn: (input: UpdatePropertyInput) => propertiesApi.update(propertyId, input),
  });
  const mayEdit = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));

  const submitEdit = async (input: UpdatePropertyInput) => {
    const updated = await updateProperty.mutateAsync(input);
    queryClient.setQueryData(queryKeys.property(propertyId), updated);
    const invalidations = [queryClient.invalidateQueries({ queryKey: ['properties'] })];
    if (updated.buildingId) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.building(updated.buildingId) }),
        queryClient.invalidateQueries({ queryKey: ['buildings'] }),
      );
    }
    await Promise.all(invalidations);
  };

  const closeEdit = () => {
    updateProperty.reset();
    setEditOpen(false);
  };
  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/properties"
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
        Voltar para imóveis
      </Stack>
      {property.isPending ? (
        <LoadingState label="Carregando imóvel…" />
      ) : property.isError ? (
        <ProblemAlert error={property.error} onRetry={() => void property.refetch()} />
      ) : (
        <>
          <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center', mb: 3 }}>
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
              {typeIcons[property.data.type]}
            </Box>
            <Box>
              <Typography component="h1" variant="h1">
                {property.data.neighborhood} · Unid. {property.data.unitNumber}
              </Typography>
              <Typography sx={{ color: brand.textSecondary }}>
                {unitTypeLabel(property.data.type)}
              </Typography>
            </Box>
            {mayEdit ? (
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                sx={{ ml: 'auto' }}
                onClick={() => {
                  updateProperty.reset();
                  setEditOpen(true);
                }}
              >
                Editar
              </Button>
            ) : null}
          </Stack>
          <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 3,
              }}
            >
              <DetailField label="Bairro" value={property.data.neighborhood} />
              <DetailField label="Número da unidade" value={property.data.unitNumber} />
              <DetailField label="Tipo" value={unitTypeLabel(property.data.type)} />
              <DetailField
                label="Prédio"
                value={
                  property.data.buildingId ? (
                    <Typography
                      component={RouterLink}
                      to={`/buildings/${property.data.buildingId}`}
                      sx={{ color: brand.accent, fontWeight: 600, textDecoration: 'none' }}
                    >
                      {property.data.buildingName}
                    </Typography>
                  ) : (
                    'Sem prédio'
                  )
                }
              />
              <DetailField
                label="Situação"
                value={<UnitOccupancyChip occupied={property.data.occupied} />}
              />
              <DetailField label="Cadastrado em" value={formatDateTime(property.data.createdAt)} />
            </Box>
            <TechnicalDetails id={property.data.id} />
          </Card>
          <EditPropertyDialog
            property={property.data}
            open={editOpen}
            isPending={updateProperty.isPending}
            error={updateProperty.error}
            onClose={closeEdit}
            onSubmit={submitEdit}
          />
        </>
      )}
    </>
  );
}
