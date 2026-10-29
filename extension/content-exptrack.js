// Expiry Radar Companion - bridge into the Expiry Radar page.
// Runs only on the user's own Expiry Radar site. Forwards readings to the
// page via window.postMessage; the app itself decides what to save, using
// the user's existing signed-in session. This script never touches auth.

(function () {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'usage-reading' && message.reading) {
      window.postMessage(
        { source: 'expiry-radar-extension', type: 'usage-reading', reading: message.reading },
        window.location.origin,
      );
    }
    return false;
  });
  chrome.runtime.sendMessage({ type: 'app-ready' }, () => {
    void chrome.runtime.lastError;
  });
})();
