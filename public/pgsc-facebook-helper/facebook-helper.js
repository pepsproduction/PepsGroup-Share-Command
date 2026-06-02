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
    const label = normalizeText(
      [
        element.getAttribute('aria-label') || '',
        element.getAttribute('aria-placeholder') || '',
        element.getAttribute('placeholder') || '',
        element.textContent || '',
      ].join(' ')
    );
    const rect = element.getBoundingClientRect();
    const role = element.getAttribute('role') || '';
    const editable = element.getAttribute('contenteditable') === 'true';

    if (!editable && role !== 'textbox') return false;
    if (COMPOSER_TEXTS.some((text) => label.includes(text))) return true;
    return rect.width >= 220 && rect.height >= 24 && element.closest('[role="dialog"], [aria-modal="true"]');
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
    if ((editor.innerText || editor.textContent || '').includes(caption)) return true;

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

    return inserted || (editor.innerText || editor.textContent || '').includes(caption);
  }

  async function waitForEditor() {
    const deadline = Date.now() + 9000;

    while (Date.now() < deadline) {
      const editor = findPostEditor();
      if (editor) return editor;
      await sleep(350);
    }

    return null;
  }

  async function openComposerAndPaste(caption) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existingEditor = findPostEditor();
      if (existingEditor && insertCaption(existingEditor, caption)) return true;

      const trigger = findComposerTrigger();
      if (trigger) {
        trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        trigger.click();
      }

      const editor = await waitForEditor();
      if (editor && insertCaption(editor, caption)) return true;
      await sleep(700);
    }

    return false;
  }

  async function clearStoredCommand(requestId) {
    try {
      const data = await chrome.storage.local.get(STORE_KEY);
      if (data[STORE_KEY]?.requestId === requestId) {
        await chrome.storage.local.remove(STORE_KEY);
      }
    } catch {
      // Ignore storage cleanup failures.
    }
  }

  let activeRequestId = '';

  async function handleCommand(command) {
    if (!isValidCommand(command)) return;
    if (processedRequests.has(command.requestId) || activeRequestId === command.requestId) return;
    if (!isFreshCommand(command) || !isCurrentGroup(command.groupUrl)) return;

    activeRequestId = command.requestId;
    try {
      const pasted = await openComposerAndPaste(command.caption);
      if (pasted) {
        rememberProcessedRequest(command.requestId);
        await clearStoredCommand(command.requestId);
      }
    } finally {
      activeRequestId = '';
    }
  }

  async function checkStoredCommand() {
    try {
      const data = await chrome.storage.local.get(STORE_KEY);
      await handleCommand(data[STORE_KEY]);
    } catch {
      // Extension storage can be temporarily unavailable while Facebook navigates.
    }
  }

  window.addEventListener('message', (event) => {
    if (isValidCommand(event.data)) {
      void handleCommand(event.data);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORE_KEY]?.newValue) {
      void handleCommand(changes[STORE_KEY].newValue);
    }
  });

  void checkStoredCommand();
  window.setInterval(checkStoredCommand, 1500);
})();
