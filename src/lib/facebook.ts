// =====================================================
// FACEBOOK UTILITIES — Safe, Manual-only helpers
// =====================================================

let rememberedFbTab: Window | null = null;

const DEFAULT_FB_SHARE_TAB_NAME = 'pgsc_fb_share_tab';
const SHARE_COMMAND_SOURCE = 'PGSC_SHARE_COMMAND';
const HELPER_COMMAND_TYPE = 'QUEUE_CAPTION';
const HELPER_PASTE_TYPE = 'PASTE_CAPTION';
const HELPER_ACK_TYPE = 'HELPER_ACK';
const HELPER_READY_TYPE = 'HELPER_READY';
const HELPER_PING_TYPE = 'PING_HELPER';
const HELPER_ACK_TIMEOUT_MS = 350;
const HELPER_AVAILABLE_STORAGE_KEY = 'pgsc_fb_helper_available_until';
const HELPER_AVAILABLE_TTL_MS = 5 * 60 * 1000;
const GROUP_ID_PATTERN = /(?:facebook\.com)?\/groups\/([a-zA-Z0-9._-]+)/i;
const GROUP_URL_PATTERN = /(?:https?:\/\/(?:www\.)?facebook\.com)?\/groups\/([a-zA-Z0-9._-]+)/i;
const MEMBER_COUNT_PATTERN = /(?:สมาชิก|members?)\s*([^\n]+)/i;

interface ImportedGroupLike {
  name?: unknown;
  url?: unknown;
  memberCount?: unknown;
}

interface FacebookHelperCommand {
  source: typeof SHARE_COMMAND_SOURCE;
  type: typeof HELPER_COMMAND_TYPE | typeof HELPER_PASTE_TYPE;
  requestId: string;
  groupUrl: string;
  caption: string;
  createdAt: number;
  openMode: 'helper' | 'already-opened';
}

interface FacebookHelperAck {
  source: typeof SHARE_COMMAND_SOURCE;
  type: typeof HELPER_ACK_TYPE;
  requestId: string;
  handled: boolean;
}

interface FacebookHelperReady {
  source: typeof SHARE_COMMAND_SOURCE;
  type: typeof HELPER_READY_TYPE;
}

function markFacebookHelperAvailable(): void {
  try {
    sessionStorage.setItem(HELPER_AVAILABLE_STORAGE_KEY, String(Date.now() + HELPER_AVAILABLE_TTL_MS));
  } catch {
    // Session storage can be unavailable in restricted browser modes.
  }
}

