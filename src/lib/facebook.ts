// =====================================================
// FACEBOOK UTILITIES — Safe, Manual-only helpers
// =====================================================

/**
 * Build a Facebook Group Search URL for a given keyword.
 * Opens in new tab — does NOT auto-interact with Facebook.
 */
export function buildFbGroupSearchUrl(keyword: string): string {
  const encoded = encodeURIComponent(keyword.trim());
  return `https://www.facebook.com/search/groups/?q=${encoded}`;
}

/**
 * Open a URL in a new browser tab (manual navigation only).
 */
export function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
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
export function parseFbGroupsFromHtml(html: string): Array<{ name: string; url: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  const groups: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();

  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const match = href.match(/(?:facebook\.com)?\/groups\/([a-zA-Z0-9\._\-]+)/i);
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
          groups.push({ name, url });
        }
      }
    }
  });

  return groups;
}

/**
 * Parse Facebook groups from plain text (or JSON).
 */
export function parseFbGroupsFromText(text: string): Array<{ name: string; url: string }> {
  // Try parsing as JSON first (useful for bookmarklet export)
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const groups: Array<{ name: string; url: string }> = [];
        const seen = new Set<string>();
        parsed.forEach((item: any) => {
          if (item && item.url && isFbGroupUrl(item.url)) {
            const url = item.url.endsWith('/') ? item.url : `${item.url}/`;
            if (!seen.has(url)) {
              seen.add(url);
              groups.push({
                name: item.name ? item.name.trim() : `กลุ่มนำเข้า #${Date.now()}`,
                url
              });
            }
          }
        });
        if (groups.length > 0) return groups;
      }
    }
  } catch (e) {
    // Fall back to line parsing
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const groups: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(?:https?:\/\/(?:www\.)?facebook\.com)?\/groups\/([a-zA-Z0-9\._\-]+)/i);
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
        groups.push({ name, url });
      }
    }
  }

  return groups;
}

