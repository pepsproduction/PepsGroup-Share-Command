(() => {
  const SOURCE = 'PGSC_SHARE_COMMAND';
  const STORE_KEY = 'pgscShareCommand';
  const ACK_KEY = 'pgscShareCommandAck';
  const HELPER_ACK_TYPE = 'HELPER_ACK';
  const HELPER_READY_TYPE = 'HELPER_READY';
  const HELPER_PING_TYPE = 'PING_HELPER';
  const OPEN_GROUP_TYPE = 'OPEN_GROUP_TAB';
  const TRACK_GROUP_TYPE = 'TRACK_GROUP_TAB';

  function log(msg, ...args) {
    console.log(`%c[PGSC App Bridge] ${msg}`, 'color: #4caf50; font-weight: bold;', ...args);
  }

  function sendReady() {
    log('Sending READY handshake to App');
    window.postMessage(
      {
        source: SOURCE,
        type: HELPER_READY_TYPE,
      },
      window.location.origin
    );
  }

  function sendAck(requestId, handled) {
    log(`Sending ACK back to App. requestId: ${requestId}, handled: ${handled}`);
    window.postMessage(
      {
        source: SOURCE,
        type: HELPER_ACK_TYPE,
        requestId,
        handled,
      },
      window.location.origin
    );
  }

  function isValidCommand(data) {
    return Boolean(
      data &&
        data.source === SOURCE &&
        data.type === 'QUEUE_CAPTION' &&
        typeof data.caption === 'string' &&
        typeof data.groupUrl === 'string' &&
        data.caption.trim() &&
        data.groupUrl.trim()
    );
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.source === SOURCE && event.data.type === HELPER_PING_TYPE) {
      log('Received PING probe from App');
      sendReady();
    }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !isValidCommand(event.data)) return;

    log('Received QUEUE_CAPTION command from App. Images count:', event.data.images?.length || 0);

    const command = {
      source: SOURCE,
      type: 'PASTE_CAPTION',
      requestId: String(event.data.requestId || `pgsc_${Date.now()}`),
      groupUrl: event.data.groupUrl,
      caption: event.data.caption,
      images: event.data.images,
      createdAt: Number(event.data.createdAt || Date.now()),
      openMode: event.data.openMode === 'helper' ? 'helper' : 'already-opened',
    };

    log('Saving command to chrome.storage.local...', command.requestId);
    chrome.storage.local.set(
      {
        [STORE_KEY]: command,
        [ACK_KEY]: {
          requestId: command.requestId,
          storedAt: Date.now(),
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          log('Error writing command to storage:', chrome.runtime.lastError.message);
          sendAck(command.requestId, false);
          return;
        }

        log('Command saved to chrome.storage.local. Forwarding to background worker...');
        const shouldOpenByHelper = command.openMode === 'helper';
        chrome.runtime.sendMessage(
          {
            source: SOURCE,
            type: shouldOpenByHelper ? OPEN_GROUP_TYPE : TRACK_GROUP_TYPE,
            requestId: command.requestId,
            groupUrl: command.groupUrl,
          },
          (response) => {
            const success = Boolean(response?.ok && !chrome.runtime.lastError);
            log(`Background response success: ${success}`, response);
            sendAck(command.requestId, success);
          }
        );
      }
    );
  });

  window.setTimeout(sendReady, 0);
})();
