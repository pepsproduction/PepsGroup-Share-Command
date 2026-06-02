// =====================================================================
// pgsc_bridge.js — PGSC Share Helper (Web App Bridge Content Script)
// Runs on: pepsproduction.github.io/* and localhost:*/*
// Purpose: Bridges messages between the web app page and the extension background
// =====================================================================

(function () {
  'use strict';

  // Signal to the web app that the extension is installed
  window.__PGSC_EXTENSION_INSTALLED__ = true;

  // ---------------------
  // Forward messages from web app → background
  // ---------------------
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'PGSC_WEB_APP') return;

    const { requestId, ...rest } = event.data;

    chrome.runtime.sendMessage(rest, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({
          source: 'PGSC_EXTENSION_BRIDGE',
          requestId,
          ok: false,
          error: chrome.runtime.lastError.message,
        }, '*');
        return;
      }
      window.postMessage({
        source: 'PGSC_EXTENSION_BRIDGE',
        requestId,
        ...(response || {}),
      }, '*');
    });
  });

  // ---------------------
  // Forward push messages from background → web app
  // ---------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Push to the web app page
    window.postMessage({ source: 'PGSC_EXTENSION_BRIDGE', ...message }, '*');
    sendResponse({ ok: true });
  });
})();
