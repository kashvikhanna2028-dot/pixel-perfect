// Expiry Radar Companion - Claude usage reader.
// Runs only on https://claude.ai/settings/usage*.
// Reads usage numbers that are already visible on the page the user opened.
// No credentials, cookies or tokens are read or sent anywhere.

(function () {
  const LABELS = {
    session: /current session/i,
    weekly: /weekly/i,
  };

  function percentNear(el) {
    // Look inside a labelled container for a percent: aria progressbar first,
    // then literal "%" text, then a bar width style.
    const bar = el.querySelector('[role="progressbar"][aria-valuenow]');
    if (bar) {
      const v = parseFloat(bar.getAttribute('aria-valuenow'));
      if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
    }
    const text = el.innerText || '';
    const m = text.match(/(\d{1,3})\s*%/);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v >= 0 && v <= 100) return v;
    }
    const fill = el.querySelector('[style*="width"]');
    if (fill) {
      const w = /width:\s*([\d.]+)%/.exec(fill.getAttribute('style') || '');
      if (w) {
        const v = parseFloat(w[1]);
        if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
      }
    }
    return null;
  }

  function resetTextNear(el) {
    const text = el.innerText || '';
    const m = text.match(/resets?[^\n]*/i);
    return m ? m[0].trim().slice(0, 120) : null;
  }

  function findSection(labelRe) {
    // Smallest element whose own text matches the label, then walk up to a
    // container that also contains a percent or progressbar.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    const candidates = [];
    while ((node = walker.nextNode())) {
      const own = (node.innerText || '').trim();
      if (own.length > 400) continue;
      if (labelRe.test(own)) candidates.push(node);
    }
    // Prefer the deepest (most specific) candidate that yields a percent.
    for (let i = candidates.length - 1; i >= 0; i--) {
      let el = candidates[i];
      for (let depth = 0; depth < 4 && el; depth++, el = el.parentElement) {
        const pct = percentNear(el);
        if (pct !== null) return { el, pct };
      }
    }
    return null;
  }

  function readUsage() {
    const session = findSection(LABELS.session);
    const weekly = findSection(LABELS.weekly);
    if (!session && !weekly) return null;
    return {
      provider: 'claude',
      pageUrl: location.href,
      sessionPercent: session ? session.pct : null,
      sessionReset: session ? resetTextNear(session.el) : null,
      weeklyPercent: weekly ? weekly.pct : null,
      weeklyReset: weekly ? resetTextNear(weekly.el) : null,
      observedAt: new Date().toISOString(),
    };
  }

  function send() {
    const reading = readUsage();
    if (!reading) return; // page not rendered yet or layout unrecognized
    chrome.runtime.sendMessage({ type: 'usage-reading', reading }, () => {
      void chrome.runtime.lastError; // ignore: background may be restarting
    });
  }

  // The settings page renders client-side; observe until we capture both
  // numbers (or a stable single one), then keep watching for changes.
  let lastSent = '';
  const attempt = () => {
    const reading = readUsage();
    if (!reading) return;
    const signature = JSON.stringify([reading.sessionPercent, reading.weeklyPercent, reading.sessionReset, reading.weeklyReset]);
    if (signature !== lastSent) {
      lastSent = signature;
      send();
    }
  };
  const observer = new MutationObserver(() => attempt());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  attempt();
  window.setTimeout(attempt, 2000);
  window.setTimeout(attempt, 5000);
})();