function isFacebookHelperAvailable(): boolean {
  try {
    return Number(sessionStorage.getItem(HELPER_AVAILABLE_STORAGE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function isFacebookHelperReady(data: unknown): data is FacebookHelperReady {
  if (!data || typeof data !== 'object') return false;
  const ready = data as Partial<FacebookHelperReady>;
  return ready.source === SHARE_COMMAND_SOURCE && ready.type === HELPER_READY_TYPE;
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (isFacebookHelperReady(event.data)) markFacebookHelperAvailable();
  });

  window.setTimeout(() => {
    window.postMessage(
      {
        source: SHARE_COMMAND_SOURCE,
        type: HELPER_PING_TYPE,
        requestId: `pgsc_probe_${Date.now()}`,
      },
      window.location.origin
    );
  }, 0);
}

function extractMemberCount(text: string): string {
  const match = text.match(MEMBER_COUNT_PATTERN);
  if (!match) return '';
  const line = match[0].split('\n')[0].trim();
  return /\d/.test(line) ? line : '';
}

function isImportedGroupLike(item: unknown): item is ImportedGroupLike {
  return typeof item === 'object' && item !== null && 'url' in item;
}

/**
 * Build a Facebook Group Search URL for a given keyword.
 * Opens in new tab — does NOT auto-interact with Facebook.
 */
export function buildFbGroupSearchUrl(keyword: string): string {
  const encoded = encodeURIComponent(keyword.trim());
  return `https://www.facebook.com/search/groups/?q=${encoded}`;
}

/**
 * Normalize a Facebook group URL to ensure it is in desktop format (www.facebook.com),
 * uses HTTPS, and has a trailing slash.
 */
export function normalizeFbGroupUrl(url: string): string {
  let cleaned = url.trim();
  
  // Replace mobile subdomains (m.facebook.com, mobile.facebook.com, touch.facebook.com)
  cleaned = cleaned.replace(/https?:\/\/(?:m|mobile|touch|web)\.facebook\.com/i, 'https://www.facebook.com');
  
  // Ensure protocol
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  
  // Ensure www.
  if (cleaned.startsWith('https://facebook.com')) {
    cleaned = cleaned.replace('https://facebook.com', 'https://www.facebook.com');
  } else if (cleaned.startsWith('http://facebook.com')) {
    cleaned = cleaned.replace('http://facebook.com', 'https://www.facebook.com');
  }
  
  // Remove query parameters
  const qIdx = cleaned.indexOf('?');
  if (qIdx !== -1) {
    cleaned = cleaned.substring(0, qIdx);
  }
  const hIdx = cleaned.indexOf('#');
  if (hIdx !== -1) {
    cleaned = cleaned.substring(0, hIdx);
  }
  
  // Ensure trailing slash
  if (!cleaned.endsWith('/')) {
    cleaned = cleaned + '/';
  }
  
  return cleaned;
}

/**
 * Open a URL in a browser tab (manual navigation only).
 * Reuses the same tab by using a target name ('fb_share_tab') by default.
 */
export function openInNewTab(url: string, targetName: string = 'fb_share_tab'): void {
  openInReusableTab(url, targetName);
}

/**
 * Open a URL in the same remembered browser tab every time.
 * This keeps a WindowProxy when possible and also uses a stable target name,
 * so later clicks navigate the existing Facebook tab instead of spawning more tabs.
 */
export function openInReusableTab(url: string, targetName: string = DEFAULT_FB_SHARE_TAB_NAME): Window | null {
  const normalized = isFbGroupUrl(url) ? normalizeFbGroupUrl(url) : url;

  try {
    if (rememberedFbTab && !rememberedFbTab.closed) {
      rememberedFbTab.location.href = normalized;
      rememberedFbTab.focus();
      return rememberedFbTab;
    }
  } catch {
    rememberedFbTab = null;
  }

  rememberedFbTab = window.open(normalized, targetName);
  rememberedFbTab?.focus();
  return rememberedFbTab;
}

function buildFacebookHelperCommand(
  caption: string,
  groupUrl: string,
  openMode: FacebookHelperCommand['openMode']
): FacebookHelperCommand {
  const normalizedGroupUrl = isFbGroupUrl(groupUrl) ? normalizeFbGroupUrl(groupUrl) : groupUrl;
  const requestId = `pgsc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    source: SHARE_COMMAND_SOURCE,
    type: HELPER_COMMAND_TYPE,
    requestId,
    groupUrl: normalizedGroupUrl,
    caption,
    createdAt: Date.now(),
    openMode,
  };
}

function pingRememberedFacebookTab(command: FacebookHelperCommand): void {
  try {
    if (!rememberedFbTab || rememberedFbTab.closed) return;
  } catch {
    return;
  }

  let targetOrigin = '';
  try {
    targetOrigin = new URL(command.groupUrl).origin;
  } catch {
    return;
  }
  const payload: FacebookHelperCommand = {
    ...command,
    type: HELPER_PASTE_TYPE,
  };

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      rememberedFbTab?.postMessage(payload, targetOrigin);
    } catch {
      window.clearInterval(timer);
      return;
    }
    if (attempts >= 18) window.clearInterval(timer);
  }, 700);
}

function isFacebookHelperAck(data: unknown, requestId: string): data is FacebookHelperAck {
  if (!data || typeof data !== 'object') return false;
  const ack = data as Partial<FacebookHelperAck>;

  return (
    ack.source === SHARE_COMMAND_SOURCE &&
    ack.type === HELPER_ACK_TYPE &&
    ack.requestId === requestId &&
    typeof ack.handled === 'boolean'
  );
}

function queueCaptionCommand(command: FacebookHelperCommand): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;

    const finish = (handled: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', handleAck);
      resolve(handled);
    };

    const handleAck = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (isFacebookHelperAck(event.data, command.requestId)) {
        if (event.data.handled) markFacebookHelperAvailable();
        finish(event.data.handled);
      }
    };

    timer = window.setTimeout(() => finish(false), HELPER_ACK_TIMEOUT_MS);
    window.addEventListener('message', handleAck);
    window.postMessage(command, window.location.origin);
  });
}

/**
 * Open the group and queue a caption for the optional PGSC Facebook Helper extension.
 * When the helper is installed it reuses a real browser tab id. Without the helper,
 * the app falls back to a named Window target and clipboard copy.
 */
export async function openGroupAndSendCaptionToHelper(
  caption: string,
  groupUrl: string,
  targetName: string = DEFAULT_FB_SHARE_TAB_NAME
): Promise<{ opened: boolean; openedByHelper: boolean }> {
  const helperReady = isFacebookHelperAvailable();
  const command = buildFacebookHelperCommand(caption, groupUrl, helperReady ? 'helper' : 'already-opened');
  let openedByWindow = false;

  if (!helperReady) {
    const tab = openInReusableTab(groupUrl, targetName);
    openedByWindow = Boolean(tab);
    if (tab) pingRememberedFacebookTab(command);
  }

  const openedByHelper = await queueCaptionCommand(command);

  if (helperReady && openedByHelper) {
    return { opened: true, openedByHelper: true };
  }

  if (!helperReady) {
    return { opened: openedByWindow || openedByHelper, openedByHelper: false };
  }

  const tab = openInReusableTab(groupUrl, targetName);
  if (tab) pingRememberedFacebookTab(command);

  return { opened: Boolean(tab), openedByHelper: false };
}

/**
 * Validate that a string looks like a Facebook Group URL.
 */
export function isFbGroupUrl(url: string): boolean {
  return /facebook\.com\/(groups\/[^/]+|g\/[^/]+)/i.test(url);
}

/**
 * Parse Facebook groups from rich-text HTML string.
 */
export function parseFbGroupsFromHtml(html: string): Array<{ name: string; url: string; memberCount?: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  const groups: Array<{ name: string; url: string; memberCount?: string }> = [];
  const seen = new Set<string>();

  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const match = href.match(GROUP_ID_PATTERN);
    if (match) {
      const groupId = match[1];
      if (['feed', 'search', 'discover', 'joins', 'create', 'categories'].includes(groupId.toLowerCase())) {
        return;
      }
      const url = `https://www.facebook.com/groups/${groupId}/`;
      if (!seen.has(url)) {
        seen.add(url);
        let name = a.innerText.trim();
        if (!name) {
          const span = a.querySelector('span');
          if (span) name = span.innerText.trim();
        }
        if (!name) {
          name = a.getAttribute('title')?.trim() || '';
        }
        name = name.split('\n')[0].trim();
        
        if (name && name !== 'Groups' && name.length > 1) {
          let memberCount = '';
          let parent = a.parentElement;
          for (let i = 0; i < 3 && parent; i++) {
            const text = parent.innerText || '';
            const count = extractMemberCount(text);
            if (count) {
              memberCount = count;
              break;
            }
            parent = parent.parentElement;
          }

          groups.push({ name, url, memberCount });
        }
      }
    }
  });

  return groups;
}

