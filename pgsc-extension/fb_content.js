// =====================================================================
// fb_content.js — PGSC Share Helper (Facebook Content Script)
// Runs on: https://www.facebook.com/* and https://web.facebook.com/*
// Purpose: Automates Facebook native share-to-group flow for each group
// =====================================================================

(function () {
  'use strict';

  let SESSION = null;
  let RUNNING = false;

  const POST_PAGE_PATTERNS = [
    /facebook\.com\/.+\/posts\//i,
    /facebook\.com\/photo/i,
    /facebook\.com\/video/i,
    /facebook\.com\/permalink/i,
    /facebook\.com\/share\//i,
    /facebook\.com\/watch/i,
  ];

  const RATE_LIMIT_TEXTS = [
    'เราได้จำกัดจำนวนการโพสต์',
    'จำกัดจำนวนการโพสต์',
    'แสดงความคิดเห็น หรือทำสิ่งอื่นๆ',
    'ไม่ละเมิดมาตรฐานชุมชนของเรา',
    'โปรดแจ้งให้เราทราบ',
    'temporarily blocked',
    'we limit how often',
    'we restrict certain activity',
    'you can’t post',
    'you cannot post',
    'try again later',
  ];

  const PENDING_APPROVAL_TEXTS = [
    'รอแอดมิน',
    'รอการอนุมัติ',
    'pending approval',
    'approval',
    'approve',
    'อนุมัติ',
  ];

  class ShareFlowError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ShareFlowError';
      this.code = code;
    }
  }

  // ---------------------
  // Init: signal background that this FB tab is ready
  // ---------------------
  function init() {
    const url = window.location.href;
    const isPostPage = POST_PAGE_PATTERNS.some((pattern) => pattern.test(url));
    if (!isPostPage) return;

    log('Content script initialized on post page');

    waitForPageReady().then(() => {
      chrome.runtime.sendMessage({ type: 'PGSC_FB_READY' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.ok && response?.group) {
          startShare(response.group, response.caption, response.index, response.total, response.imageUrl, response.postMode);
        }
      });
    }).catch(err => {
      console.error('[PGSC Extension] init failed:', err);
    });
  }

  async function waitForPageReady() {
    await waitForElement('[role="article"], [data-pagelet^="FeedUnit"], [data-pagelet="MainFeed"]', 15000);
    await delay(randomBetween(700, 1300));
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
      startShare(message.group, message.caption, message.index, message.total, message.imageUrl, message.postMode)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (message.type === 'PGSC_GET_STATUS') {
      sendResponse({ running: RUNNING, session: SESSION });
    }
  });

  // ---------------------
  // Main Share Orchestrator
  // ---------------------
  async function startShare(group, caption, index, total, imageUrl, postMode) {
    RUNNING = true;
    SESSION = { group, caption, index, total, imageUrl, postMode };
    log(`[${index + 1}/${total}] Sharing to: ${group.name}`);

    let result;
    try {
      await shareToGroup(group, caption, imageUrl, postMode);
      result = {
        group: group.name,
        groupId: group.id,
        status: 'posted',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      log(`Error sharing to ${group.name}: ${err.message}`);
      await closeOpenDialogs();

      const code = err.code || (hasAnyText(err.message, ['pending']) ? 'pending_admin' : 'failed');
      const status = code === 'pending_admin'
        ? 'pending_admin'
        : code === 'rate_limited' || code === 'group_not_found'
          ? 'skipped'
          : 'failed';

      result = {
        group: group.name,
        groupId: group.id,
        status,
        reason: code === 'rate_limited' ? 'rate_limited' : err.message,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'PGSC_RESULT', result });
      RUNNING = false;
      const isDone = response?.isDone;

      if (!isDone) {
        const delayMs = result.reason === 'rate_limited'
          ? randomBetween(1000, 2200)
          : randomBetween(5000, 9000);
        log(`Waiting ${Math.round(delayMs / 1000)}s before next group...`);
        await delay(delayMs);
        chrome.runtime.sendMessage({ type: 'PGSC_NAVIGATE_POST' });
      } else {
        log('All groups done!');
      }
    } catch (err) {
      RUNNING = false; // Reset status on failure to send message
      log(`Failed to report result to background: ${err.message}`);
    }
  }

  // ---------------------
  // Core Share Workflow
  // ---------------------
  async function shareToGroup(group, caption, imageUrl, postMode) {
    await runStep('เปิดลิงก์และกดลูกศรแชร์', () => clickShareButton());
    await runStep('เลือกเมนูแชร์ไปยังกลุ่ม', () => clickGroupsOption());
    await runStep(`ค้นหาและเลือกกลุ่ม: ${group.name}`, () => searchAndSelectGroup(group.name));

    if (caption && caption.trim()) {
      await runStep('วางแคปชั่นในช่องโพสต์', () => insertCaption(caption.trim()));
    }

    if (imageUrl && imageUrl.trim()) {
      await runStep('อัปโหลดรูปภาพแนบ', () => uploadPostImage(imageUrl));
    }

    if (postMode === 'review') {
      log('โหมดตรวจสอบก่อนแชร์: แสดงตัวนำทางและรอผู้ใช้กดโพสต์เอง');
      let skipClicked = false;
      showOverlayMessage('👁️ PGSC: กรุณาตรวจสอบแล้วกด "โพสต์" (หรือกดปุ่มข้ามเพื่อไปยังกลุ่มถัดไป)', true, () => {
        skipClicked = true;
      });

      const startedAt = Date.now();
      const maxWaitMs = 5 * 60 * 1000; // 5 minutes max wait
      
      while (Date.now() - startedAt < maxWaitMs) {
        if (skipClicked) {
          hideOverlayMessage();
          throw new ShareFlowError('skipped', 'ผู้ใช้กดข้ามกลุ่มนี้');
        }

        const dialog = getTopDialog();
        if (!dialog) {
          hideOverlayMessage();
          await delay(1500);
          
          const postErrToast = document.querySelector('[role="alert"], [data-testid="toast"]');
          if (postErrToast) {
            const toastText = normalizeText(postErrToast.textContent || '');
            if (hasAnyText(toastText, ['เกิดข้อผิดพลาด', 'error', 'ไม่สำเร็จ'])) {
              throw new ShareFlowError('post_error', `Facebook error toast: ${postErrToast.textContent}`);
            }
          }
          log('ตรวจพบการปิดกล่องข้อความ — ย้ายไปยังขั้นตอนถัดไป');
          return;
        }

        const rateLimitDialog = detectRateLimitDialog();
        if (rateLimitDialog) {
          hideOverlayMessage();
          await clickCancelOrClose(rateLimitDialog);
          throw new ShareFlowError('rate_limited', 'rate_limited');
        }

        await delay(500);
      }

      hideOverlayMessage();
      throw new ShareFlowError('timeout', 'หมดเวลารอตรวจทาน (5 นาที)');
    } else {
      await runStep('กดโพสต์', () => clickPostButton());
      await runStep('ตรวจผลลัพธ์หลังโพสต์', () => detectSuccess());
    }
    log(`Shared to: ${group.name}`);
  }

  async function runStep(label, task) {
    log(`Step: ${label}`);
    await assertNotRateLimited(label);
    const result = await task();
    await assertNotRateLimited(label);
    return result;
  }

  // ---------------------
  // Step 1: Find and click the Share arrow on the post
  // ---------------------
  async function clickShareButton() {
    const btn = await findShareButton();
    if (!btn) throw new ShareFlowError('share_not_found', 'Share arrow button not found on this post');

    await delay(randomBetween(400, 900));
    simulateClick(btn);
    await waitForShareSurface(8000);
  }

  async function findShareButton(retries = 5) {
    for (let attempt = 0; attempt < retries; attempt++) {
      const scopes = getPostScopes();

      for (const scope of scopes) {
        const btn = findBestShareButtonInScope(scope);
        if (btn) return btn;
      }

      await delay(randomBetween(900, 1400));
    }
    return null;
  }

  function getPostScopes() {
    const articles = [...document.querySelectorAll('[role="article"]')]
      .filter(isVisible)
      .sort((a, b) => area(b) - area(a));

    const feedUnits = [...document.querySelectorAll('[data-pagelet^="FeedUnit"], [data-pagelet="MainFeed"]')]
      .filter(fu => isVisible(fu) && !articles.some(a => fu.contains(a)))
      .sort((a, b) => area(b) - area(a));

    return [...articles, ...feedUnits, document.body];
  }

  function findBestShareButtonInScope(scope) {
    const candidates = [...scope.querySelectorAll(
      '[aria-label*="แชร์"], [aria-label*="share" i], [role="button"], button, a[role="button"], div[tabindex="0"]'
    )].filter(el => isVisible(el) && !isInsideDialog(el));

    const scored = candidates
      .map((el) => {
        const clickable = getClickableAncestor(el);
        if (!clickable || !isVisible(clickable) || isDisabled(clickable)) return null;

        const text = normalizedElementText(clickable);
        const label = normalizeText(clickable.getAttribute('aria-label') || el.getAttribute('aria-label') || '');
        const combined = `${text} ${label}`.trim();
        const rect = clickable.getBoundingClientRect();
        let score = 0;

        if (exactTextMatch(text, ['แชร์', 'share', 'ส่ง', 'send'])) score += 100;
        if (exactTextMatch(label, ['แชร์', 'share', 'ส่ง', 'send'])) score += 90;
        if (hasAnyText(combined, ['แชร์', 'share'])) score += 60;
        if (hasAnyText(combined, ['comment', 'ความคิดเห็น', 'like', 'ถูกใจ'])) score -= 80;
        if (text.length > 80) score -= 50;
        if (rect.width <= 72 && rect.height <= 72 && clickable.querySelector('svg')) score += 10;

        return score > 0 ? { el: clickable, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  // ---------------------
  // Step 2: Click Group option in the share sheet
  // ---------------------
  async function clickGroupsOption() {
    const surface = await waitForShareSurface(8000);
    if (!surface) throw new ShareFlowError('share_menu_not_found', 'Share menu did not open');

    const groupBtn = await waitForElementByCheck(() => findGroupsOption(surface), 8000);
    if (!groupBtn) throw new ShareFlowError('group_option_not_found', 'Groups option not found in share sheet');

    simulateClick(groupBtn);
    await delay(randomBetween(1000, 1800));
  }

  function findGroupsOption(surface) {
    const candidates = [...surface.querySelectorAll(
      '[role="button"], [role="menuitem"], button, a, div[tabindex="0"], span'
    )].filter(isVisible);

    const scored = candidates
      .map((el) => {
        const clickable = getClickableAncestor(el);
        if (!clickable || !isVisible(clickable) || isDisabled(clickable)) return null;

        const text = normalizedElementText(clickable);
        if (!text || text.length > 160) return null;

        let score = 0;
        if (hasAnyText(text, ['แชร์ไปยังกลุ่ม', 'share to a group'])) score += 120;
        if (exactTextMatch(text, ['กลุ่ม', 'group', 'groups'])) score += 90;
        if (hasAnyText(text, ['กลุ่ม', 'group'])) score += 45;
        if (hasAnyText(text, ['เพจ', 'page', 'สตอรี่', 'story', 'messenger', 'คัดลอก', 'copy'])) score -= 80;

        return score > 0 ? { el: clickable, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  async function waitForShareSurface(timeout) {
    return waitForElementByCheck(() => {
      const menu = getTopLayer('[role="menu"], [role="dialog"]');
      if (menu && hasAnyText(menu.textContent || '', ['กลุ่ม', 'group', 'share', 'แชร์'])) return menu;
      return null;
    }, timeout);
  }

  // ---------------------
  // Step 3: Search and select first matching group result
  // ---------------------
  async function searchAndSelectGroup(groupName) {
    const surface = await waitForElementByCheck(() => {
      const dialog = getTopDialog();
      if (dialog && findGroupSearchInput(dialog)) return dialog;
      return null;
    }, 10000);

    if (!surface) throw new ShareFlowError('group_search_not_found', 'Group search dialog not found');

    const input = findGroupSearchInput(surface);
    if (!input) throw new ShareFlowError('group_search_not_found', 'Group search input not found');

    input.focus();
    await delay(randomBetween(200, 450));
    setNativeValue(input, '');
    await delay(randomBetween(200, 400));
    if (input.value !== '') {
      input.select();
      document.execCommand('delete');
      await delay(200);
    }
    await typeIntoInput(input, groupName);
    await assertNotRateLimited('ค้นหากลุ่ม');

    const groupItem = await waitForFirstGroupResult(surface, input, groupName, 9000);
    if (!groupItem) throw new ShareFlowError('group_not_found', `Group "${groupName}" not found in search results`);

    await delay(randomBetween(350, 750));
    simulateClick(groupItem);
    await delay(randomBetween(1200, 2200));
  }

  function findGroupSearchInput(container) {
    const inputs = [...container.querySelectorAll('input[type="text"], input:not([type]), input[placeholder], input[aria-label]')]
      .filter(isVisible);

    const preferred = inputs.find((input) => {
      const text = normalizeText([
        input.getAttribute('placeholder'),
        input.getAttribute('aria-label'),
        input.value,
      ].filter(Boolean).join(' '));
      return hasAnyText(text, ['ค้นหากลุ่ม', 'ค้นหา', 'search groups', 'search group', 'search']);
    });

    return preferred || inputs[0] || null;
  }

  async function waitForFirstGroupResult(surface, input, groupName, timeout) {
    return waitForElementByCheck(() => findFirstGroupResult(surface, input, groupName), timeout);
  }

  function findFirstGroupResult(surface, input, groupName) {
    const target = normalizeText(groupName);
    const shortTarget = target.slice(0, Math.min(target.length, 12));
    const inputRect = input.getBoundingClientRect();

    const candidates = [...surface.querySelectorAll(
      '[role="option"], [role="listitem"], [role="button"], a, div[tabindex="0"]'
    )].filter((el) => {
      if (!isVisible(el) || isDisabled(el) || el.contains(input) || input.contains(el)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= inputRect.bottom - 4) return false;
      const text = normalizedElementText(el);
      if (!text || text.length > 260) return false;
      if (hasAnyText(text, ['ค้นหากลุ่ม', 'search groups', 'กลุ่มทั้งหมด', 'all groups'])) return false;
      return true;
    });

    const scored = candidates
      .map((el, order) => {
        const text = normalizedElementText(el);
        let score = 0;

        if (text === target) score += 150;
        if (target && text.includes(target)) score += 120;
        if (shortTarget && text.includes(shortTarget)) score += 70;
        if (el.querySelector('img, svg')) score += 10;
        if (hasAnyText(text, ['กลุ่มสาธารณะ', 'public group', 'กลุ่มส่วนตัว', 'private group'])) score += 5;
        if (hasAnyText(text, ['สร้างกลุ่ม', 'create group', 'ดูเพิ่มเติม', 'see more'])) score -= 80;

        return score > 0 ? { el: getClickableAncestor(el) || el, score: score - order } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  // ---------------------
  // Step 4: Insert caption into the post composer
  // ---------------------
  async function insertCaption(text) {
    const dialog = getTopDialog();
    if (!dialog) throw new ShareFlowError('composer_not_found', 'Post composer dialog not found');

    const editor = await waitForComposerEditor(dialog, 7000);
    if (!editor) throw new ShareFlowError('composer_not_found', 'Caption editor not found');

    editor.focus();
    await delay(randomBetween(300, 650));

    const pasteSuccess = await pasteIntoEditor(editor, text);
    if (!pasteSuccess) {
      const cmdSuccess = document.execCommand('insertText', false, text);
      if (!cmdSuccess) {
        await typeChars(editor, text);
        await delay(randomBetween(450, 900));
        return;
      }
    }

    editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    await delay(randomBetween(450, 900));
  }

  async function waitForComposerEditor(dialog, timeout) {
    return waitForElementByCheck(() => {
      const editors = [...dialog.querySelectorAll(
        'div[contenteditable="true"], [data-lexical-editor="true"], div[role="textbox"]'
      )].filter(isVisible);

      return editors.find((editor) => {
        const text = normalizeText([
          editor.getAttribute('aria-label'),
          editor.getAttribute('placeholder'),
          editor.textContent,
        ].filter(Boolean).join(' '));
        return !hasAnyText(text, ['ค้นหากลุ่ม', 'search groups']);
      }) || null;
    }, timeout);
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
      await delay(350);
      return editorTextContains(editor, text);
    } catch {
      return false;
    }
  }

  async function typeChars(editor, text) {
    for (const char of text) {
      editor.focus();
      document.execCommand('insertText', false, char);
      editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
      await delay(randomBetween(20, 65));
    }
  }

  function editorTextContains(editor, text) {
    const inserted = normalizeText(editor.textContent || editor.value || '');
    const expected = normalizeText(text).slice(0, 20);
    return expected ? inserted.includes(expected) : true;
  }

  // ---------------------
  // Step 5: Click Post button
  // ---------------------
  async function clickPostButton() {
    const dialog = getTopDialog();
    if (!dialog) throw new ShareFlowError('dialog_not_found', 'Dialog not found when clicking Post');

    const postBtn = await waitForElementByCheck(() => findPostButton(dialog), 7000);
    if (!postBtn) throw new ShareFlowError('post_button_not_found', 'Post button not found or still disabled');

    await delay(randomBetween(500, 1100));
    simulateClick(postBtn);
    await delay(randomBetween(1200, 2200));
  }

  function findPostButton(container) {
    const buttons = [...container.querySelectorAll('[role="button"], button')]
      .filter(btn => isVisible(btn) && !isDisabled(btn));

    return buttons.find((btn) => {
      return hasExactElementLabel(btn, ['โพสต์', 'post', 'แชร์', 'share', 'ส่ง', 'send']);
    }) || null;
  }

  // ---------------------
  // Step 6: Detect success/failure
  // ---------------------
  async function detectSuccess() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 14000) {
      await assertNotRateLimited('ตรวจผลลัพธ์');

      const dialog = getTopDialog();
      if (dialog) {
        const dialogText = normalizeText(dialog.textContent || '');
        if (hasAnyText(dialogText, PENDING_APPROVAL_TEXTS)) {
          throw new ShareFlowError('pending_admin', 'pending_admin');
        }

        // Check for error messages inside dialog
        const errorTexts = ['something went wrong', 'เกิดข้อผิดพลาด', 'error', 'ไม่สำเร็จ'];
        if (hasAnyText(dialogText, errorTexts)) {
          throw new ShareFlowError('post_error', `Facebook error: ${dialogText.slice(0, 100)}`);
        }

        const postBtn = findPostButton(dialog);
        if (!postBtn && !hasAnyText(dialogText, ['โพสต์', 'post', 'แชร์', 'share'])) return;
      }

      // Check for success toast
      const toast = document.querySelector('[role="alert"], [data-testid="toast"]');
      if (toast) {
        const toastText = normalizeText(toast.textContent || '');
        if (hasAnyText(toastText, ['สำเร็จ', 'shared', 'posted', 'แชร์แล้ว'])) {
          return; // Definitive success
        }
      }

      if (!dialog) {
        // Dialog disappeared - wait briefly to see if any toast signals error, otherwise assume success
        await delay(1500);
        const postErrToast = document.querySelector('[role="alert"], [data-testid="toast"]');
        if (postErrToast) {
          const toastText = normalizeText(postErrToast.textContent || '');
          if (hasAnyText(toastText, ['เกิดข้อผิดพลาด', 'error', 'ไม่สำเร็จ'])) {
            throw new ShareFlowError('post_error', `Facebook error toast: ${postErrToast.textContent}`);
          }
        }
        return;
      }

      await delay(500);
    }

    const dialog = getTopDialog();
    if (dialog && findPostButton(dialog)) {
      throw new ShareFlowError('post_timeout', 'Post failed: dialog is still open after submit');
    }
  }

  async function closeOpenDialogs() {
    const rateLimitDialog = detectRateLimitDialog();
    if (rateLimitDialog) {
      await clickCancelOrClose(rateLimitDialog);
      return;
    }

    const dialogs = getVisibleLayers('[role="dialog"]').reverse();
    for (const dialog of dialogs) {
      await clickCancelOrClose(dialog);
      await delay(350);
    }

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    await delay(500);
  }

  // ---------------------
  // Rate-limit / skip handling
  // ---------------------
  async function assertNotRateLimited(stage) {
    const dialog = detectRateLimitDialog();
    if (!dialog) return;

    log(`Rate limit detected during "${stage}". Cancelling dialog and skipping this group.`);
    await clickCancelOrClose(dialog);
    throw new ShareFlowError('rate_limited', 'rate_limited');
  }

  function detectRateLimitDialog() {
    return getVisibleLayers('[role="dialog"], [role="alertdialog"]')
      .find((dialog) => hasAnyText(dialog.textContent || '', RATE_LIMIT_TEXTS)) || null;
  }

  async function clickCancelOrClose(container) {
    const button = findDialogAction(container, ['ยกเลิก', 'cancel', 'ตกลง', 'ok', 'ปิด', 'close']);
    if (button) {
      simulateClick(button);
      await delay(500);
      return true;
    }

    const closeButton = container.querySelector('[aria-label="ปิด"], [aria-label="Close"], [aria-label*="close" i]');
    if (closeButton && isVisible(closeButton)) {
      simulateClick(closeButton);
      await delay(500);
      return true;
    }

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    await delay(500);
    return false;
  }

  function findDialogAction(container, labels) {
    const buttons = [...container.querySelectorAll('[role="button"], button')]
      .filter(btn => isVisible(btn) && !isDisabled(btn));
    return buttons.find((btn) => hasExactElementLabel(btn, labels)) || null;
  }

  // ---------------------
  // DOM Utilities
  // ---------------------
  function waitForElement(selector, timeout = 5000) {
    return waitForElementByCheck(() => document.querySelector(selector), timeout);
  }

  function waitForElementByCheck(check, timeout = 5000, interval = 180) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      let observer = null;
      let timer = null;

      const finish = (value) => {
        if (observer) observer.disconnect();
        if (timer) clearInterval(timer);
        resolve(value);
      };

      const runCheck = () => {
        const value = check();
        if (value) {
          finish(value);
          return true;
        }
        if (Date.now() - startedAt >= timeout) {
          finish(null);
          return true;
        }
        return false;
      };

      if (runCheck()) return;

      observer = new MutationObserver(runCheck);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
      timer = setInterval(runCheck, interval);
    });
  }

  function getTopDialog() {
    return getTopLayer('[role="dialog"], [role="alertdialog"]');
  }

  function getTopLayer(selector) {
    const layers = getVisibleLayers(selector);
    return layers[layers.length - 1] || null;
  }

  function getVisibleLayers(selector) {
    return [...document.querySelectorAll(selector)]
      .filter(isVisible)
      .sort((a, b) => {
        const zA = parseInt(window.getComputedStyle(a).zIndex) || 0;
        const zB = parseInt(window.getComputedStyle(b).zIndex) || 0;
        if (zA !== zB) return zA - zB;
        const depthA = getDepth(a);
        const depthB = getDepth(b);
        if (depthA !== depthB) return depthA - depthB;
        return area(a) - area(b);
      });
  }

  function getDepth(el) {
    let depth = 0;
    let node = el;
    while (node?.parentElement) {
      depth += 1;
      node = node.parentElement;
    }
    return depth;
  }

  function isInsideDialog(el) {
    return Boolean(el.closest('[role="dialog"], [role="alertdialog"], [role="menu"]'));
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 4 &&
      rect.height > 4 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';
  }

  function isDisabled(el) {
    return el.disabled === true ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.hasAttribute('disabled') ||
      Boolean(el.closest('[aria-disabled="true"]'));
  }

  function area(el) {
    const rect = el.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function getClickableAncestor(el) {
    if (!el) return null;
    return el.closest('[role="button"], button, a, [tabindex="0"], [role="menuitem"], [role="option"], [role="listitem"]') || el;
  }

  function normalizedElementText(el) {
    if (!el) return '';
    return normalizeText([
      el.textContent,
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.getAttribute('title'),
    ].filter(Boolean).join(' '));
  }

  function normalizeText(value) {
    return (value || '')
      .replace(/\u200b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function exactTextMatch(value, options) {
    const normalized = normalizeText(value);
    return options.some(option => normalized === normalizeText(option));
  }

  function hasExactElementLabel(el, options) {
    return [
      el.textContent,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
    ].some(value => exactTextMatch(value || '', options));
  }

  function hasAnyText(value, texts) {
    const normalized = normalizeText(value);
    return texts.some(text => normalized.includes(normalizeText(text)));
  }

  function simulateClick(el) {
    const target = getClickableAncestor(el) || el;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function setNativeValue(input, value) {
    try {
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(prototype, 'value');
      desc.set.call(input, value);
    } catch {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function typeIntoInput(input, text) {
    input.focus();
    let accumulated = '';
    for (const char of text) {
      accumulated += char;
      setNativeValue(input, accumulated);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      await delay(randomBetween(12, 35));
    }
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
  // Image Uploading & Manual Review UI Helpers
  // ---------------------
  function base64ToFile(base64Data, filename = 'image.png') {
    const arr = base64Data.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  function findPhotoVideoButton(container) {
    const candidates = [...container.querySelectorAll('[aria-label*="รูปภาพ"], [aria-label*="photo" i], [aria-label*="วีดีโอ" i], [aria-label*="video" i], [role="button"], button, div[tabindex="0"]')]
      .filter(isVisible);

    const scored = candidates
      .map((el) => {
        const clickable = getClickableAncestor(el);
        if (!clickable || !isVisible(clickable) || isDisabled(clickable)) return null;

        const text = normalizedElementText(clickable);
        const label = normalizeText(clickable.getAttribute('aria-label') || el.getAttribute('aria-label') || '');
        const combined = `${text} ${label}`.trim();

        let score = 0;
        if (hasAnyText(combined, ['รูปภาพ/วิดีโอ', 'รูปภาพ', 'วิดีโอ', 'photo/video', 'photo', 'video', 'media', 'สื่อ'])) score += 100;
        if (clickable.querySelector('svg') || el.querySelector('svg')) score += 10;

        return score > 0 ? { el: clickable, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  async function getFileInput(container) {
    let input = container.querySelector('input[type="file"]');
    if (input) return input;

    const photoVideoBtn = findPhotoVideoButton(container);
    if (photoVideoBtn) {
      log('คลิกปุ่ม รูปภาพ/วิดีโอ เพื่อเปิดใช้งานช่องอัปโหลด');
      simulateClick(photoVideoBtn);
      await delay(randomBetween(1000, 2000));
      input = container.querySelector('input[type="file"]');
    }
    return input;
  }

  async function uploadPostImage(base64Data) {
    const dialog = getTopDialog();
    if (!dialog) throw new ShareFlowError('composer_not_found', 'Post composer dialog not found for uploading image');

    const fileInput = await getFileInput(dialog);
    if (!fileInput) throw new ShareFlowError('file_input_not_found', 'Facebook file uploader input not found');

    log('กำลังแปลงรูปภาพและเตรียมอัปโหลด...');
    const file = base64ToFile(base64Data, 'pgsc_upload.png');

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    log('รูปภาพแนบแล้ว กำลังรอให้เซิร์ฟเวอร์ Facebook ประมวลผลภาพ (3.5 วินาที)...');
    await delay(3500);
  }

  function showOverlayMessage(message, showSkipButton = false, onSkip = null) {
    hideOverlayMessage();
    
    const overlay = document.createElement('div');
    overlay.id = 'pgsc-review-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '20px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.zIndex = '999999';
    overlay.style.backgroundColor = 'rgba(28, 28, 30, 0.95)';
    overlay.style.border = '2px solid #FF6B2B';
    overlay.style.borderRadius = '12px';
    overlay.style.padding = '14px 24px';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    overlay.style.fontSize = '15px';
    overlay.style.fontWeight = 'bold';
    overlay.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.gap = '15px';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.transition = 'all 0.3s ease';

    const textNode = document.createElement('span');
    textNode.textContent = message;
    overlay.appendChild(textNode);

    if (showSkipButton && onSkip) {
      const btn = document.createElement('button');
      btn.textContent = '⏭️ ข้ามกลุ่มนี้';
      btn.style.backgroundColor = '#ef5350';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.padding = '6px 12px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '13px';
      btn.style.fontWeight = 'bold';
      btn.addEventListener('click', onSkip);
      overlay.appendChild(btn);
    }

    document.body.appendChild(overlay);
  }

  function hideOverlayMessage() {
    const existing = document.getElementById('pgsc-review-overlay');
    if (existing) {
      existing.remove();
    }
  }

  // ---------------------
  // Start
  // ---------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
