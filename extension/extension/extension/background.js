// Expiry Radar Companion - background service worker.
// Receives readings from the Claude usage page, stores the latest one, and
// relays it to ONE Expiry Radar tab (the most recently active one), so a
// reading can never be applied twice by several open dashboard tabs.
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
    await chrome.tabs.sendMessage(tabId, { type: 'usage-reading', reading });
    return true;
  } catch {
    return false; // tab navigated away or bridge not injected yet
  }
}

async function relayToApp(reading) {
  const tab = await appTab();
  const delivered = tab ? await deliver(tab.id, reading) : false;
  if (delivered) {
    await chrome.storage.local.remove('pendingReading');
  } else {
    await chrome.storage.local.set({ pendingReading: reading });
  }
  await chrome.storage.local.set({ lastReading: reading, lastDelivered: delivered ? 1 : 0 });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'usage-reading') {
    relayToApp(message.reading).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (message?.type === 'app-ready') {
    chrome.storage.local.get('pendingReading', async (items) => {
      if (items.pendingReading && sender.tab?.id) {
        // Flush only to the tab that announced itself, and only if it is the
        // current single app tab target.
        const tab = await appTab();
        if (tab && tab.id === sender.tab.id && await deliver(tab.id, items.pendingReading)) {
          await chrome.storage.local.remove('pendingReading');
        }
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message?.type === 'get-status') {
    chrome.storage.local.get(['lastReading', 'lastDelivered', 'pendingReading'], (items) => {
      sendResponse({
        lastReading: items.lastReading ?? null,
        lastDelivered: items.lastDelivered ?? 0,
        pending: Boolean(items.pendingReading),
      });
    });
    return true;
  }
  return false;
});
