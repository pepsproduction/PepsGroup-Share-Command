// popup.js — PGSC Share Helper Extension Sidepanel Logic

const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const sessionSection   = document.getElementById('session-section');
const noSessionSection = document.getElementById('no-session-section');
const progressFill  = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const sessionStatus = document.getElementById('session-status');
const btnCancel     = document.getElementById('btn-cancel');
const logsBox       = document.getElementById('logs-box');

async function loadState() {
  const { pgsc_session, pgsc_logs = [] } = await chrome.storage.local.get(['pgsc_session', 'pgsc_logs']);

  // Render logs
  if (logsBox) {
    logsBox.innerHTML = '';
    pgsc_logs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'log-item';
      if (log.includes('ล้มเหลว') || log.includes('❌') || log.includes('Error') || log.includes('failed')) {
        item.className = 'log-item error';
      } else if (log.includes('เริ่ม') || log.includes('สำเร็จ') || log.includes('✅') || log.includes('Done')) {
        item.className = 'log-item info';
      }
      item.textContent = log;
      logsBox.appendChild(item);
    });
    // Auto scroll to bottom
    logsBox.scrollTop = logsBox.scrollHeight;
  }

  if (!pgsc_session) {
    showIdle('ไม่มี Session ที่กำลังทำงาน');
    return;
  }

  const { status, groups = [], currentIndex = 0, results = [] } = pgsc_session;

  if (status === 'running' || status === 'starting') {
    statusDot.className = 'status-dot active';
    statusText.textContent = 'กำลังแชร์อยู่...';
    showSession(currentIndex, groups.length, results, status);
  } else if (status === 'completed') {
    statusDot.className = 'status-dot idle';
    statusText.textContent = 'Session เสร็จสิ้น ✅';
    showSession(groups.length, groups.length, results, 'completed');
  } else if (status === 'cancelled') {
    showIdle('Session ถูกยกเลิก');
  } else {
    showIdle('ไม่มี Session ที่กำลังทำงาน');
  }
}

function showIdle(text) {
  statusDot.className = 'status-dot idle';
  statusText.textContent = text;
  sessionSection.classList.add('hidden');
  noSessionSection.classList.remove('hidden');
}

function showSession(current, total, results, status) {
  sessionSection.classList.remove('hidden');
  noSessionSection.classList.add('hidden');

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `${current} / ${total}`;

  const posted  = results.filter(r => r.status === 'posted').length;
  const pending = results.filter(r => r.status === 'pending_admin').length;
  const failed  = results.filter(r => r.status === 'failed').length;

  const statusEmoji = status === 'completed' ? '🎉 เสร็จสิ้น!' : '⏳ กำลังทำงาน...';
  sessionStatus.textContent = `${statusEmoji} | ✅${posted} ⏳${pending} ❌${failed}`;
}

btnCancel.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'PGSC_CANCEL_SESSION' });
  await loadState();
});

// Refresh every 1.5 seconds while panel is open
loadState();
setInterval(loadState, 1500);
