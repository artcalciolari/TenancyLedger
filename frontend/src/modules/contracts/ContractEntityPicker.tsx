import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { Paginated, PropertyView, TenantView, UnitType } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { propertiesApi } from '../properties/api';
import { tenantsApi } from '../tenants/api';

interface EntityPickerProps<T extends { id: string }> {
  value: string;
  onChange: (id: string) => void;
  label: string;
  dialogTitle: string;
  list: (filters: SearchableListFilters) => Promise<Paginated<T>>;
  get: (id: string) => Promise<T>;
  listKey: (filters: SearchableListFilters) => readonly unknown[];
  detailKey: (id: string) => readonly unknown[];
  primary: (item: T) => ReactNode;
  secondary: (item: T) => ReactNode;
  selectedSummary: (item: T) => string;
  avatar: (item: T) => ReactNode;
}

interface SearchableListFilters {
  page: number;
  limit: number;
  q?: string;
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function InitialAvatar({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        bgcolor: brand.accentTint,
        color: brand.accentDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.9rem',
        flexShrink: 0,
      }}
    >
      {label.charAt(0).toUpperCase() || '?'}
    </Box>
  );
}

function IconAvatar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: 38,
        height: 38,
        borderRadius: '10px',
        bgcolor: brand.accentTint,
        color: brand.accentDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        '& svg': { fontSize: 20 },
      }}
    >
      {children}
    </Box>
  );
}

function EntityPicker<T extends { id: string }>({
  value,
  onChange,
  label,
  dialogTitle,
  list,
  get,
  listKey,
  detailKey,
  primary,
  secondary,
  selectedSummary,
  avatar,
}: EntityPickerProps<T>) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [draftId, setDraftId] = useState(value);
  const filters = { page, limit, q: query || undefined };
  const selected = useQuery({
    queryKey: detailKey(value),
    queryFn: () => get(value),
    enabled: Boolean(value),
  });
  const options = useQuery({
    queryKey: listKey(filters),
    queryFn: () => list(filters),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const openDialog = () => {
    setDraftId(value);
    setOpen(true);
  };

  const confirm = () => {
    if (!draftId) return;
    onChange(draftId);
    setOpen(false);
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(draftQuery.trim());
    setPage(1);
  };

  return (
    <>
      <Box
        sx={{
          border: `1.5px solid ${brand.borderInput}`,
          borderRadius: '11px',
          p: 2,
          bgcolor: brand.surface,
        }}
      >
        <Typography
          component="div"
          sx={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: brand.textSecondary,
            mb: 1,
          }}
        >
          {label}
        </Typography>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
          {value && selected.data ? avatar(selected.data) : null}
          <Typography sx={{ minHeight: 24, overflowWrap: 'anywhere', fontWeight: 600 }}>
            {value
              ? selected.data
                ? selectedSummary(selected.data)
                : `Identificador ${shortId(value)}`
              : 'Nenhum selecionado'}
          </Typography>
        </Stack>
        <Button variant="outlined" onClick={openDialog}>
          {value ? 'Alterar seleção' : 'Selecionar'}
        </Button>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="md"
        aria-labelledby={`${label}-picker-title`}
      >
        <DialogTitle id={`${label}-picker-title`}>{dialogTitle}</DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box component="form" onSubmit={applySearch} sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label={`Buscar ${label.toLocaleLowerCase('pt-BR')}`}
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              helperText="A busca é aplicada ao confirmar."
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
              Buscar
            </Button>
          </Box>
          {options.isPending ? (
            <LoadingState label="Carregando opções…" />
          ) : options.isError ? (
            <ProblemAlert error={options.error} onRetry={() => void options.refetch()} />
          ) : options.data.data.length === 0 ? (
            <EmptyState
              title={query ? 'Nenhuma opção encontrada' : 'Nenhuma opção cadastrada'}
              description={query ? 'Revise a busca e tente novamente.' : undefined}
            />
          ) : (
            <Box>
              <List aria-label={dialogTitle} disablePadding>
                {options.data.data.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={draftId === item.id}
                    onClick={() => setDraftId(item.id)}
                    sx={{
                      borderRadius: '11px',
                      minHeight: 64,
                      mb: 0.5,
                      gap: 1.5,
                      '&:hover': { bgcolor: brand.surfaceSubtle },
                      '&.Mui-selected': { bgcolor: brand.accentTint },
                      '&.Mui-selected:hover': { bgcolor: brand.accentTint },
                    }}
                  >
                    {avatar(item)}
                    <ListItemText primary={primary(item)} secondary={secondary(item)} />
                    <ListItemIcon sx={{ minWidth: 32, justifyContent: 'flex-end' }}>
                      {draftId === item.id ? (
                        <CheckCircleIcon color="primary" />
                      ) : (
                        <RadioButtonUncheckedIcon color="disabled" />
                      )}
                    </ListItemIcon>
                  </ListItemButton>
                ))}
              </List>
              <PaginationBar
                meta={options.data.meta}
                onChange={(nextPage, nextLimit) => {
                  setPage(nextPage);
                  setLimit(nextLimit);
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={!draftId}>
            Confirmar seleção
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function TenantPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <EntityPicker<TenantView>
      value={value}
      onChange={onChange}
      label="Locatário"
      dialogTitle="Selecionar locatário"
      list={tenantsApi.list}
      get={tenantsApi.get}
      listKey={queryKeys.tenants}
      detailKey={queryKeys.tenant}
      primary={(tenant) => `${tenant.name} · ${tenant.profession}`}
      secondary={(tenant) => `${tenant.email} · ${tenant.mobilePhone}`}
      selectedSummary={(tenant) => `${tenant.name} · ${tenant.cpf}`}
      avatar={(tenant) => <InitialAvatar label={tenant.name} />}
    />
  );
}

const unitTypeLabels: Record<UnitType, string> = {
  KITNET: 'Kitnet',
  ROOM: 'Quarto',
  APARTMENT: 'Apartamento',
  HOUSE: 'Casa',
  COMMERCIAL: 'Comercial',
};

export function PropertyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <EntityPicker<PropertyView>
      value={value}
      onChange={onChange}
      label="Imóvel"
      dialogTitle="Selecionar imóvel"
      list={propertiesApi.list}
      get={propertiesApi.get}
      listKey={queryKeys.properties}
      detailKey={queryKeys.property}
      primary={(property) => `Unidade ${property.unitNumber} · ${property.neighborhood}`}
      secondary={(property) => unitTypeLabels[property.type]}
      selectedSummary={(property) =>
        `Unidade ${property.unitNumber} · ${property.neighborhood} · ${unitTypeLabels[property.type]}`
      }
      avatar={() => (
        <IconAvatar>
          <HomeWorkOutlinedIcon />
        </IconAvatar>
      )}
    />
  );
}
