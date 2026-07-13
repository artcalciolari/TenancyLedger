import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContractListFilters, CreateContractInput } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { contractsApi } from './api';

export function useContracts(filters: ContractListFilters) {
  return useQuery({
    queryKey: queryKeys.contracts(filters),
    queryFn: () => contractsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: queryKeys.contract(id),
    queryFn: () => contractsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) => contractsApi.create(input),
    onSuccess: (contract) => {
      queryClient.setQueryData(queryKeys.contract(contract.id), contract);
      return queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useRenewContract(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (extraMonths: number) => contractsApi.renew(id, { extraMonths }),
    onSuccess: (contract) => {
      queryClient.setQueryData(queryKeys.contract(id), contract);
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
