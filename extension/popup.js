// Renders the last reading and, separately, what the dashboard did with it.
// Values are inserted via textContent, never HTML.

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

chrome.runtime.sendMessage({ type: 'get-status' }, (status) => {
  const el = document.getElementById('status');
  el.textContent = '';
  if (chrome.runtime.lastError || !status || !status.lastReading) {
    const none = document.createElement('span');
    none.className = 'none';
    none.textContent = 'No reading yet.';
    el.append(none);
    return;
  }
  const r = status.lastReading;
  el.append(
    row('Provider', String(r.provider)),
    row('Session (5h)', r.sessionPercent != null ? `${r.sessionPercent}%` : '—'),
    row('Weekly', r.weeklyPercent != null ? `${r.weeklyPercent}%` : '—'),
    row('Read at', new Date(r.observedAt).toLocaleString()),
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
});
