// popup.js — PGSC Share Helper Extension Sidepanel Logic

let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
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
      if (statusDot) statusDot.className = 'status-dot active';
      if (statusText) statusText.textContent = 'กำลังแชร์อยู่...';
      showSession(currentIndex, groups.length, results, status);
    } else if (status === 'completed') {
      if (statusDot) statusDot.className = 'status-dot idle';
      if (statusText) statusText.textContent = 'Session เสร็จสิ้น ✅';
      showSession(groups.length, groups.length, results, 'completed');
    } else if (status === 'cancelled') {
      showIdle('Session ถูกยกเลิก');
    } else {
      showIdle('ไม่มี Session ที่กำลังทำงาน');
    }
  }

  function showIdle(text) {
    if (statusDot) statusDot.className = 'status-dot idle';
    if (statusText) statusText.textContent = text;
    if (sessionSection) sessionSection.classList.add('hidden');
    if (noSessionSection) noSessionSection.classList.remove('hidden');
  }

  function showSession(current, total, results, status) {
    if (sessionSection) sessionSection.classList.remove('hidden');
    if (noSessionSection) noSessionSection.classList.add('hidden');

    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = `${current} / ${total}`;

    const posted  = results.filter(r => r.status === 'posted').length;
    const pending = results.filter(r => r.status === 'pending_admin').length;
    const failed  = results.filter(r => r.status === 'failed').length;

    const statusEmoji = status === 'completed' ? '🎉 เสร็จสิ้น!' : '⏳ กำลังทำงาน...';
    if (sessionStatus) sessionStatus.textContent = `${statusEmoji} | ✅${posted} ⏳${pending} ❌${failed}`;
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', async () => {
      btnCancel.disabled = true;
      try {
        await chrome.runtime.sendMessage({ type: 'PGSC_CANCEL_SESSION' });
        await loadState();
      } catch (err) {
        console.error('Failed to cancel session:', err);
      } finally {
        btnCancel.disabled = false;
      }
    });
  }

  function startPolling() {
    if (refreshInterval) clearInterval(refreshInterval);
    loadState();
    refreshInterval = setInterval(loadState, 1500);
  }

  // Handle visibility changes to start/stop polling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    } else {
      startPolling();
    }
  });

  // Start initial polling
  startPolling();
});
