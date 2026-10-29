// Expiry Radar Companion - Claude limit-notice reader (free-plan mode).
// Runs only on Claude chat pages (https://claude.ai/chat/*, /new*).
//
// Official grounding (support.claude.com/en/articles/8114491): the free plan
// has a session-based limit that resets every five hours, the number of
// messages VARIES WITH DEMAND, and "Claude will notify you when you've
// reached your limit." So on Free there is no usage meter and no countable
// remaining quota. This script captures ONLY the limit notice Claude itself
// displays, plus any reset time stated in it. It never infers a quota and
// never counts messages.
//
// UNVERIFIED against the real free-plan notice UI: the exact wording and DOM
// are not documented. Matching is deliberately strict so ordinary chat text
// cannot trigger it:
//   - text inside chat message bubbles is NEVER treated as a notice;
//   - matches inside alert/banner-style UI (role=alert/status, aria-live,
//     alert/banner/notice/toast/warning classes) are captured as
//     confidence "ui-banner";
//   - any other match is captured only as "unverified-candidate" and the
//     popup labels it as unconfirmed.
// First real capture on the user's account is the validation event.
//
// No credentials, cookies or tokens are read or sent anywhere.

(function () {
  // Strict: requires "reached ... limit" phrasing as Claude would state it.
  // Questions ("what is the usage limit?") and first-person chatter
  // ("I reached my limit lol") must not match.
  const NOTICE_RE = /you(?:'ve| have) reached your (?:current )?(?:usage |message )?limit|usage limit reached|reached the (?:usage |message )?limit/i;
  const RESET_RE = /(?:resets?|reset)\s+(?:at|in|on)\s+[^.\n]{1,60}|(?:try again|available again|come back)\s+(?:at|in)\s+[^.\n]{1,60}/i;

  // Alert/banner-style UI semantics: a real system notice lives here.
  // Chat message bubbles: their text is conversation, never a system notice.
  // Checked via attributes/class keywords (lowercased) rather than selector
  // case flags so behavior is identical in every DOM implementation.
  const ALERT_CLASS_WORDS = ['alert', 'banner', 'notice', 'toast', 'warning'];
  const MESSAGE_CLASS_WORDS = ['message'];

  function classText(el) {
    return String(el.getAttribute('class') || '').toLowerCase();
  }
  function isAlertLike(el) {
    const role = String(el.getAttribute('role') || '').toLowerCase();
    if (role === 'alert' || role === 'status') return true;
    if (el.hasAttribute('aria-live')) return true;
    const cls = classText(el);
    return ALERT_CLASS_WORDS.some((w) => cls.includes(w));
  }
  function isMessageLike(el) {
    const testid = String(el.getAttribute('data-testid') || '').toLowerCase();
    if (testid.includes('message')) return true;
    const cls = classText(el);
    return MESSAGE_CLASS_WORDS.some((w) => cls.includes(w));
  }
  function within(el, predicate, maxDepth) {
    for (let d = 0, cur = el; cur && d <= maxDepth; d++, cur = cur.parentElement) {
      if (cur.nodeType === 1 && predicate(cur)) return true;
    }
    return false;
  }

  // Text of el with chat-message subtrees removed: a container whose trigger
  // phrase comes only from message bubbles inside it is not a notice.
  function textExcludingMessages(el) {
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!within(n.parentElement, isMessageLike, 6)) parts.push(n.nodeValue);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function findNotice() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    const candidates = [];
    while ((node = walker.nextNode())) {
      if (within(node, isMessageLike, 6)) continue; // chat text is never a system notice
      const full = (node.innerText || '').trim();
      if (full.length === 0 || full.length > 300) continue; // short standalone containers only
      if (!NOTICE_RE.test(full)) continue;
      const own = textExcludingMessages(node);
      if (!NOTICE_RE.test(own)) continue; // phrase only exists inside message bubbles
      candidates.push({ node, own });
    }
    // Prefer the deepest (most specific) match.
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i].node;
      const ownText = candidates[i].own;
      const confidence = within(el, isAlertLike, 4) ? 'ui-banner' : 'unverified-candidate';
      // noticeText always comes from the matching element itself. Walk up at
      // most 2 levels ONLY to look for an accompanying reset line, so
      // unrelated chat text never becomes part of the captured notice.
      let scope = ownText;
      let up = el;
      for (let depth = 0; depth < 2 && up && !RESET_RE.test(scope); depth++) {
        up = up.parentElement;
        const t = (up && up.innerText || '').trim();
        if (t.length > 0 && t.length <= 300) scope = t;
      }
      const reset = RESET_RE.exec(scope);
      return {
        noticeText: ownText.slice(0, 300),
        resetText: reset ? reset[0].trim().slice(0, 120) : null,
        confidence,
      };
    }
    return null;
  }

  function readNotice() {
    const found = findNotice();
    if (!found) return null;
    return {
      provider: 'claude',
      kind: 'limit-notice',
      id: crypto.randomUUID(),
      pageUrl: location.href,
      noticeText: found.noticeText,
      resetText: found.resetText,
      confidence: found.confidence,
      observedAt: new Date().toISOString(),
    };
  }

  let lastSent = '';
  const attempt = () => {
    const notice = readNotice();
    if (!notice) return;
    const signature = JSON.stringify([notice.noticeText, notice.resetText, notice.confidence]);
    if (signature === lastSent) return;
    lastSent = signature;
    chrome.runtime.sendMessage({ type: 'limit-notice', notice }, () => {
      void chrome.runtime.lastError; // ignore: background may be restarting
    });
  };
  const observer = new MutationObserver(() => attempt());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  attempt();
  window.setTimeout(attempt, 2000);
  window.setTimeout(attempt, 5000);
})();
