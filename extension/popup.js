// Renders the last meter reading (with what the dashboard did with it) and
// the last free-plan limit notice. Values are inserted via textContent,
// never HTML.
//
// Honest freshness: a meter reading describes the last time the Usage page
// was open and is labelled outdated after an hour; a limit notice belongs to
// a session limit that resets every five hours and is labelled expired after
// that (or once its stated reset time has passed). Captures are never shown
// as current status indefinitely.

const METER_STALE_MS = 60 * 60 * 1000;
const NOTICE_TTL_MS = 5 * 60 * 60 * 1000; // free session limits reset every 5 hours (Anthropic)

function ageText(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

function resetTimePassed(resetText, observedAt) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(resetText || '');
  if (!m) return false;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  const t = new Date(observedAt);
  t.setHours(h, parseInt(m[2] || '0', 10), 0, 0);
  if (t < new Date(observedAt)) t.setDate(t.getDate() + 1); // next occurrence
  return Date.now() > t.getTime();
}

function meterStale(reading) {
  return Date.now() - new Date(reading.observedAt).getTime() > METER_STALE_MS;
}

function noticeExpired(notice) {
  if (Date.now() - new Date(notice.observedAt).getTime() > NOTICE_TTL_MS) return true;
  return resetTimePassed(notice.resetText, notice.observedAt);
}

function row(label, value) {
  const div = document.createElement('div');
  div.className = 'row';
  const l = document.createElement('span');
  l.textContent = label;
  const v = document.createElement('strong');
  v.textContent = value;
  div.append(l, v);
  return div;
}

function heading(text) {
  const h = document.createElement('h2');
  h.textContent = text;
  return h;
}

function muted(text) {
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = text;
  return p;
}

chrome.runtime.sendMessage({ type: 'get-status' }, (status) => {
  const el = document.getElementById('status');
  el.textContent = '';
  const reading = status && status.lastReading;
  const notice = status && status.lastLimitNotice;

  if (chrome.runtime.lastError || (!reading && !notice)) {
    const none = document.createElement('span');
    none.className = 'none';
    none.textContent = 'No usage data captured yet. This extension shows meters only when your Claude account displays them; it never invents a figure.';
    el.append(none);
    return;
  }

  if (reading) {
    const stale = meterStale(reading);
    el.append(
      heading(stale ? 'Usage meters (outdated)' : 'Usage meters'),
      row('Provider', String(reading.provider)),
      row('Session (5h)', reading.sessionPercent != null ? `${reading.sessionPercent}%` : '—'),
      row('Weekly', reading.weeklyPercent != null ? `${reading.weeklyPercent}%` : '—'),
      row('Captured', ageText(reading.observedAt)),
    );
    let syncText;
    if (status.pending) {
      syncText = 'waiting for dashboard tab';
    } else if (!status.lastResult) {
      syncText = 'not delivered yet';
    } else if (status.lastResult.ok) {
      syncText = status.lastResult.detail === 'saved' ? 'saved to dashboard' : status.lastResult.detail;
    } else {
      syncText = `not saved: ${status.lastResult.detail}`;
    }
    el.append(row('Sync', syncText));
    if (stale) el.append(muted('From the last time the Usage page was open. Reopen Settings > Usage to refresh.'));
  }

  if (notice) {
    const expired = noticeExpired(notice);
    const base = notice.confidence === 'ui-banner' ? 'Limit notice' : 'Possible limit notice (unconfirmed)';
    el.append(
      heading(expired ? `${base} - expired` : base),
      row('Notice', notice.noticeText || 'captured'),
      row('Reset', notice.resetText || 'not stated'),
      row('Captured', ageText(notice.observedAt)),
    );
    if (expired) el.append(muted('Expired: Claude session limits reset every 5 hours, and this one has passed. Current allowance is unknown.'));
    el.append(muted('Free-plan limits vary with demand, so there is no remaining-usage percentage to show.'));
  }
});
