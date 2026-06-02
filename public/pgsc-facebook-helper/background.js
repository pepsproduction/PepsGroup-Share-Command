const SOURCE = 'PGSC_SHARE_COMMAND';
const OPEN_GROUP_TYPE = 'OPEN_GROUP_TAB';
const TRACK_GROUP_TYPE = 'TRACK_GROUP_TAB';
const SHARE_TAB_ID_KEY = 'pgscShareTabId';

function getGroupId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/groups\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : '';
  } catch {
    const match = String(url).match(/\/groups\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : '';
  }
}

function isGroupTabMessage(message) {
  return Boolean(
    message &&
      message.source === SOURCE &&
      (message.type === OPEN_GROUP_TYPE || message.type === TRACK_GROUP_TYPE) &&
      typeof message.groupUrl === 'string' &&
      /^https:\/\/(?:www|web)\.facebook\.com\/groups\//i.test(message.groupUrl)
  );
}

async function focusTab(tab) {
  if (!tab?.id) return tab;
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId) {
    try {
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
      // Some browsers do not expose windows focus without extra permission.
    }
  }
  return tab;
}

async function findOpenGroupTab(groupUrl) {
  const targetGroupId = getGroupId(groupUrl);
  if (!targetGroupId) return null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tabs = await chrome.tabs.query({
      url: ['https://www.facebook.com/groups/*', 'https://web.facebook.com/groups/*'],
    });
    const match = tabs.find((tab) => tab.id && tab.url && getGroupId(tab.url) === targetGroupId);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

async function trackExistingShareTab(groupUrl) {
  const tab = await findOpenGroupTab(groupUrl);
  if (tab?.id) {
    await chrome.storage.local.set({ [SHARE_TAB_ID_KEY]: tab.id });
  }
  return tab;
}

async function openOrReuseShareTab(groupUrl) {
  const stored = await chrome.storage.local.get(SHARE_TAB_ID_KEY);
  const savedTabId = stored[SHARE_TAB_ID_KEY];

  if (typeof savedTabId === 'number') {
    try {
      const existingTab = await chrome.tabs.get(savedTabId);
      if (existingTab?.id) {
        await chrome.tabs.update(existingTab.id, { url: groupUrl, active: true });
        return focusTab(existingTab);
      }
    } catch {
      await chrome.storage.local.remove(SHARE_TAB_ID_KEY);
    }
  }

  const tab = await chrome.tabs.create({ url: groupUrl, active: true });
  if (tab.id) {
    await chrome.storage.local.set({ [SHARE_TAB_ID_KEY]: tab.id });
  }
  return focusTab(tab);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isGroupTabMessage(message)) return false;

  const action = message.type === OPEN_GROUP_TYPE ? openOrReuseShareTab : trackExistingShareTab;
  action(message.groupUrl)
    .then((tab) => {
      sendResponse({ ok: true, tabId: tab?.id });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) });
    });

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(SHARE_TAB_ID_KEY, (stored) => {
    if (stored[SHARE_TAB_ID_KEY] === tabId) {
      chrome.storage.local.remove(SHARE_TAB_ID_KEY);
    }
  });
});