/**
 * Parse Facebook groups from plain text (or JSON).
 */
export function parseFbGroupsFromText(text: string): Array<{ name: string; url: string; memberCount?: string }> {
  // Try parsing as JSON first (useful for bookmarklet export)
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const groups: Array<{ name: string; url: string; memberCount?: string }> = [];
        const seen = new Set<string>();
        parsed.forEach((item: unknown) => {
          if (isImportedGroupLike(item) && typeof item.url === 'string' && isFbGroupUrl(item.url)) {
            const url = item.url.endsWith('/') ? item.url : `${item.url}/`;
            if (!seen.has(url)) {
              seen.add(url);
              groups.push({
                name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `กลุ่มนำเข้า #${Date.now()}`,
                url,
                memberCount: typeof item.memberCount === 'string' ? item.memberCount : ''
              });
            }
          }
        });
        if (groups.length > 0) return groups;
      }
    }
  } catch {
    // Fall back to line parsing
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const groups: Array<{ name: string; url: string; memberCount?: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(GROUP_URL_PATTERN);
    if (match) {
      const groupId = match[1];
      if (['feed', 'search', 'discover', 'joins', 'create', 'categories'].includes(groupId.toLowerCase())) {
        continue;
      }
      const url = `https://www.facebook.com/groups/${groupId}/`;
      if (!seen.has(url)) {
        seen.add(url);
        let name = '';
        if (i > 0) {
          const prevLine = lines[i - 1];
          if (!prevLine.includes('facebook.com') && !prevLine.includes('/groups/') && prevLine.length > 2) {
            name = prevLine;
          }
        }
        if (!name) {
          name = `กลุ่มนำเข้า #${groupId}`;
        }
        
        let memberCount = '';
        const range = [i - 2, i - 1, i + 1, i + 2];
        for (const idx of range) {
          if (idx >= 0 && idx < lines.length) {
            const l = lines[idx];
            const count = extractMemberCount(l);
            if (count) {
              memberCount = count;
              break;
            }
            if (l.includes('คน') || l.toLowerCase().includes('members')) {
              if (l.length < 50 && !l.includes('facebook.com') && !l.includes('/groups/')) {
                memberCount = l.trim();
                break;
              }
            }
          }
        }
        
        groups.push({ name, url, memberCount });
      }
    }
  }

  return groups;
}

