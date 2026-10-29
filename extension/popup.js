chrome.runtime.sendMessage({ type: 'get-status' }, (status) => {
  const el = document.getElementById('status');
  if (chrome.runtime.lastError || !status) {
    el.innerHTML = '<span class="none">No reading yet.</span>';
    return;
  }
  const r = status.lastReading;
  if (!r) {
    el.innerHTML = '<span class="none">No reading yet.</span>';
    return;
  }
  const when = new Date(r.observedAt).toLocaleString();
  el.innerHTML = `
    <div class="row"><span>Provider</span><strong>${r.provider}</strong></div>
    <div class="row"><span>Session (5h)</span><strong>${r.sessionPercent ?? '—'}%</strong></div>
    <div class="row"><span>Weekly</span><strong>${r.weeklyPercent ?? '—'}%</strong></div>
    <div class="row"><span>Read at</span><strong>${when}</strong></div>
    <div class="row"><span>Sync</span><strong>${status.pending ? 'waiting for dashboard tab' : status.lastDelivered > 0 ? 'delivered' : 'not yet'}</strong></div>
  `;
});
