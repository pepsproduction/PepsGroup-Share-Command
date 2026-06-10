// =====================================================================
// src/lib/extension.ts — PGSC Share Helper Extension Integration
// Utilities for communicating with the PGSC Chrome Extension
// =====================================================================

export interface ExtensionShareGroup {
  id: string;
  name: string;
  url: string;
}

export interface ExtensionSessionRequest {
  sessionId: string;
  postUrl: string;
  groups: ExtensionShareGroup[];
  caption: string;
  imageUrl?: string;
  images?: Array<{ name: string; data: string }>;
  postMode?: 'auto' | 'review';
}

export interface ExtensionShareResult {
  group: string;
  groupId: string;
  status: 'posted' | 'pending_admin' | 'failed' | 'skipped';
  reason?: string;
  timestamp: string;
}

export interface ExtensionProgress {
  currentIndex: number;
  total: number;
  group: string;
  status: 'processing' | 'done';
}

let _requestCounter = 0;

/** Send a message to the extension background via the bridge content script */
function sendToExtension<T = Record<string, unknown>>(
  message: Record<string, unknown>,
  timeoutMs = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = `pgsc_${Date.now()}_${++_requestCounter}`;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('message', handler);
        reject(new Error('Extension did not respond (timeout)'));
      }
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.data?.source !== 'PGSC_EXTENSION_BRIDGE') return;
      if (event.data?.requestId !== requestId) return;
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      resolve(event.data as T);
    }

    window.addEventListener('message', handler);
    window.postMessage({ source: 'PGSC_WEB_APP', requestId, ...message }, '*');
  });
}

/** Check if the PGSC extension is installed and active */
export function isExtensionInstalled(): boolean {
  return (window as unknown as { __PGSC_EXTENSION_INSTALLED__?: boolean }).__PGSC_EXTENSION_INSTALLED__ === true;
}

/** Ping the extension to verify it's responding */
export async function pingExtension(): Promise<boolean> {
  try {
    const res = await sendToExtension<{ ok?: boolean }>({ type: 'PGSC_CHECK_INSTALLED' }, 1500);
    return res?.ok === true;
  } catch {
    return false;
  }
}

/** Start an automated share session via the extension */
export async function startExtensionSession(
  request: ExtensionSessionRequest
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await sendToExtension<{ ok?: boolean; error?: string }>(
      { type: 'PGSC_START_SESSION', ...request },
      10000
    );
    return { ok: res?.ok === true, error: res?.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Cancel an active extension session */
export async function cancelExtensionSession(): Promise<void> {
  try {
    await sendToExtension({ type: 'PGSC_CANCEL_SESSION' }, 3000);
  } catch {
    // Ignore timeout
  }
}

/** Subscribe to real-time updates from the extension */
export function subscribeToExtensionEvents(handlers: {
  onProgress?: (data: ExtensionProgress) => void;
  onResult?: (data: ExtensionShareResult) => void;
  onDone?: (data: { results: ExtensionShareResult[] }) => void;
  onCancelled?: () => void;
}): () => void {
  function listener(event: MessageEvent) {
    if (event.data?.source !== 'PGSC_EXTENSION_BRIDGE') return;
    const { type, data } = event.data;

    switch (type) {
      case 'PGSC_PROGRESS':
        handlers.onProgress?.(data as ExtensionProgress);
        break;
      case 'PGSC_RESULT':
        handlers.onResult?.(data as ExtensionShareResult);
        break;
      case 'PGSC_SESSION_DONE':
        handlers.onDone?.(data as { results: ExtensionShareResult[] });
        break;
      case 'PGSC_SESSION_CANCELLED':
        handlers.onCancelled?.();
        break;
    }
  }

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
