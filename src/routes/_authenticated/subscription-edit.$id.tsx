import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionEditor } from '@/components/subscriptions';
import { subscriptionQueryOptions } from '@/lib/subscriptions-query';
export const Route = createFileRoute('/_authenticated/subscription-edit/$id')({
 loader: ({context}) => context.queryClient.ensureQueryData(subscriptionQueryOptions),
 head: () => ({meta:[{title:'Edit subscription — Expiry Radar'},{name:'description',content:'Update a subscription price, billing date, trial, or status.'},{property:'og:title',content:'Edit subscription — Expiry Radar'},{property:'og:description',content:'Update a subscription price, billing date, trial, or status.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: EditPage,
});
function EditPage() { const {id} = Route.useParams(); return <SubscriptionEditor key={id} subscriptionId={id}/>; }
