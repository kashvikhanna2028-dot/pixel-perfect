// Expiry Radar Companion - background service worker.
// Receives readings from the Claude usage page, stores the latest one, and
// relays it to ONE Expiry Radar tab (the most recently active one), so a
// reading can never be applied twice by several open dashboard tabs. The
// dashboard's result ("saved" / "no change" / error) is stored separately
// from delivery, so the popup can tell a real save from a dropped message.
// Nothing leaves the browser except the reading going to the user's own
// Expiry Radar tab.

const APP_URL_PATTERNS = [
  'https://exptrack.site/dashboard*',
  'https://life-expiry-guide.lovable.app/dashboard*',
];

async function appTab() {
  const tabs = await chrome.tabs.query({ url: APP_URL_PATTERNS });
  if (!tabs.length) return null;
  // Prefer an active tab, then the most recently accessed one.
  tabs.sort((a, b) => (b.active - a.active) || ((b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)));
  return tabs[0];
}

async function deliver(tabId, reading) {
  try {
    // Resolves with the dashboard's result, or null if the tab is gone or
    // the bridge is not injected there yet.
    return (await chrome.tabs.sendMessage(tabId, { type: 'usage-reading', reading })) ?? null;
  } catch {
    return null;
  }
}

async function recordResult(reading, result) {
  if (result) {
    await chrome.storage.local.remove('pendingReading');
  } else {
    await chrome.storage.local.set({ pendingReading: reading });
  }
  await chrome.storage.local.set({
    lastReading: reading,
    lastResult: result
      ? { ok: Boolean(result.ok), detail: String(result.detail ?? ''), at: Date.now() }
      : null,
  });
}

async function relayToApp(reading) {
  const tab = await appTab();
  await recordResult(reading, tab ? await deliver(tab.id, reading) : null);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'usage-reading') {
    relayToApp(message.reading).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (message?.type === 'app-ready') {
    chrome.storage.local.get(['pendingReading', 'lastReading'], async (items) => {
      if (items.pendingReading && sender.tab?.id) {
        // Flush only to the tab that announced itself, and only if it is the
        // current single app tab target.
        const tab = await appTab();
        if (tab && tab.id === sender.tab.id) {
          await recordResult(items.pendingReading, await deliver(tab.id, items.pendingReading));
        }
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message?.type === 'get-status') {
    chrome.storage.local.get(['lastReading', 'lastResult', 'pendingReading'], (items) => {
      sendResponse({
        lastReading: items.lastReading ?? null,
        lastResult: items.lastResult ?? null,
        pending: Boolean(items.pendingReading),
      });
    });
    return true;
  }
  return false;
});
