import type {
  Group,
  CaptionPost,
  Campaign,
  ShareQueueItem,
  NotificationItem,
  Lead,
  AppSettings,
} from '../types';

// =====================================================
// STORAGE KEYS
// =====================================================
const KEYS = {
  groups: 'pgsc_groups',
  posts: 'pgsc_posts',
  campaigns: 'pgsc_campaigns',
  queue: 'pgsc_queue',
  notifications: 'pgsc_notifications',
  leads: 'pgsc_leads',
  settings: 'pgsc_settings',
};

// =====================================================
// GENERIC HELPERS
// =====================================================
function getItem<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function setItem<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function getObjectItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setObjectItem<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// =====================================================
// GROUPS
// =====================================================
export const groupStorage = {
  getAll: (): Group[] => getItem<Group>(KEYS.groups),
  save: (groups: Group[]): void => setItem(KEYS.groups, groups),
  add: (group: Group): void => {
    const groups = groupStorage.getAll();
    groups.push(group);
    groupStorage.save(groups);
  },
  update: (group: Group): void => {
    const groups = groupStorage.getAll().map((g) => (g.id === group.id ? group : g));
    groupStorage.save(groups);
  },
  delete: (id: string): void => {
    const groups = groupStorage.getAll().filter((g) => g.id !== id);
    groupStorage.save(groups);
  },
  findByUrl: (url: string): Group | undefined => {
    return groupStorage.getAll().find((g) => g.url.trim().toLowerCase() === url.trim().toLowerCase());
  },
};

// =====================================================
// CAPTION POSTS
// =====================================================
export const postStorage = {
  getAll: (): CaptionPost[] => getItem<CaptionPost>(KEYS.posts),
  save: (posts: CaptionPost[]): void => setItem(KEYS.posts, posts),
  add: (post: CaptionPost): void => {
    const posts = postStorage.getAll();
    posts.push(post);
    postStorage.save(posts);
  },
  update: (post: CaptionPost): void => {
    const posts = postStorage.getAll().map((p) => (p.id === post.id ? post : p));
    postStorage.save(posts);
  },
  delete: (id: string): void => {
    const posts = postStorage.getAll().filter((p) => p.id !== id);
    postStorage.save(posts);
  },
  getById: (id: string): CaptionPost | undefined => {
    return postStorage.getAll().find((p) => p.id === id);
  },
};

// =====================================================
// CAMPAIGNS
// =====================================================
export const campaignStorage = {
  getAll: (): Campaign[] => getItem<Campaign>(KEYS.campaigns),
  save: (campaigns: Campaign[]): void => setItem(KEYS.campaigns, campaigns),
  add: (campaign: Campaign): void => {
    const campaigns = campaignStorage.getAll();
    campaigns.push(campaign);
    campaignStorage.save(campaigns);
  },
  update: (campaign: Campaign): void => {
    const campaigns = campaignStorage.getAll().map((c) => (c.id === campaign.id ? campaign : c));
    campaignStorage.save(campaigns);
  },
  delete: (id: string): void => {
    const campaigns = campaignStorage.getAll().filter((c) => c.id !== id);
    campaignStorage.save(campaigns);
  },
  getById: (id: string): Campaign | undefined => {
    return campaignStorage.getAll().find((c) => c.id === id);
  },
};

// =====================================================
// SHARE QUEUE
// =====================================================
export const queueStorage = {
  getAll: (): ShareQueueItem[] => getItem<ShareQueueItem>(KEYS.queue),
  save: (items: ShareQueueItem[]): void => setItem(KEYS.queue, items),
  add: (item: ShareQueueItem): void => {
    const items = queueStorage.getAll();
    items.push(item);
    queueStorage.save(items);
  },
  addMany: (newItems: ShareQueueItem[]): void => {
    const items = queueStorage.getAll();
    items.push(...newItems);
    queueStorage.save(items);
  },
  update: (item: ShareQueueItem): void => {
    const items = queueStorage.getAll().map((q) => (q.id === item.id ? item : q));
    queueStorage.save(items);
  },
  delete: (id: string): void => {
    const items = queueStorage.getAll().filter((q) => q.id !== id);
    queueStorage.save(items);
  },
  deleteByCampaign: (campaignId: string): void => {
    const items = queueStorage.getAll().filter((q) => q.campaignId !== campaignId);
    queueStorage.save(items);
  },
  getByCampaign: (campaignId: string): ShareQueueItem[] => {
    return queueStorage.getAll().filter((q) => q.campaignId === campaignId);
  },
};

