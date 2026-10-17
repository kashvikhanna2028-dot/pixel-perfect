import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionEditor } from '@/components/subscriptions';
import { subscriptionQueryOptions } from '@/lib/subscriptions-query';
export const Route = createFileRoute('/_authenticated/subscription-new')({
 loader: ({context}) => context.queryClient.ensureQueryData(subscriptionQueryOptions),
 head: () => ({meta:[{title:'Add subscription — Expiry Radar'},{name:'description',content:'Save a recurring plan or free trial with its billing schedule.'},{property:'og:title',content:'Add subscription — Expiry Radar'},{property:'og:description',content:'Save a recurring plan or free trial with its billing schedule.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: () => <SubscriptionEditor/>,
});
