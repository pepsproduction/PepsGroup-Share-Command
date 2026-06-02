// =====================================================================
// fb_content.js — PGSC Share Helper (Facebook Content Script)
// Runs on: https://www.facebook.com/*
// Purpose: Automates the Native Share Dialog for each group
// =====================================================================

(function () {
  'use strict';

  let SESSION = null;   // Current group to share to
  let RUNNING = false;

  // ---------------------
  // Init: signal background that this FB tab is ready
  // ---------------------
  function init() {
    // Only run on post pages, not home/groups etc.
    // We wait for DOM to settle, then signal background
    const url = window.location.href;
    const isPostPage =
      /facebook\.com\/.+\/posts\//i.test(url) ||
      /facebook\.com\/photo/i.test(url) ||
      /facebook\.com\/video/i.test(url) ||
      /facebook\.com\/permalink/i.test(url);

    if (!isPostPage) return;

    log('Content script initialized on post page');

    // Wait a bit for the page to finish loading before signalling ready
    waitForPageReady().then(() => {
      chrome.runtime.sendMessage({ type: 'PGSC_FB_READY' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.ok && response?.group) {
          startShare(response.group, response.caption, response.index, response.total);
        }
      });
    });
  }

  async function waitForPageReady() {
    // Wait until the main article element is present on the page
    return waitForElement('[role="article"]', 10000);
  }

  // ---------------------
  // Listen for commands from background (for chained groups)
  // ---------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PGSC_SHARE_NEXT') {
      if (RUNNING) {
        sendResponse({ ok: false, reason: 'Already running' });
        return;
      }
      startShare(message.group, message.caption, message.index, message.total)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message.type === 'PGSC_GET_STATUS') {
      sendResponse({ running: RUNNING });
    }
  });

  // ---------------------
  // Main Share Orchestrator
  // ---------------------
  async function startShare(group, caption, index, total) {
    RUNNING = true;
    SESSION = { group, caption, index, total };
    log(`[${index + 1}/${total}] Sharing to: ${group.name}`);

    let result;
    try {
      await shareToGroup(group, caption);
      result = {
        group: group.name,
        groupId: group.id,
        status: 'posted',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      log(`Error sharing to ${group.name}: ${err.message}`);
      // Close any open dialog before next attempt
      await closeOpenDialogs();
      result = {
        group: group.name,
        groupId: group.id,
        status: err.message.includes('pending') ? 'pending_admin' : 'failed',
        reason: err.message,
        timestamp: new Date().toISOString(),
      };
    }

    // Report result to background
    chrome.runtime.sendMessage({ type: 'PGSC_RESULT', result }, (response) => {
      if (chrome.runtime.lastError) return;
      const isDone = response?.isDone;
      RUNNING = false;

      if (!isDone) {
        const delayMs = randomBetween(5000, 9000);
        log(`Waiting ${Math.round(delayMs / 1000)}s before next group...`);
        setTimeout(() => {
          // Instruct background page to reload to postUrl to clear state
          chrome.runtime.sendMessage({ type: 'PGSC_NAVIGATE_POST' });
        }, delayMs);
      } else {
        log('All groups done!');
      }
    });
  }

  // ---------------------
  // Core Share Workflow
  // ---------------------
  async function shareToGroup(group, caption) {
    // Step 1: Click Share button on the post
    await clickShareButton();

    // Step 2: Click "กลุ่ม" in the share options sheet
    await clickGroupsOption();

    // Step 3: Search for the group and select it
    await searchAndSelectGroup(group.name);

    // Step 4: Type / paste caption in composer
    if (caption && caption.trim()) {
      await insertCaption(caption.trim());
    }

    // Step 5: Click Post button
    await clickPostButton();

    // Step 6: Detect success
    await detectSuccess();

    log(`✅ Shared to: ${group.name}`);
  }

  // ---------------------
  // Step 1: Find and click the Share button
  // ---------------------
  async function clickShareButton() {
    const btn = await findShareButton();
    if (!btn) throw new Error('Share button not found on this post');

    await delay(randomBetween(400, 1000));
    simulateClick(btn);
    await delay(randomBetween(1000, 2000));
  }

  async function findShareButton(retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      // Find the main article container first
      const article = document.querySelector('[role="article"]');
      if (!article) {
        if (attempt < retries - 1) await delay(2000);
        continue;
      }

      // Try aria-label selectors first (more robust with substring match) inside the article
      const ariaSelectors = [
        '[aria-label*="แชร์"]', 
        '[aria-label*="share" i]', 
        '[aria-label*="Share" i]',
        '[aria-label="ส่ง"]',
        '[aria-label="Send"]'
      ];
      for (const sel of ariaSelectors) {
        const els = article.querySelectorAll(sel);
        for (const el of els) {
          if (isClickable(el) || el.closest('[role="button"],[tabindex]')) return el;
        }
      }

      // Fallback: find by button/role=button + text that contains share keywords inside the article
      const buttons = article.querySelectorAll('[role="button"],button,div[tabindex="0"]');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const lowerText = text.toLowerCase();
        if (lowerText === 'แชร์' || lowerText === 'share' || lowerText === 'ส่ง' || lowerText === 'send') return btn;
        if (lowerText.includes('แชร์') || lowerText.includes('share')) {
          if (text.length < 25) return btn; // limit length to avoid catching huge text blocks
        }
        // Also check if it has a share count (like "88 แชร์" or "88 Shares")
        if (/\d+\s*(แชร์|share|shares)/i.test(lowerText) && text.length < 25) return btn;
      }

      if (attempt < retries - 1) await delay(2000);
    }
    return null;
  }

  // ---------------------
  // Step 2: Click "กลุ่ม" in share sheet
  // ---------------------
  async function clickGroupsOption() {
    // Wait a brief moment for the share menu overlay to render
    await delay(1000);

    // Search the entire document for "แชร์ไปยังกลุ่ม" or "Share to a group" options.
    // This is much safer than waiting for a specific dialog selector which changes frequently.
    const groupsBtn = findInContainer(
      document, 
      ['แชร์ไปยังกลุ่ม', 'Share to a group', 'กลุ่ม', 'Group'], 
      ['div', 'span', 'a', 'button', '[role="menuitem"]']
    );
    
    if (!groupsBtn) throw new Error('Groups option not found in share sheet');

    simulateClick(groupsBtn);
    await delay(randomBetween(1500, 2500));
  }

  // ---------------------
  // Step 3: Search and select group
  // ---------------------
  async function searchAndSelectGroup(groupName) {
    await delay(randomBetween(400, 800));

    // Wait for the group search input to appear in the DOM (up to 6 seconds)
    const input = await waitForElement('input[placeholder*="ค้นหา"],input[placeholder*="search" i]', 6000);
    if (!input) throw new Error('Group search input not found');

    // Clear and type group name
    input.focus();
    await delay(randomBetween(200, 500));

    // Set value and trigger React/framework events
    setNativeValue(input, '');
    await typeIntoInput(input, groupName);

    await delay(randomBetween(2000, 3000));

    // Find the group result item anywhere in the document
    const groupItem = await waitForGroupResult(document, groupName, 6000);
    if (!groupItem) throw new Error(`Group "${groupName}" not found in search results`);

    await delay(randomBetween(400, 800));
    simulateClick(groupItem);
    await delay(randomBetween(1500, 2500));
  }

  function findSearchInput(container) {
    // Try placeholder-based selectors using case-insensitive matches
    const input = container.querySelector('input[placeholder*="ค้นหา"],input[placeholder*="search" i]');
    if (input) return input;
    // Fallback: first text input in the modal
    return container.querySelector('input[type="text"],input:not([type="hidden"])');
  }

  async function waitForGroupResult(container, groupName, timeout) {
    const normalized = groupName.trim().toLowerCase();
    const shortName = normalized.substring(0, Math.min(normalized.length, 10));

    return new Promise((resolve) => {
      const check = () => {
        // Check various result container types
        const candidates = container.querySelectorAll(
          '[role="option"],[role="listitem"],[role="button"],li,div[tabindex]'
        );
        for (const el of candidates) {
          const text = (el.textContent || '').toLowerCase().trim();
          if (text.includes(shortName) && text.length < 200) {
            resolve(el);
            return true;
          }
        }
        return false;
      };

      if (check()) return;

      const obs = new MutationObserver(() => { if (check()) obs.disconnect(); });
      obs.observe(container, { childList: true, subtree: true, characterData: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  // ---------------------
  // Step 4: Insert caption into the post composer
  // ---------------------
  async function insertCaption(text) {
    // Wait for post composer area (contenteditable div)
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) throw new Error('Post composer dialog not found');

    const editor = await waitForComposerEditor(dialog, 5000);
    if (!editor) {
      log('Caption editor not found, skipping caption');
      return;
    }

    editor.focus();
    await delay(randomBetween(300, 600));

    // Try paste approach first (most reliable for Lexical/Draft.js editors)
    const pasteSuccess = await pasteIntoEditor(editor, text);
    if (!pasteSuccess) {
      // Fallback: execCommand
      const cmdSuccess = document.execCommand('insertText', false, text);
      if (!cmdSuccess) {
        // Last resort: type character by character
        await typeChars(editor, text);
      }
    }

    // Trigger input/change events
    editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
    await delay(randomBetween(300, 600));
  }

  async function waitForComposerEditor(dialog, timeout) {
    const selectors = [
      'div[contenteditable="true"]',
      '[data-lexical-editor="true"]',
      'div[role="textbox"]',
    ];

    return new Promise((resolve) => {
      const check = () => {
        for (const sel of selectors) {
          const els = dialog.querySelectorAll(sel);
          for (const el of els) {
            if (el.offsetHeight > 0) { resolve(el); return true; }
          }
        }
        return false;
      };

      if (check()) return;

      const obs = new MutationObserver(() => { if (check()) obs.disconnect(); });
      obs.observe(dialog, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  async function pasteIntoEditor(editor, text) {
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const evt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(evt);
      await delay(300);
      // Verify text was inserted
      return (editor.textContent || editor.value || '').includes(text.substring(0, 20));
    } catch {
      return false;
    }
  }

  async function typeChars(editor, text) {
    for (const char of text) {
      editor.focus();
      document.execCommand('insertText', false, char);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await delay(randomBetween(50, 130));
    }
  }

  // ---------------------
  // Step 5: Click Post button
  // ---------------------
  async function clickPostButton() {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) throw new Error('Dialog not found when clicking Post');

    const postBtn = findPostButton(dialog);
    if (!postBtn) throw new Error('Post button not found');

    await delay(randomBetween(500, 1200));
    simulateClick(postBtn);
    await delay(randomBetween(2000, 4000));
  }

  function findPostButton(container) {
    const buttons = container.querySelectorAll('[role="button"],button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || '';
      // In the share dialog, it could be โพสต์, Post, แชร์, Share, ส่ง, Send
      if (/^โพสต์$|^Post$|^แชร์$|^Share$|^ส่ง$|^Send$/i.test(text)) return btn;
    }
    return null;
  }

  // ---------------------
  // Step 6: Detect success/failure
  // ---------------------
  async function detectSuccess() {
    // If dialog closes, it's a success (FB closes dialog on successful submit).
    // Increase to 10 seconds for slow network connections
    const dialogGone = await waitForDialogToClose(10000);
    if (dialogGone) return; // Success!

    // If dialog is still open, check for error messages
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const text = dialog.textContent || '';
      if (text.includes('รอแอดมิน') || text.includes('pending approval') || text.includes('approval') || text.includes('อนุมัติ')) {
        throw new Error('pending_admin');
      }
      // Check if Post button is still there (post might have failed)
      const postBtn = findPostButton(dialog);
      if (postBtn) {
        throw new Error('Post failed (post dialog is still open after 10s)');
      }
    }

    // Assume success if we reach here (e.g. dialog might be closing or closed)
  }

  async function waitForDialogToClose(timeout) {
    return new Promise((resolve) => {
      const check = () => !document.querySelector('[role="dialog"]');
      if (check()) { resolve(true); return; }

      const obs = new MutationObserver(() => {
        if (check()) { obs.disconnect(); resolve(true); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(false); }, timeout);
    });
  }

  async function closeOpenDialogs() {
    const closeButtons = document.querySelectorAll('[aria-label="ปิด"],[aria-label="Close"]');
    for (const btn of closeButtons) {
      simulateClick(btn);
      await delay(500);
    }
    // Press Escape as fallback
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await delay(500);
  }

  // ---------------------
  // DOM Utilities
  // ---------------------
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) { resolve(el); return; }

      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  function findInContainer(container, texts, tags) {
    for (const tag of tags) {
      const els = container.querySelectorAll(tag);
      for (const el of els) {
        const text = el.textContent?.trim() || '';
        const normalizedText = text.toLowerCase();
        
        // Match if text exactly equals, starts with, ends with, or contains any of the target texts (case-insensitive)
        const isMatched = texts.some(t => {
          const lowerT = t.toLowerCase();
          return normalizedText === lowerT || 
                 normalizedText.includes(lowerT) || 
                 normalizedText.startsWith(lowerT + '\n') || 
                 normalizedText.endsWith('\n' + lowerT);
        });

        if (isMatched) {
          if (isClickable(el) || el.closest('[role="button"],[tabindex]')) return el;
        }
      }
    }
    return null;
  }

  function isClickable(el) {
    const tag = el.tagName?.toLowerCase();
    const role = el.getAttribute('role');
    const tabIndex = el.getAttribute('tabindex');
    return tag === 'button' || tag === 'a' || role === 'button' || tabIndex !== null;
  }

  function simulateClick(el) {
    el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function setNativeValue(input, value) {
    try {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      desc.set.call(input, value);
    } catch {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function typeIntoInput(input, text) {
    // Set via native setter to trigger React
    setNativeValue(input, text);
    await delay(300);
    // Also simulate keydown/up for the last char to trigger search
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function log(msg) {
    console.log(`[PGSC Extension] ${msg}`);
    chrome.runtime.sendMessage({ type: 'PGSC_LOG', text: msg }).catch(() => {});
  }

  // ---------------------
  // Start
  // ---------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1500); // Give the React app time to render
  }
})();
