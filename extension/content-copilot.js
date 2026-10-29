// Expiry Radar Companion - GitHub Copilot included-usage reader.
//
// Grounded in the real settings page (github.com/settings/copilot/features,
// verified live 2026-10-29): a "Usage" section contains an "Included usage"
// block with a muted span like "172 / 200 AI credits", a reset line like
// "Resets in 3 days on Nov 1, 2026", and a progress bar. A separate
// "Additional usage" block tracks pay-as-you-go spend - that is NOT plan
// usage and is never captured here.
//
// Semantics (official: docs.github.com/en/copilot/how-tos/manage-and-track-spending/monitor-ai-usage):
// the figures are credits CONSUMED out of the plan's included monthly
// credits. We forward them verbatim (used/total + unit); never a percentage
// we computed ourselves beyond what the page shows.
(() => {
  const PROVIDER = 'github-copilot';

  function send(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => void chrome.runtime.lastError);
    } catch {
      /* extension context gone */
    }
  }

  function read() {
    const text = document.body ? document.body.innerText : '';
    if (!/Included usage/i.test(text)) return null;

    // Locate the "N / M AI credits" span inside the Included usage block.
    const spans = Array.from(document.querySelectorAll('span'));
    const amountSpan = spans.find((s) => /^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s+AI credits\s*$/i.test(s.textContent || ''));
    if (!amountSpan) return null;
    const m = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s+AI credits/i.exec(amountSpan.textContent || '');
    if (!m) return null;

    // The reset line sits in the same block ("Resets in 3 days on Nov 1, 2026").
    let block = amountSpan;
    for (let i = 0; i < 8 && block.parentElement; i++) {
      block = block.parentElement;
      if (/Included usage/i.test(block.innerText || '') && /Resets/i.test(block.innerText || '')) break;
    }
    const rm = /Resets[^.\n]*(?:on\s+([A-Z][a-z]{2} \d{1,2}, \d{4}))?/i.exec((block.innerText || '').split('\n').find((l) => /Resets/i.test(l)) || '');

    return {
      provider: PROVIDER,
      metric: 'included_credits',
      used: parseFloat(m[1]),
      total: parseFloat(m[2]),
      unit: 'AI credits',
      resetText: rm ? rm[0].trim() : null,
    };
  }

  const figure = read();
  if (figure) {
    send({
      type: 'usage-reading',
      reading: {
        provider: PROVIDER,
        id: crypto.randomUUID(),
        pageUrl: location.href,
        observedAt: new Date().toISOString(),
        figures: [figure],
      },
    });
  }
})();
