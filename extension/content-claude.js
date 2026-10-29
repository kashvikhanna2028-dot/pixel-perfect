// Expiry Radar Companion - Claude usage reader.
// Runs only on https://claude.ai/settings/usage*.
// Reads usage numbers that are already visible on the page the user opened.
// No credentials, cookies or tokens are read or sent anywhere.

(function () {
  // Verified against the real Settings > Usage layout (Oct 2026): the
  // session row is labelled "Current session", the weekly row "This week".
  // "weekly" stays as a fallback for older/other layouts.
  const LABELS = {
    session: /current session/i,
    weekly: /this week|weekly/i,
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
    // Standalone short labels ("This week", "Current session") are
    // authoritative; prose that merely mentions the words (the "Fresh week.
    // 9% of your weekly limit used." banner, "Cloud session credits") is a
    // fallback only. Walk up from the label to a container with a percent.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    const shortCandidates = [];
    const looseCandidates = [];
    while ((node = walker.nextNode())) {
      const own = (node.innerText || '').trim();
      if (own.length > 400) continue;
      if (!labelRe.test(own)) continue;
      (own.length <= 30 ? shortCandidates : looseCandidates).push(node);
    }
    for (const candidates of [shortCandidates, looseCandidates]) {
      // Prefer the deepest (most specific) candidate that yields a percent.
      for (let i = candidates.length - 1; i >= 0; i--) {
        let el = candidates[i];
        for (let depth = 0; depth < 4 && el; depth++, el = el.parentElement) {
          const pct = percentNear(el);
          if (pct !== null) return { el, pct };
        }
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
      id: crypto.randomUUID(),
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
