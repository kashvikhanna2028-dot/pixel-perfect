import { queryOptions } from '@tanstack/react-query';
import { getBillingData } from './payments.functions';

export const billingQueryOptions = queryOptions({
  queryKey: ['billing'],
  queryFn: () => getBillingData(),
  staleTime: 30_000,
});
