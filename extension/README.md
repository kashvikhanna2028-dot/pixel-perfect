# Expiry Radar Companion (Chrome extension, private test build)

Reads the AI plan usage meters you can already see on claude.ai and keeps
Expiry Radar in step with them.

When you open **claude.ai → Settings → Usage** on a paid plan (Pro/Max),
the extension reads the session and weekly percentages and reset text shown
on that page, and syncs them to a tracker you explicitly linked. Claude's
free plan shows no usage meters at all, so there is nothing to read there:
this build does not track free-plan usage, never invents a percentage, and
never counts messages.

Ordinary ChatGPT chat usage is not included: OpenAI does not show a
comparable usage meter for it.

## How syncing works

Provider readings are saved as timestamped **snapshots**, never merged into
a tracker's numbers. A provider's reset boundary is text on its page ("Resets
Friday 10:30 PM"), not something the app can enforce, so the provider's
figures stay alongside your tracker and your tracker's own reset schedule
alone owns its math. Percentages are stored verbatim with their unit - they
are never converted into your tracker's credits.

1. You link a tracker to a provider and figure in the tracker's settings
   (Automatic sync → Claude → Weekly or Session). Linking is a display
   association only. Manual trackers are never touched, and trackers are
   never matched by name.
2. When your Expiry Radar dashboard is open in a tab, a captured reading is
   handed to the page, which saves it with your existing signed-in session
   through the `record_external_usage_snapshot` database function. That
   function records the snapshot once (a stable key rejects retries and
   duplicate deliveries) and changes nothing else.
3. The popup shows what happened: "saved to dashboard" means the database
   confirmed the write; "not saved" or "waiting for dashboard tab" means it
   did not. Delivery and saving are reported separately on purpose.

## Honest freshness

- A meter reading describes the last time the Usage page was open. The popup
  shows its capture age and marks it outdated after an hour; reopen
  Settings → Usage to refresh.
- If your account has no usage meters to read, the popup says so rather
  than guessing.

## What it never does

- No passwords, cookies, session tokens or login data are read, stored or
  sent. The extension reads only numbers visible on the page, and only the
  Expiry Radar page itself writes to your account.
- Nothing is sent to any third party. Readings go from the Claude tab to
  your own Expiry Radar tab, nowhere else.
- It is not always-on tracking: meters are captured when you open the usage
  page.
- No quota inference. Ever.

## Permissions (all visible in manifest.json)

- `storage`: remembers the latest reading so it can sync and display when
  you open the popup or dashboard.
- Host access to `claude.ai`, `exptrack.site`, and the Lovable preview URL.
  Nothing else.

## Install (private testing)

1. Open `chrome://extensions` in Chrome on your laptop.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Sign in to Expiry Radar in one tab, open claude.ai → Settings → Usage in
   another, and watch the dashboard toast and tracker.

## Known limits of this build

- Sync requires the `drizzle/migrations/0007_external_usage_sync.sql`
  migration to be applied to the app's Supabase project. Until it is, the
  dashboard shows "automatic sync is in preview" and saves nothing.
- The reader is text-pattern based. Anthropic can change the page layout;
  if numbers stop appearing, the parser needs an update.
- Not yet verified against a live signed-in Claude account - first run on
  your own account is the real test.
- Chrome desktop only.
