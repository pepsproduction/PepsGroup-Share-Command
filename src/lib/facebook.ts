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
