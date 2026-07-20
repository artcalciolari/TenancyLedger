import { Box, MenuItem, TextField, Typography } from '@mui/material';
import type { ChangeEvent } from 'react';
import { TENANT_CIVIL_STATUSES, type TenantCivilStatus } from '../../../api/contract';
import type { CreateTenantForm } from '../../tenants/schemas';
import { civilStatusLabel } from '../../tenants/labels';
import type { FieldErrors } from '../schemas';

interface PersonalDataStepProps {
  value: CreateTenantForm;
  errors: FieldErrors;
  onChange: (value: CreateTenantForm) => void;
}

export function PersonalDataStep({ value, errors, onChange }: PersonalDataStepProps) {
  const update = (field: keyof CreateTenantForm) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [field]: event.target.value });
  };

  return (
    <Box>
      <Typography variant="h1" component="h2" sx={{ mb: 0.75 }}>
        Dados pessoais
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Confira os documentos com o locatário antes de avançar.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.25,
        }}
      >
        <TextField
          label="Nome completo"
          value={value.name}
          onChange={update('name')}
          autoComplete="name"
          autoFocus
          error={Boolean(errors.name)}
          helperText={errors.name}
          sx={{ gridColumn: { md: '1 / -1' } }}
        />
        <TextField
          label="CPF"
          value={value.cpf}
          onChange={update('cpf')}
          inputMode="numeric"
          error={Boolean(errors.cpf)}
          helperText={errors.cpf}
        />
        <TextField
          label="RG"
          value={value.rg}
          onChange={update('rg')}
          autoCapitalize="characters"
          error={Boolean(errors.rg)}
          helperText={errors.rg}
        />
        <TextField
          label="Profissão"
          value={value.profession}
          onChange={update('profession')}
          error={Boolean(errors.profession)}
          helperText={errors.profession}
        />
        <TextField
          select
          label="Estado civil"
          value={value.civilStatus}
          onChange={(event) =>
            onChange({ ...value, civilStatus: event.target.value as TenantCivilStatus })
          }
          error={Boolean(errors.civilStatus)}
          helperText={errors.civilStatus}
        >
          {TENANT_CIVIL_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {civilStatusLabel(status)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="E-mail"
          type="email"
          value={value.email}
          onChange={update('email')}
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email}
        />
        <TextField
          label="Celular"
          type="tel"
          value={value.mobilePhone}
          onChange={update('mobilePhone')}
          autoComplete="tel"
          inputMode="tel"
          error={Boolean(errors.mobilePhone)}
          helperText={errors.mobilePhone}
        />
      </Box>
    </Box>
  );
}
