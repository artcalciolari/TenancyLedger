import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { formatCivilDate } from '../../../lib/dates/dates';
import { formatCents, parseBrlToCents } from '../../../lib/money/money';
import { civilStatusLabel } from '../../tenants/labels';
import type { FieldErrors } from '../schemas';
import { coveredCalendarPeriod } from '../state';
import type { AvailableProperty, OnboardingPayload } from '../types';

interface ReviewStepProps {
  payload: OnboardingPayload;
  selectedProperty: AvailableProperty | null;
  photoPreviewUrl: string | null;
  errors: FieldErrors;
  onMoveInDateChange: (date: string) => void;
  onMonthlyValueChange: (value: number | null) => void;
  onEdit: (step: number) => void;
}

function SectionHeading({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
      <Typography variant="h2" sx={{ flex: 1 }}>
        {title}
      </Typography>
      <Button variant="text" size="small" startIcon={<EditOutlinedIcon />} onClick={onEdit}>
        Editar
      </Button>
    </Stack>
  );
}

export function ReviewStep({
  payload,
  selectedProperty,
  photoPreviewUrl,
  errors,
  onMoveInDateChange,
  onMonthlyValueChange,
  onEdit,
}: ReviewStepProps) {
  const [monthlyValue, setMonthlyValue] = useState(() =>
    payload.monthlyBaseValueCents === null
      ? ''
      : (payload.monthlyBaseValueCents / 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
  );
  const period = coveredCalendarPeriod(payload.moveInDate);

  return (
    <Box>
      <Typography variant="h1" component="h2" sx={{ mb: 0.75 }}>
        Revisão do cadastro
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Leia o resumo com o locatário. Ao concluir, o contrato mensal ficará pendente de assinatura.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <SectionHeading title="Locatário" onEdit={() => onEdit(0)} />
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar
                  src={photoPreviewUrl ?? undefined}
                  alt=""
                  variant="rounded"
                  sx={{ width: 72, height: 72 }}
                >
                  {payload.personalData.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{payload.personalData.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    CPF {payload.personalData.cpf} · RG {payload.personalData.rg}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {payload.personalData.profession} ·{' '}
                    {civilStatusLabel(payload.personalData.civilStatus)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {payload.personalData.email} · {payload.personalData.mobilePhone}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionHeading title="Referências" onEdit={() => onEdit(2)} />
              <Stack divider={<Divider flexItem />} spacing={1.5}>
                {payload.references.map((reference, index) => (
                  <Box key={index}>
                    <Typography sx={{ fontWeight: 650 }}>{reference.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {reference.relationship} · {reference.phone}
                      {reference.email ? ` · ${reference.email}` : ''}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionHeading title="Quarto" onEdit={() => onEdit(3)} />
              {selectedProperty ? (
                <>
                  <Typography sx={{ fontWeight: 700 }}>
                    {selectedProperty.neighborhood} · Unidade {selectedProperty.unitNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedProperty.buildingName ?? 'Unidade independente'}
                  </Typography>
                </>
              ) : (
                <Typography color="text.secondary">
                  Unidade selecionada: {payload.propertyUnitId ?? 'nenhuma'}
                </Typography>
              )}
              {errors.propertyUnitId && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {errors.propertyUnitId}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Card sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h2" sx={{ mb: 2.5 }}>
              Condições do contrato
            </Typography>
            <Stack spacing={2.25}>
              <TextField
                label="Valor mensal"
                value={monthlyValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setMonthlyValue(value);
                  onMonthlyValueChange(parseBrlToCents(value));
                }}
                inputMode="decimal"
                error={Boolean(errors.monthlyBaseValueCents)}
                helperText={errors.monthlyBaseValueCents ?? 'Contrato mensal sem prazo final.'}
                slotProps={{
                  input: { startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> },
                }}
              />
              <TextField
                label="Data de entrada"
                type="date"
                value={payload.moveInDate}
                onChange={(event) => onMoveInDateChange(event.target.value)}
                error={Boolean(errors.moveInDate)}
                helperText={errors.moveInDate}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {period && (
                <Alert severity="info" icon={false}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Primeiro período mensal
                  </Typography>
                  <Typography variant="body2">
                    {formatCivilDate(period.start)} a {formatCivilDate(period.end)}
                  </Typography>
                  {payload.monthlyBaseValueCents !== null && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {formatCents(payload.monthlyBaseValueCents)} por mês-calendário
                    </Typography>
                  )}
                </Alert>
              )}
              <Divider />
              <Typography variant="body2" color="text.secondary">
                O contrato será criado como “Pendente de assinatura”. Nenhuma cobrança em dinheiro é
                registrada nesta etapa.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
