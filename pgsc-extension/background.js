// =====================================================================
// background.js — PGSC Share Helper Service Worker
// Handles: tab management, session state, message routing
// =====================================================================

const PGSC_VERSION = '1.0.0';
const ALLOWED_ORIGINS = [
  'https://pepsproduction.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

// Configure Chrome Extension Side Panel click behavior
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error('[PGSC BG] Failed to set sidepanel behavior:', err);
  });
}

// ---------------------
// External messages from web app (via externally_connectable)
// ---------------------
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!ALLOWED_ORIGINS.some(o => sender.origin?.startsWith(o))) {
    sendResponse({ ok: false, error: 'Unauthorized origin: ' + sender.origin });
    return;
  }

  if (message.type === 'PGSC_CHECK_INSTALLED') {
    sendResponse({ ok: true, version: PGSC_VERSION });
    return;
  }

  if (message.type === 'PGSC_START_SESSION') {
    handleStartSession(message).then(sendResponse).catch(err =>
      sendResponse({ ok: false, error: err.message })
    );
    return true; // async
  }

  if (message.type === 'PGSC_CANCEL_SESSION') {
    cancelSession().then(sendResponse).catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'PGSC_GET_SESSION') {
    chrome.storage.local.get('pgsc_session').then(({ pgsc_session }) =>
      sendResponse({ ok: true, session: pgsc_session || null })
    );
    return true;
  }
});

// ---------------------
// Messages from content scripts
// ---------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PGSC_CHECK_INSTALLED') {
    sendResponse({ ok: true, version: PGSC_VERSION });
    return;
  }

  if (message.type === 'PGSC_START_SESSION') {
    handleStartSession(message).then(sendResponse).catch(err =>
      sendResponse({ ok: false, error: err.message })
    );
    return true; // async
  }

  if (message.type === 'PGSC_CANCEL_SESSION') {
    cancelSession().then(sendResponse).catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'PGSC_GET_SESSION') {
    chrome.storage.local.get('pgsc_session').then(({ pgsc_session }) =>
      sendResponse({ ok: true, session: pgsc_session || null })
    );
    return true;
  }

  if (message.type === 'PGSC_FB_READY') {
    // Facebook content script is ready on the post page
    handleFbReady(sender.tab, sendResponse);
    return true;
  }

  if (message.type === 'PGSC_RESULT') {
    // A share attempt completed
    handleResult(message.result, sender.tab).then(sendResponse);
    return true;
  }

  if (message.type === 'PGSC_SESSION_DONE') {
    // All groups processed
    handleSessionDone(message.results);
    sendResponse({ ok: true });
  }

  if (message.type === 'PGSC_LOG') {
    writeLog(message.text);
    sendResponse({ ok: true });
  }

  if (message.type === 'PGSC_NAVIGATE_POST') {
    chrome.storage.local.get('pgsc_session').then(({ pgsc_session }) => {
      if (pgsc_session && pgsc_session.status === 'running') {
        chrome.tabs.update(sender.tab.id, { url: pgsc_session.postUrl });
      }
    });
    sendResponse({ ok: true });
    return;
  }
});

// ---------------------
// Session Management
// ---------------------
async function handleStartSession(message) {
  const { postUrl, groups, caption, sessionId } = message;

  const session = {
    sessionId,
    postUrl,
    groups,        // Array of { id, name, url }
    caption,
    currentIndex: 0,
    results: [],
    status: 'starting',
    startedAt: Date.now(),
  };

  // Clear logs and initialize
  const initMsg = `เริ่ม Session อัตโนมัติไปยัง ${groups.length} กลุ่ม`;
  await chrome.storage.local.set({
    pgsc_session: session,
    pgsc_logs: [`[${new Date().toLocaleTimeString()}] ${initMsg}`]
  });

  // Open or reuse a Facebook tab
  const [fbTab] = await chrome.tabs.query({ url: 'https://www.facebook.com/*', currentWindow: true });

  let targetTab;
  if (fbTab) {
    await writeLog('ตรวจพบแท็บ Facebook เดิม ทำการรีโหลดเปิดหน้าโพสต์เป้าหมาย');
    await chrome.tabs.update(fbTab.id, { url: postUrl, active: true });
    targetTab = fbTab;
  } else {
    await writeLog('สร้างแท็บ Facebook ใหม่เพื่อเริ่มแชร์');
    targetTab = await chrome.tabs.create({ url: postUrl, active: true });
  }

  await chrome.storage.local.set({
    pgsc_session: { ...session, status: 'running' },
    pgsc_fb_tab_id: targetTab.id,
  });

  await writeLog(`Session เริ่มทำงาน: กำลังแชร์ไปยังกลุ่มที่ 1: ${groups[0].name}`);
  return { ok: true, sessionId, tabId: targetTab.id };
}

