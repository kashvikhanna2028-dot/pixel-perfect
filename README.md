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

## Opt-in email reminders

Email reminders default **off**. Settings lets each account opt in, choose its time zone
and 1/3/7-day window, and request a test email to its own verified account address.
The test request does not enable scheduled reminders or consume a renewal delivery.

`POST /api/public/send-reminders` requires the `X-Reminder-Cron-Secret` header to match
the server-side `REMINDER_CRON_SECRET`; missing or incorrect secrets receive 401.
Recipients are selected server-side from opted-in profiles. Responses contain only
`sent`, `duplicate`, `would_send`, and `failed` counts, never recipient information.
Only active plans due today through the account's selected window are included;
trials use the trial-end date. No email is sent for already overdue events.

### Activate delivery

The provider connection was skipped during implementation. **No live delivery or
schedule is enabled.** Lovable Emails is the built-in alternative; this implementation
provides a Resend BYOK adapter for the provider requested in the brief.

1. Create a Resend account, verify your sending domain, and obtain an API key.
2. Save `REMINDER_RESEND_API_KEY` as a server-side secret in Lovable project settings.
   This adapter uses a direct Resend API key, not a connector-gateway credential.
3. Set `REMINDER_EMAIL_FROM` to a sender on your verified domain, such as
   `Expiry Radar <reminders@your-verified-domain>` (replace with your actual sender).
   The Resend onboarding sender only works for owner-directed tests, not app users.
4. Save `REMINDER_CRON_SECRET` securely. Use the same strong random value in your
   external scheduler's protected header field; never commit or log it.
5. Publish the updated app after configuring secrets, then use Settings →
   **Send me a test reminder**. Enable email reminders and save settings if desired.

Without both provider key and sender, dispatch logs only `would send` plus a count,
does not write delivery records, and Settings explains that email is not connected.

### Daily scheduling

Configure an external cron service to make a **POST** once daily, for example at
`0 0 * * *` UTC, to `https://life-expiry-guide.lovable.app/api/public/send-reminders`,
with `X-Reminder-Cron-Secret` set using the scheduler's secure secret field. Do not
put the secret in the URL. Set a sufficient request timeout and alert on non-2xx
responses. A daily UTC run evaluates each recipient's current local calendar date.
Alternatively an administrator can configure pg_cron + pg_net with the same POST
and securely stored header; this app does not install a schedule automatically.

Each delivery is reserved in `reminder_deliveries` **before** calling Resend, using
a unique `(user_id, subscription_id, kind, billing_date)` constraint plus a provider
idempotency key. Only the service role can write reservations. `sent_at` is NULL
while reserved or after uncertain failure; it is set after provider acceptance.
Reservations are retained after failures to guarantee at-most-one send attempt:
this intentionally favors avoiding duplicates over automatically retrying delivery.
Review the provider's delivery history before manually recovering a failed reminder.

## Synced notification reads

The bell includes unrated active plans each month. Read acknowledgements are saved
privately in `notification_reads`, scoped to the account. Updates are optimistic,
roll back on failure, and refresh on focus and every 15 seconds across devices.
Existing local `subscription-read-<user_id>` acknowledgements are migrated on load;
the local copy is cleared only after successful persistence. Renewal/trial keys
include the billing date; unrated keys include the month, so new events are unread.

## Tests

Run `bunx vitest run src/lib/subscriptions.test.ts src/lib/expiry-radar.test.ts src/test/app-routing.test.tsx src/lib/subscription-notifications.test.ts src/lib/subscription-reminders.test.ts`.
