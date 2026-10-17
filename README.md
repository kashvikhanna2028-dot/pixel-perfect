# Expiry Radar

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Subscriptions

The private `/subscriptions` page includes billing-cycle normalization, shared costs,
trials, filters, CSV export, monthly usage ratings, spending breakdowns, and a 30-day
renewal timeline. Different currencies are totaled separately; no exchange rates are
assumed. Current spending excludes free trials and paused/cancelled subscriptions.
Prices in demo data are illustrative, not current provider pricing.

Active auto-renewing plans advance overdue billing dates through an owner-scoped,
row-locking database function on load. Trials retain their separate trial end date until
the user records renewal, so an expired trial warning cannot disappear silently.
Manual renewal uses an expected-date check to prevent duplicate concurrent advances.
Calendar cycles retain the start-date day and clamp to the month's last day.
Pause and cancel are tracking states only: users must cancel with the provider to
actually stop payment. Cancelled plans and their ratings remain until deleted.

## Future email reminders

`src/lib/subscriptions.functions.ts` exports `prepareSubscriptionReminders`, an
authenticated, owner-scoped reminder preparation stub. It reads the user's timezone
and chosen 1/3/7-day reminder window, and returns due renewals and trials without
sending email. It is **not scheduled and not connected to an email provider**.
This TanStack Start app uses server functions rather than Edge Functions.
For future multi-user scheduled email delivery, add a signature-verified server route
under `/api/public/`, select recipients server-side, and persist per-renewal delivery
records to prevent duplicate messages. Never expose recipient data to anonymous callers.

The in-app bell also lists unrated active subscriptions each month. Read acknowledgements
are saved locally per account; subscriptions, ratings, currency, timezone, and reminder
preferences are saved privately in Lovable Cloud.

## Tests

Run `bunx vitest run src/lib/subscriptions.test.ts src/lib/expiry-radar.test.ts src/test/app-routing.test.tsx`.