async function cancelSession() {
  const { pgsc_session } = await chrome.storage.local.get('pgsc_session');
  if (pgsc_session) {
    await chrome.storage.local.set({
      pgsc_session: { ...pgsc_session, status: 'cancelled' },
    });
  }
  await writeLog('❌ ยกเลิก Session โดยผู้ใช้');
  // Notify web app
  await pushToWebApp({ type: 'PGSC_SESSION_CANCELLED' });
  return { ok: true };
}

async function handleFbReady(tab, sendResponse) {
  const { pgsc_session } = await chrome.storage.local.get('pgsc_session');

  if (!pgsc_session || pgsc_session.status !== 'running') {
    sendResponse({ ok: false, reason: 'No active session' });
    return;
  }

  const { groups, caption, currentIndex } = pgsc_session;

  if (currentIndex >= groups.length) {
    sendResponse({ ok: false, reason: 'All groups done' });
    return;
  }

  const group = groups[currentIndex];

  // Push progress to web app
  await pushToWebApp({
    type: 'PGSC_PROGRESS',
    data: {
      currentIndex,
      total: groups.length,
      group: group.name,
      status: 'processing',
    },
  });

  sendResponse({
    ok: true,
    group,
    caption,
    index: currentIndex,
    total: groups.length,
  });
}

async function handleResult(result, tab) {
  const { pgsc_session } = await chrome.storage.local.get('pgsc_session');
  if (!pgsc_session) return { ok: false };

  pgsc_session.results.push(result);
  pgsc_session.currentIndex += 1;

  const isDone = pgsc_session.currentIndex >= pgsc_session.groups.length;
  pgsc_session.status = isDone ? 'completed' : 'running';

  await chrome.storage.local.set({ pgsc_session });

  const statusEmoji = result.status === 'posted' ? '✅ สำเร็จ' 
                     : result.status === 'pending_admin' ? '⏳ รอแอดมินอนุมัติ' 
                     : `❌ ล้มเหลว (${result.reason || 'ไม่ทราบสาเหตุ'})`;
  await writeLog(`[กลุ่มที่ ${pgsc_session.currentIndex}/${pgsc_session.groups.length}] ${result.group} -> ${statusEmoji}`);

  // Push real-time result to web app
  await pushToWebApp({ type: 'PGSC_RESULT', data: result });

  if (isDone) {
    await writeLog('🎉 สำเร็จครบทุกกลุ่มแล้ว!');
    await pushToWebApp({
      type: 'PGSC_SESSION_DONE',
      data: {
        results: pgsc_session.results,
        sessionId: pgsc_session.sessionId,
      },
    });
  } else {
    const nextGroup = pgsc_session.groups[pgsc_session.currentIndex];
    await writeLog(`เตรียมเปิดกลุ่มถัดไป: ${nextGroup.name}`);
  }

  return { ok: true, isDone };
}

async function handleSessionDone(results) {
  const { pgsc_session } = await chrome.storage.local.get('pgsc_session');
  if (pgsc_session) {
    await chrome.storage.local.set({
      pgsc_session: { ...pgsc_session, status: 'completed', results },
    });
  }
  await writeLog('🎉 สรุปผลลัพธ์ได้รับการบันทึกแล้ว');
  await pushToWebApp({ type: 'PGSC_SESSION_DONE', data: { results } });
}

// ---------------------
// Push message to web app via pgsc_bridge.js content script
// ---------------------
async function pushToWebApp(message) {
  try {
    const tabs = await chrome.tabs.query({ url: ALLOWED_ORIGINS.flatMap(o => [o + '/*']) });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch {
        // Tab may not have bridge script loaded yet, ignore
      }
    }
  } catch (err) {
    console.warn('[PGSC BG] pushToWebApp error:', err.message);
  }
}

async function writeLog(msg) {
  console.log('[PGSC BG]', msg);
  try {
    const { pgsc_logs = [] } = await chrome.storage.local.get('pgsc_logs');
    pgsc_logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (pgsc_logs.length > 50) pgsc_logs.shift(); // keep last 50 logs
    await chrome.storage.local.set({ pgsc_logs });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}
