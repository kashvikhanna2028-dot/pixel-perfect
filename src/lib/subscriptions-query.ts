import { queryOptions } from '@tanstack/react-query';
import { getSubscriptionData } from './subscriptions.functions';
export const subscriptionQueryOptions = queryOptions({ queryKey: ['subscriptions'], queryFn: () => getSubscriptionData(), staleTime: 30_000 });
