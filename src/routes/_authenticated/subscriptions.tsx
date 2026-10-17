import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionsPage } from '@/components/subscriptions';
import { subscriptionQueryOptions } from '@/lib/subscriptions-query';
export const Route = createFileRoute('/_authenticated/subscriptions')({
  loader: ({context}) => context.queryClient.ensureQueryData(subscriptionQueryOptions),
  head: () => ({ meta: [{title:'Subscriptions — Expiry Radar'},{name:'description',content:'Track subscription costs, renewal dates, trials, and monthly value.'},{property:'og:title',content:'Subscriptions — Expiry Radar'},{property:'og:description',content:'Track subscription costs, renewal dates, trials, and monthly value.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}] }),
  component: SubscriptionsPage,
  pendingComponent: () => <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading subscriptions">{[1,2,3,4].map(i => <div key={i} className="h-52 animate-pulse rounded-lg bg-muted"/>)}</div>,
});
