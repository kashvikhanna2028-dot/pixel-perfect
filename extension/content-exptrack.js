// Expiry Radar Companion - bridge into the Expiry Radar page.
// Runs only on the user's own Expiry Radar site. Forwards readings to the
// page via window.postMessage and relays the page's result back to the
// background worker, so the popup can distinguish "delivered to a tab" from
// "actually saved in the dashboard". This script never touches auth.

(function () {
  const pending = new Map();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.source === 'expiry-radar-app' && data?.type === 'usage-result') {
      const key = data.id ?? '__latest';
      const resolve = pending.get(key);
      if (resolve) {
        pending.delete(key);
        resolve({ ok: Boolean(data.ok), detail: typeof data.detail === 'string' ? data.detail : '' });
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'usage-reading' && message.reading) {
      const key = message.reading.id ?? '__latest';
      const result = new Promise((resolve) => {
        pending.set(key, resolve);
        window.setTimeout(() => {
          if (pending.delete(key)) {
            resolve({ ok: false, detail: 'the dashboard did not confirm the reading' });
          }
        }, 15000);
      });
      window.postMessage(
        { source: 'expiry-radar-extension', type: 'usage-reading', reading: message.reading },
        window.location.origin,
      );
      result.then(sendResponse);
      return true; // async response
    }
    return false;
  });

  chrome.runtime.sendMessage({ type: 'app-ready' }, () => {
    void chrome.runtime.lastError;
  });
})();