// =====================================================
// NOTIFICATIONS
// =====================================================
export const notificationStorage = {
  getAll: (): NotificationItem[] => getItem<NotificationItem>(KEYS.notifications),
  save: (items: NotificationItem[]): void => setItem(KEYS.notifications, items),
  add: (item: NotificationItem): void => {
    const items = notificationStorage.getAll();
    items.unshift(item); // newest first
    // keep max 50
    if (items.length > 50) items.pop();
    notificationStorage.save(items);
  },
  markRead: (id: string): void => {
    const items = notificationStorage.getAll().map((n) => (n.id === id ? { ...n, read: true } : n));
    notificationStorage.save(items);
  },
  markAllRead: (): void => {
    const items = notificationStorage.getAll().map((n) => ({ ...n, read: true }));
    notificationStorage.save(items);
  },
  clear: (): void => notificationStorage.save([]),
};

// =====================================================
// LEADS
// =====================================================
export const leadStorage = {
  getAll: (): Lead[] => getItem<Lead>(KEYS.leads),
  save: (leads: Lead[]): void => setItem(KEYS.leads, leads),
  add: (lead: Lead): void => {
    const leads = leadStorage.getAll();
    leads.push(lead);
    leadStorage.save(leads);
  },
  update: (lead: Lead): void => {
    const leads = leadStorage.getAll().map((l) => (l.id === lead.id ? lead : l));
    leadStorage.save(leads);
  },
};

// =====================================================
// SETTINGS
// =====================================================
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark_orange',
  categories: [
    'กีฬา', 'ฟุตบอล', 'บาสเกตบอล', 'ช่างภาพ', 'ไลฟ์สด',
    'อีเวนต์', 'ดนตรี', 'อาหาร', 'ท่องเที่ยว', 'เทคโนโลยี',
    'ธุรกิจ', 'การศึกษา', 'ชุมชน', 'อื่นๆ',
  ],
  captionTemplates: {
    professional: '🎯 {title}\n\n{caption}\n\n🔗 {link}\n\n{hashtags}',
    friendly: '👋 {title}\n\n{caption}\n\n✨ คลิกเลย! {link}\n\n{hashtags}',
    sport_event: '⚽ {title}\n\n🏆 {caption}\n\n🔥 ดูสด: {link}\n\n{hashtags}',
    photographer: '📸 {title}\n\n{caption}\n\n📞 ติดต่อ/ดูพอร์ต: {link}\n\n{hashtags}',
    local_community: '📢 {title}\n\n{caption}\n\n{link}\n\n{hashtags}',
  },
};

export const settingsStorage = {
  get: (): AppSettings => getObjectItem<AppSettings>(KEYS.settings, DEFAULT_SETTINGS),
  save: (settings: AppSettings): void => setObjectItem(KEYS.settings, settings),
};

// =====================================================
// FULL EXPORT / IMPORT
// =====================================================
export interface AppDataExport {
  version: string;
  exportedAt: string;
  groups: Group[];
  posts: CaptionPost[];
  campaigns: Campaign[];
  queue: ShareQueueItem[];
  leads: Lead[];
  settings: AppSettings;
}

export function exportAllData(): AppDataExport {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    groups: groupStorage.getAll(),
    posts: postStorage.getAll(),
    campaigns: campaignStorage.getAll(),
    queue: queueStorage.getAll(),
    leads: leadStorage.getAll(),
    settings: settingsStorage.get(),
  };
}

export function importAllData(data: AppDataExport): void {
  if (data.groups) groupStorage.save(data.groups);
  if (data.posts) postStorage.save(data.posts);
  if (data.campaigns) campaignStorage.save(data.campaigns);
  if (data.queue) queueStorage.save(data.queue);
  if (data.leads) leadStorage.save(data.leads);
  if (data.settings) settingsStorage.save(data.settings);
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