/**
 * Guess the category of a Facebook group based on its name.
 */
export function guessCategoryByName(name: string): string {
  const n = name.toLowerCase();
  
  if (n.includes('บอล') || n.includes('ฟุตบอล') || n.includes('football') || n.includes('soccer') || n.includes('พรีเมียร์')) {
    return 'ฟุตบอล';
  }
  if (n.includes('บาส') || n.includes('บาสเกตบอล') || n.includes('basketball') || n.includes('nba')) {
    return 'บาสเกตบอล';
  }
  if (n.includes('กีฬา') || n.includes('sport') || n.includes('วิ่ง') || n.includes('ปั่น') || n.includes('ออกกำลังกาย') || n.includes('ยิม') || n.includes('ฟิตเนส')) {
    return 'กีฬา';
  }
  if (n.includes('กล้อง') || n.includes('ถ่ายภาพ') || n.includes('ช่างภาพ') || n.includes('photo') || n.includes('lens') || n.includes('camera') || n.includes('ฟิล์ม') || n.includes('ตากล้อง')) {
    return 'ช่างภาพ';
  }
  if (n.includes('ไลฟ์') || n.includes('สด') || n.includes('live') || n.includes('สตรีม') || n.includes('stream') || n.includes('obs')) {
    return 'ไลฟ์สด';
  }
  if (n.includes('ดนตรี') || n.includes('เพลง') || n.includes('music') || n.includes('ร้องเพลง') || n.includes('กีตาร์') || n.includes('guitar')) {
    return 'ดนตรี';
  }
  if (n.includes('อาหาร') || n.includes('กิน') || n.includes('อร่อย') || n.includes('food') || n.includes('cooking') || n.includes('เมนู') || n.includes('คาเฟ่') || n.includes('สูตรอาหาร')) {
    return 'อาหาร';
  }
  if (n.includes('เที่ยว') || n.includes('ท่องเที่ยว') || n.includes('เดินทาง') || n.includes('travel') || n.includes('trip') || n.includes('รีสอร์ท') || n.includes('โรงแรม') || n.includes('แคมป์')) {
    return 'ท่องเที่ยว';
  }
  if (n.includes('เทคโนโลยี') || n.includes('คอม') || n.includes('ไอที') || n.includes('it') || n.includes('tech') || n.includes('programming') || n.includes('เขียนโปรแกรม') || n.includes('software') || n.includes('ai') || n.includes('chatgpt')) {
    return 'เทคโนโลยี';
  }
  if (n.includes('ธุรกิจ') || n.includes('ลงทุน') || n.includes('ขาย') || n.includes('ซื้อ') || n.includes('ตลาด') || n.includes('trade') || n.includes('business') || n.includes('marketing') || n.includes('มือสอง') || n.includes('shop') || n.includes('หารายได้')) {
    return 'ธุรกิจ';
  }
  if (n.includes('เรียน') || n.includes('ศึกษา') || n.includes('สอน') || n.includes('ความรู้') || n.includes('อบรม') || n.includes('course') || n.includes('english') || n.includes('ภาษา') || n.includes('นักเรียน')) {
    return 'การศึกษา';
  }
  if (n.includes('อีเวนต์') || n.includes('event') || n.includes('สัมมนา') || n.includes('คอนเสิร์ต') || n.includes('จัดงาน') || n.includes('นิทรรศการ')) {
    return 'อีเวนต์';
  }
  if (n.includes('ชุมชน') || n.includes('กลุ่ม') || n.includes('สมาคม') || n.includes('คนรัก') || n.includes('club') || n.includes('society') || n.includes('บ้าน') || n.includes('คอนโด') || n.includes('หมู่บ้าน')) {
    return 'ชุมชน';
  }
  
  return 'อื่นๆ';
}

/**
 * Generate a realistic approximate member count based on name hash or random numbers.
 */
export function guessMemberCount(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash);
  
  const rand = positiveHash % 100;
  if (rand < 70) {
    const k = (positiveHash % 80) + 10;
    return `ประมาณ ${k},000 คน`;
  } else if (rand < 95) {
    const k = (positiveHash % 40) + 10;
    return `ประมาณ ${k * 10},000 คน`;
  } else {
    const m = (positiveHash % 5) + 1;
    return `ประมาณ ${m}.5 แสนคน`;
  }
}
