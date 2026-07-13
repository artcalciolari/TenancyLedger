import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Paper,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { PageHeader } from '../../components/data-display/PageHeader';
import { parseBrlToCents } from '../../lib/money/money';
import { isUuid } from './filters';
import { useCreateContract } from './hooks';
import { PropertyPicker, TenantPicker } from './ContractEntityPicker';
import { createContractSchema, type CreateContractForm } from './schemas';

function initialId(searchParams: URLSearchParams, key: string): string {
  const value = searchParams.get(key) ?? '';
  return isUuid(value) ? value : '';
}

export function NewContractPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createContract = useCreateContract();
  const {
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors },
  } = useForm<CreateContractForm>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      tenantId: initialId(searchParams, 'tenantId'),
      propertyUnitId: initialId(searchParams, 'propertyUnitId'),
      moveInDate: '',
      monthlyBaseValue: '',
      durationInMonths: 12,
      billingDay: null,
      isRenewable: true,
    },
  });

  const submit = handleSubmit(async (values) => {
    const monthlyBaseValueCents = parseBrlToCents(values.monthlyBaseValue);
    if (monthlyBaseValueCents === null) {
      setError('monthlyBaseValue', { message: 'Informe um aluguel mensal válido.' });
      return;
    }
    const contract = await createContract.mutateAsync({
      tenantId: values.tenantId,
      propertyUnitId: values.propertyUnitId,
      moveInDate: values.moveInDate,
      monthlyBaseValueCents,
      durationInMonths: values.durationInMonths,
      isRenewable: values.isRenewable,
      billingDay: values.billingDay ?? undefined,
    });
    void navigate(`/contracts/${contract.id}`, { replace: true });
  });

  return (
    <>
      <PageHeader
        title="Novo contrato"
        description="Defina o locatário, o imóvel e as condições da locação."
      />
      <Paper variant="outlined" sx={{ maxWidth: 800, p: { xs: 2, sm: 3 } }}>
        <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
          {createContract.isError && <ProblemAlert error={createContract.error} />}
          <Alert severity="info">
            O imóvel não poderá ter outro contrato com vigência sobreposta.
          </Alert>
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <FormControl error={Boolean(errors.tenantId)}>
                <TenantPicker value={field.value} onChange={field.onChange} />
                {errors.tenantId?.message && (
                  <FormHelperText>{errors.tenantId.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
          <Controller
            name="propertyUnitId"
            control={control}
            render={({ field }) => (
              <FormControl error={Boolean(errors.propertyUnitId)}>
                <PropertyPicker value={field.value} onChange={field.onChange} />
                {errors.propertyUnitId?.message && (
                  <FormHelperText>{errors.propertyUnitId.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              {...register('moveInDate')}
              label="Data de entrada"
              type="date"
              error={Boolean(errors.moveInDate)}
              helperText={errors.moveInDate?.message}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              {...register('monthlyBaseValue')}
              label="Aluguel mensal"
              placeholder="R$ 1.500,00"
              inputMode="decimal"
              error={Boolean(errors.monthlyBaseValue)}
              helperText={errors.monthlyBaseValue?.message ?? 'Informe o valor em reais.'}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              {...register('durationInMonths', { valueAsNumber: true })}
              label="Duração em meses"
              type="number"
              error={Boolean(errors.durationInMonths)}
              helperText={errors.durationInMonths?.message}
              slotProps={{ htmlInput: { min: 1, max: 600, step: 1 } }}
            />
            <TextField
              {...register('billingDay', {
                setValueAs: (value: unknown) => (value === '' ? null : Number(value)),
              })}
              label="Dia de cobrança"
              type="number"
              error={Boolean(errors.billingDay)}
              helperText={errors.billingDay?.message ?? 'Opcional; entre 1 e 28.'}
              slotProps={{ htmlInput: { min: 1, max: 28, step: 1 } }}
            />
          </Stack>
          <Controller
            name="isRenewable"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(_, checked) => field.onChange(checked)}
                  />
                }
                label="Este contrato permite renovação"
              />
            )}
          />
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button
              type="button"
              variant="text"
              onClick={() => void navigate('/contracts')}
              disabled={createContract.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createContract.isPending}
              aria-busy={createContract.isPending}
            >
              {createContract.isPending ? 'Criando…' : 'Criar contrato'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
