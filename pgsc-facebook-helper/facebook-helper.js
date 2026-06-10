(() => {
  const SOURCE = 'PGSC_SHARE_COMMAND';
  const STORE_KEY = 'pgscShareCommand';
  const MAX_COMMAND_AGE_MS = 5 * 60 * 1000;
  const PROCESSED_KEY = 'pgsc_processed_requests';
  const COMPOSER_TEXTS = [
    'เขียนอะไรสักหน่อย',
    'เขียนอะไรสักอย่าง',
    'เขียนโพสต์',
    'สร้างโพสต์',
    'write something',
    "what's on your mind",
    'create post',
  ];

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function log(msg, ...args) {
    console.log(`%c[PGSC Helper] ${msg}`, 'color: #ff9800; font-weight: bold;', ...args);
  }

  function logError(msg, ...args) {
    console.error(`%c[PGSC Helper Error] ${msg}`, 'color: #f44336; font-weight: bold;', ...args);
  }

  function loadProcessedRequests() {
    try {
      return new Set(JSON.parse(window.sessionStorage.getItem(PROCESSED_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  const processedRequests = loadProcessedRequests();

  function rememberProcessedRequest(requestId) {
    processedRequests.add(requestId);
    const latest = Array.from(processedRequests).slice(-30);
    try {
      window.sessionStorage.setItem(PROCESSED_KEY, JSON.stringify(latest));
    } catch {
      // Storage can be blocked in strict browser modes.
    }
  }

  async function isRequestProcessed(requestId) {
    try {
      const data = await chrome.storage.local.get(PROCESSED_KEY);
      const list = data[PROCESSED_KEY] || [];
      return list.includes(requestId);
    } catch {
      return false;
    }
  }

  async function markRequestProcessed(requestId) {
    try {
      const data = await chrome.storage.local.get(PROCESSED_KEY);
      const list = data[PROCESSED_KEY] || [];
      if (!list.includes(requestId)) {
        list.push(requestId);
        const updated = list.slice(-50);
        await chrome.storage.local.set({ [PROCESSED_KEY]: updated });
        log('Marked command as processed in local storage:', requestId);
      }
    } catch (err) {
      logError('Failed to save processed request:', err);
    }
  }

  function isValidCommand(data) {
    return Boolean(
      data &&
        data.source === SOURCE &&
        data.type === 'PASTE_CAPTION' &&
        typeof data.requestId === 'string' &&
        typeof data.caption === 'string' &&
        typeof data.groupUrl === 'string' &&
        data.caption.trim() &&
        data.groupUrl.trim()
    );
  }

  function getGroupId(url) {
    try {
      const parsed = new URL(url, window.location.href);
      const match = parsed.pathname.match(/\/groups\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : '';
    } catch {
      const match = String(url).match(/\/groups\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : '';
    }
  }

  function isCurrentGroup(groupUrl) {
    const commandGroupId = getGroupId(groupUrl);
    const currentGroupId = getGroupId(window.location.href);
    return Boolean(commandGroupId && currentGroupId && commandGroupId === currentGroupId);
  }

  function isFreshCommand(command) {
    return Date.now() - Number(command.createdAt || 0) <= MAX_COMMAND_AGE_MS;
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function looksLikeComposerTrigger(element) {
    const label = normalizeText(
      [
        element.getAttribute('aria-label') || '',
        element.getAttribute('aria-placeholder') || '',
        element.getAttribute('placeholder') || '',
        element.innerText || '',
        element.textContent || '',
      ].join(' ')
    );

    return COMPOSER_TEXTS.some((text) => label.includes(text));
  }

  function findComposerTrigger() {
    const candidates = Array.from(
      document.querySelectorAll('[role="button"], button, [aria-label], [aria-placeholder], span, div')
    );

    for (const element of candidates) {
      if (!isVisible(element) || !looksLikeComposerTrigger(element)) continue;
      return element.closest('[role="button"], button, [tabindex="0"]') || element;
    }

    return null;
  }

  function looksLikePostEditor(element) {
    if (!isVisible(element)) return false;
    const role = element.getAttribute('role') || '';
    const editable = element.getAttribute('contenteditable') === 'true';

    if (!editable && role !== 'textbox') return false;

    // Must be inside the composer dialog
    const inDialog = element.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (!inDialog) return false;

    const label = normalizeText(
      [
        element.getAttribute('aria-label') || '',
        element.getAttribute('aria-placeholder') || '',
        element.getAttribute('placeholder') || '',
        element.textContent || '',
      ].join(' ')
    );
    const rect = element.getBoundingClientRect();

    if (COMPOSER_TEXTS.some((text) => label.includes(text))) return true;
    return rect.width >= 220 && rect.height >= 24;
  }

  function findPostEditor() {
    const editors = Array.from(
      document.querySelectorAll(
        'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], [role="textbox"]'
      )
    );

    return editors.find(looksLikePostEditor) || null;
  }

  function focusEditable(editor) {
    editor.scrollIntoView({ block: 'center', inline: 'nearest' });
    editor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    editor.click();
    editor.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertCaption(editor, caption) {
    const currentText = normalizeText(editor.innerText || editor.textContent || '');
    const targetText = normalizeText(caption);
    if (currentText.includes(targetText)) {
      log('Caption is already in editor. Skipping text insertion.');
      return true;
    }

    focusEditable(editor);

    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, caption);
    } catch {
      inserted = false;
    }

    if (!inserted) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selection.getRangeAt(0).deleteContents();
        selection.getRangeAt(0).insertNode(document.createTextNode(caption));
        selection.collapseToEnd();
        inserted = true;
      }
    }

    editor.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: caption,
        inputType: 'insertText',
      })
    );

    const checkText = normalizeText(editor.innerText || editor.textContent || '');
    return inserted || checkText.includes(targetText);
  }

  async function waitForEditor() {
    log('Waiting for post editor to appear (up to 9s)...');
    const deadline = Date.now() + 9000;

    while (Date.now() < deadline) {
      const editor = findPostEditor();
      if (editor) {
        log('Post editor found!');
        return editor;
      }
      await sleep(350);
    }

    logError('Timeout waiting for post editor!');
    return null;
  }

  async function openComposerAndPaste(caption, images) {
    log(`Starting paste operation. Images count: ${images?.length || 0}`);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      log(`Attempt ${attempt + 1}/4 to find composer and paste`);
      const existingEditor = findPostEditor();
      if (existingEditor) {
        log('Found existing composer editor inside dialog. Inserting caption...');
        if (insertCaption(existingEditor, caption)) {
          if (Array.isArray(images) && images.length > 0) {
            const dialog = existingEditor.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
            log('Uploading images to existing composer dialog container:', dialog);
            await uploadPostImages(dialog, images);
          }
          return true;
        }
      }

      log('Composer editor not found in dialog. Looking for trigger button...');
      const trigger = findComposerTrigger();
      if (trigger) {
        log('Found composer trigger. Clicking to open dialog...');
        trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        trigger.click();
      } else {
        logError('Composer trigger not found on page!');
      }

      log('Waiting for composer editor to load inside dialog...');
      const editor = await waitForEditor();
      if (editor) {
        log('Composer editor loaded inside dialog. Inserting caption...');
        if (insertCaption(editor, caption)) {
          if (Array.isArray(images) && images.length > 0) {
            const dialog = editor.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
            log('Uploading images to newly opened composer dialog container:', dialog);
            await uploadPostImages(dialog, images);
          }
          return true;
        }
      }
      logError('Failed to find or paste to composer editor in this attempt.');
      await sleep(700);
    }

    logError('Failed to open composer and paste after 4 attempts.');
    return false;
  }

  async function clearStoredCommand(requestId) {
    try {
      const data = await chrome.storage.local.get(STORE_KEY);
      if (data[STORE_KEY]?.requestId === requestId) {
        log('Clearing handled command from storage:', requestId);
        await chrome.storage.local.remove(STORE_KEY);
      }
    } catch (err) {
      logError('Storage cleanup failed:', err);
    }
  }

  let activeRequestId = '';
  let isCommandProcessing = false;

  async function handleCommand(command) {
    if (!isValidCommand(command)) return;
    if (isCommandProcessing) {
      log('Another command is already processing. Skipping concurrent call.');
      return;
    }
    if (processedRequests.has(command.requestId) || activeRequestId === command.requestId) return;
    
    isCommandProcessing = true;
    activeRequestId = command.requestId;
    try {
      // Check persistent storage to avoid duplicate processing across tabs/reloads
      const alreadyProcessed = await isRequestProcessed(command.requestId);
      if (alreadyProcessed) {
        log(`Command ${command.requestId} was already successfully processed. Skipping duplicate call.`);
        processedRequests.add(command.requestId); // Add to memory cache
        return;
      }

      if (!isFreshCommand(command)) {
        log(`Ignoring command ${command.requestId} because it is too old`);
        return;
      }
      
      if (!isCurrentGroup(command.groupUrl)) {
        log(`Ignoring command ${command.requestId} because groupUrl mismatch. Current: ${window.location.href}, target: ${command.groupUrl}`);
        return;
      }

      log(`Handling command: ${command.requestId}. Group: ${command.groupUrl}`);
      const pasted = await openComposerAndPaste(command.caption, command.images);
      if (pasted) {
        log(`Command ${command.requestId} handled successfully. Saving processed state and clearing...`);
        rememberProcessedRequest(command.requestId);
        await markRequestProcessed(command.requestId);
        await clearStoredCommand(command.requestId);
      } else {
        logError(`Command ${command.requestId} failed to paste.`);
      }
    } catch (err) {
      logError(`Exception in handleCommand for ${command.requestId}:`, err);
    } finally {
      activeRequestId = '';
      isCommandProcessing = false;
    }
  }

  async function checkStoredCommand() {
    try {
      const data = await chrome.storage.local.get(STORE_KEY);
      if (data[STORE_KEY]) {
        await handleCommand(data[STORE_KEY]);
      }
    } catch (err) {
      // Extension storage can be temporarily unavailable while Facebook navigates.
    }
  }

  window.addEventListener('message', (event) => {
    if (isValidCommand(event.data)) {
      log('Received command from window message:', event.data.requestId);
      void handleCommand(event.data);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORE_KEY]?.newValue) {
      log('Received command from storage change:', changes[STORE_KEY].newValue.requestId);
      void handleCommand(changes[STORE_KEY].newValue);
    }
  });

  // ---------------------
  // DOM Utilities
  // ---------------------
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

  function exactTextMatch(value, options) {
    const normalized = normalizeText(value);
    return options.some(option => normalized === normalizeText(option));
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

  // ---------------------
  // Image Uploading Helpers
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
        if (hasAnyText(combined, ['รูปภาพ/วิดีโอ', 'รูปภาพ', 'วิดีโอ', 'photo/video', 'photo', 'video', 'media', 'สื่อ', 'ภาพ', 'image'])) score += 100;
        if (clickable.querySelector('svg') || el.querySelector('svg')) score += 10;

        return score > 0 ? { el: clickable, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
  }

  async function getFileInput(container) {
    let input = container.querySelector('input[type="file"]');
    if (input) {
      log('Found existing file input element');
      return input;
    }

    log('File input not found immediately. Searching for Photo/Video toggle button...');
    const photoVideoBtn = findPhotoVideoButton(container);
    if (photoVideoBtn) {
      log('Photo/Video toggle button found. Clicking to reveal file input...');
      simulateClick(photoVideoBtn);
      
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        await sleep(250);
        input = container.querySelector('input[type="file"]');
        if (input) {
          log('File input element successfully loaded after toggle click!');
          return input;
        }
      }
      logError('File input did not appear after 3 seconds of waiting.');
    } else {
      logError('Photo/Video toggle button not found in composer dialog.');
    }
    return null;
  }

  async function uploadPostImages(dialog, images) {
    log(`Starting image upload process for ${images.length} images...`);
    try {
      if (!dialog) {
        logError('Post composer dialog not found for uploading images');
        return;
      }

      const fileInput = await getFileInput(dialog);
      if (!fileInput) {
        logError('File input element not found, cannot upload images');
        return;
      }

      log('Sorting images by filename...');
      const sortedImages = [...images].sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
      });

      const dataTransfer = new DataTransfer();
      for (let i = 0; i < sortedImages.length; i++) {
        const img = sortedImages[i];
        log(`Preparing image: ${img.name || `image_${i}.png`}`);
        const file = base64ToFile(img.data, img.name || `image_${i}.png`);
        dataTransfer.items.add(file);
      }

      log('Assigning files to input...');
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));

      const waitTime = Math.min(2000 + sortedImages.length * 1000, 8000);
      log(`Images dispatched. Sleeping for ${waitTime}ms to let Facebook process uploads...`);
      await sleep(waitTime);
      log('Images upload flow complete.');
    } catch (err) {
      logError('Failed to upload images:', err);
    }
  }

  void checkStoredCommand();
  window.setInterval(checkStoredCommand, 1500);
})();
