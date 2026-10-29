# Expiry Radar Companion (Chrome extension, private test build)

Reads the AI plan usage you can already see on claude.ai and keeps Expiry
Radar in step with it. Two capture modes, because Claude shows different
things on different plans:

- **Paid plans (Pro/Max): usage meters.** When you open
  **claude.ai → Settings → Usage**, the extension reads the session and
  weekly percentages and reset text shown on that page, and syncs them to a
  tracker you explicitly linked.
- **Free plan: limit notices.** Claude Free has no usage meters at all - its
  session limit varies with demand and Claude only tells you when you hit it
  (https://support.claude.com/en/articles/8114491). The extension watches
  your chat pages for that limit notice and shows it, with any reset time,
  in the popup. It never invents a percentage and never counts your
  messages: on Free there is no remaining-usage figure to display.

Ordinary ChatGPT chat usage is not included: OpenAI does not show a
comparable usage meter for it.

## How syncing works (paid-plan meters only)

1. You link a tracker to a provider and figure in the tracker's settings
   (Automatic sync → Claude → Weekly or Session). Manual trackers are never
   touched, and trackers are never matched by name.
2. When your Expiry Radar dashboard is open in a tab, a captured reading is
   handed to the page, which saves it with your existing signed-in session
   through the `apply_external_usage_reading` database function. That
   function locks the tracker row, rejects a reading it has already applied,
   and only ever writes an increase - a decrease means the provider reset
   first, and your own reset schedule catches up. Nothing is written
   backwards or twice.
3. The popup shows what happened: "saved to dashboard" means the database
   confirmed the write; "not saved" or "waiting for dashboard tab" means it
   did not. Delivery and saving are reported separately on purpose.

Limit notices never sync - they carry no usage figure, so there is nothing
honest to write. They appear in the popup only.

## Honest freshness

- A meter reading describes the last time the Usage page was open. The popup
  shows its capture age and marks it outdated after an hour; reopen
  Settings → Usage to refresh.
- A limit notice belongs to a session limit that resets every five hours.
  The popup marks it expired after that (or once its stated reset time has
  passed) and says the current allowance is unknown.
- A notice detected outside alert-style page UI is shown as a "possible"
  notice (unconfirmed), never as authoritative.

## What it never does

- No passwords, cookies, session tokens or login data are read, stored or
  sent. The extension reads only numbers and notices visible on the page,
  and only the Expiry Radar page itself writes to your account.
- Nothing is sent to any third party. Readings go from the Claude tab to
  your own Expiry Radar tab, nowhere else.
- It is not always-on tracking: meters are captured when you open the usage
  page; notices are captured when Claude shows one.
- No quota inference on the free plan. Ever.

## Permissions (all visible in manifest.json)

- `storage`: remembers the latest reading and notice so they can sync and
  display when you open the popup or dashboard.
- Host access to `claude.ai`, `exptrack.site`, and the Lovable preview URL.
  Nothing else.

## Install (private testing)

1. Open `chrome://extensions` in Chrome on your laptop.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Paid plan: sign in to Expiry Radar in one tab, open
   claude.ai → Settings → Usage in another, and watch the dashboard toast
   and tracker. Free plan: just use Claude; if you reach a limit, the popup
   shows the notice and its reset time.

## Known limits of this build

- Sync requires the `drizzle/migrations/0007_external_usage_sync.sql`
  migration to be applied to the app's Supabase project. Until it is, the
  dashboard shows "automatic sync is in preview" and saves nothing.
- Both readers are text-pattern based. Anthropic can change page layouts;
  if numbers or notices stop appearing, the parsers need an update.
- The free-plan notice wording is undocumented: the matcher is deliberately
  strict (chat message text is never treated as a notice), and the first
  real notice on a live free account is its validation event.
- Not yet verified against a live signed-in Claude account - first run on
  your own account is the real test.
- Chrome desktop only.
