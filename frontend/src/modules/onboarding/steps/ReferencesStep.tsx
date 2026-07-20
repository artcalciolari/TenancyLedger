import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ChangeEvent } from 'react';
import type { FieldErrors } from '../schemas';
import { emptyReference } from '../state';
import type { TenantReferenceDraft } from '../types';

interface ReferencesStepProps {
  value: TenantReferenceDraft[];
  errors: FieldErrors;
  onChange: (value: TenantReferenceDraft[]) => void;
}

export function ReferencesStep({ value, errors, onChange }: ReferencesStepProps) {
  const update =
    (index: number, field: keyof TenantReferenceDraft) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = value.map((reference, itemIndex) =>
        itemIndex === index ? { ...reference, [field]: event.target.value } : reference,
      );
      onChange(next);
    };

  return (
    <Box>
      <Typography variant="h1" component="h2" sx={{ mb: 0.75 }}>
        Referências
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Cadastre ao menos duas pessoas que possam confirmar os dados do locatário.
      </Typography>
      {errors.references && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.references}
        </Alert>
      )}
      <Stack spacing={2}>
        {value.map((reference, index) => (
          <Card key={index}>
            <CardContent sx={{ p: { xs: 2, md: 2.75 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
                <Typography variant="h2" sx={{ flex: 1 }}>
                  Referência {index + 1}
                  {index < 2 ? ' · obrigatória' : ''}
                </Typography>
                {value.length > 2 && (
                  <IconButton
                    aria-label={`Remover referência ${index + 1}`}
                    onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <DeleteOutlineOutlinedIcon />
                  </IconButton>
                )}
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <TextField
                  label="Nome"
                  value={reference.name}
                  onChange={update(index, 'name')}
                  error={Boolean(errors[`${index}.name`])}
                  helperText={errors[`${index}.name`]}
                />
                <TextField
                  label="Relação com o locatário"
                  value={reference.relationship}
                  onChange={update(index, 'relationship')}
                  error={Boolean(errors[`${index}.relationship`])}
                  helperText={errors[`${index}.relationship`]}
                />
                <TextField
                  label="Telefone"
                  type="tel"
                  inputMode="tel"
                  value={reference.phone}
                  onChange={update(index, 'phone')}
                  error={Boolean(errors[`${index}.phone`])}
                  helperText={errors[`${index}.phone`]}
                />
                <TextField
                  label="E-mail (opcional)"
                  type="email"
                  value={reference.email ?? ''}
                  onChange={update(index, 'email')}
                  error={Boolean(errors[`${index}.email`])}
                  helperText={errors[`${index}.email`]}
                />
              </Box>
            </CardContent>
          </Card>
        ))}
        <Button
          variant="outlined"
          startIcon={<AddOutlinedIcon />}
          onClick={() => onChange([...value, emptyReference()])}
          sx={{ alignSelf: 'flex-start' }}
        >
          Adicionar outra referência
        </Button>
      </Stack>
    </Box>
  );
}
