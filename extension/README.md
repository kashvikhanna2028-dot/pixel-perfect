# Expiry Radar Companion (Chrome extension, private test build)

Reads AI plan usage that is already visible on a provider's own usage page and
syncs it into your Expiry Radar dashboard. First version covers **Claude**
(claude.ai → Settings → Usage). Ordinary ChatGPT chat usage is not included:
OpenAI does not show a comparable usage meter for it.

## What it does

1. When you open **claude.ai → Settings → Usage** in Chrome, the extension
   reads the session and weekly usage percentages and reset text shown on that
   page.
2. When your Expiry Radar dashboard (exptrack.site) is open in a tab, the
   reading is handed to the page, which saves it with your existing signed-in
   session: an increase logs the delta to the matching tracker; a decrease
   means the provider reset first, so the tracker snaps to the new value.
3. Syncing matches **one** tracker whose name contains the provider name
   (e.g. "Claude Pro"). The built-in "Claude Pro" preset works: weekly reset,
   total 100. If no tracker (or several) matches, the reading is shown as a
   toast and nothing is saved.

## What it never does

- No passwords, cookies, session tokens or login data are read, stored or
  sent. The extension reads only numbers visible on the page, and only the
  Expiry Radar page itself writes to your account.
- Nothing is sent to any third party. Readings go from the Claude tab to your
  own Expiry Radar tab, nowhere else.
- It is not always-on tracking: it captures a reading when you open the usage
  page.

## Permissions (all visible in manifest.json)

- `storage`: remembers the latest reading so it can sync when the dashboard
  opens.
- Host access to `claude.ai`, `exptrack.site`, and the Lovable preview URL.
  Nothing else.

## Install (private testing)

1. Open `chrome://extensions` in Chrome on your laptop.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Sign in to Expiry Radar in one tab; open claude.ai → Settings → Usage in
   another; watch the dashboard toast and tracker.

## Known limits of this build

- The Claude page reading is text-pattern based (it looks for "Current
  session"/"Weekly" labels and nearby percentages). Anthropic can change the
  page layout; if numbers stop appearing, the parser needs an update.
- Not yet verified against a live signed-in Claude account - first run on
  your own account is the real test.
- Chrome desktop only.
