import type {
  AppSettings,
  AutomationSettings,
  Campaign,
  CaptionPost,
  Group,
  Lead,
  ShareQueueItem,
} from '../types';
import { daysSince } from './date';
import { createId } from './ids';

export interface SmartQueueSkip {
  group: Group;
  reason: string;
}

export interface SmartQueuePlan {
  eligibleGroups: Group[];
  skipped: SmartQueueSkip[];
}

export interface AutomationReminder {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export const BACKUP_MARKER_KEY = 'pgsc_last_backup_at';

const QUALITY_SCORE: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
const DONE_STATUSES = new Set(['posted', 'approved', 'completed', 'skipped', 'failed', 'rejected', 'deleted', 'lead_received']);

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  smartQueueEnabled: true,
  skipBlacklisted: true,
  skipCooldown: true,
  skipNoLinkGroups: true,
  remindersEnabled: true,
  browserNotificationsEnabled: false,
  approvalReminderHours: 24,
  leadFollowUpDays: 2,
  backupReminderDays: 7,
  syncWebhookUrl: '',
};

function queuePriority(group: Group): number {
  const quality = QUALITY_SCORE[group.qualityScore] ?? 0;
  const adminPenalty = group.requiresAdminApproval ? 4 : 0;
  const noLinkPenalty = group.allowLinks ? 0 : 8;
  const cooldownAge = Math.min(daysSince(group.lastPostedAt), 60) / 10;
  return quality * 10 + cooldownAge - adminPenalty - noLinkPenalty;
}

function hasActiveDuplicate(existingQueue: ShareQueueItem[], campaignId: string, groupId: string): boolean {
  return existingQueue.some(
    (item) => item.campaignId === campaignId && item.groupId === groupId && !DONE_STATUSES.has(item.status)
  );
}

export function planSmartQueue(args: {
  campaignId: string;
  selectedGroupIds: string[];
  groups: Group[];
  existingQueue: ShareQueueItem[];
  post?: CaptionPost;
  settings?: Partial<AutomationSettings>;
}): SmartQueuePlan {
  const settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...args.settings };
  const selected = new Set(args.selectedGroupIds);
  const skipped: SmartQueueSkip[] = [];
  const eligible: Group[] = [];

  args.groups
    .filter((group) => selected.has(group.id))
    .forEach((group) => {
      if (settings.smartQueueEnabled && hasActiveDuplicate(args.existingQueue, args.campaignId, group.id)) {
        skipped.push({ group, reason: 'มีคิวที่ยังไม่จบในแคมเปญนี้อยู่แล้ว' });
        return;
      }
      if (settings.smartQueueEnabled && settings.skipBlacklisted && group.isBlacklisted) {
        skipped.push({ group, reason: 'อยู่ใน blacklist' });
        return;
      }
      if (settings.smartQueueEnabled && settings.skipCooldown && daysSince(group.lastPostedAt) < group.cooldownDays) {
        skipped.push({ group, reason: `ยังอยู่ใน cooldown อีก ${group.cooldownDays - daysSince(group.lastPostedAt)} วัน` });
        return;
      }
      if (settings.smartQueueEnabled && settings.skipNoLinkGroups && args.post?.link && !group.allowLinks) {
        skipped.push({ group, reason: 'กลุ่มนี้ห้ามแนบลิงก์' });
        return;
      }
      eligible.push(group);
    });

  return {
    eligibleGroups: eligible.sort((a, b) => queuePriority(b) - queuePriority(a)),
    skipped,
  };
}

export function createQueueItemsFromPlan(args: {
  plan: SmartQueuePlan;
  campaignId: string;
  postId: string;
  scheduledAt: string | null;
  now: string;
}): ShareQueueItem[] {
  return args.plan.eligibleGroups.map((group) => ({
    id: createId('qi'),
    campaignId: args.campaignId,
    postId: args.postId,
    groupId: group.id,
    scheduledAt: args.scheduledAt,
    status: 'not_started',
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    note: '',
    createdAt: args.now,
    updatedAt: args.now,
  }));
}

export function summarizeSkipped(skipped: SmartQueueSkip[]): string {
  if (skipped.length === 0) return '';
  const firstItems = skipped.slice(0, 3).map((item) => `${item.group.name}: ${item.reason}`);
  const more = skipped.length > firstItems.length ? ` และอีก ${skipped.length - firstItems.length} กลุ่ม` : '';
  return `${firstItems.join(', ')}${more}`;
}

export function buildGroupAwareCaption(post: CaptionPost, group?: Group): string {
  const parts = [post.title.trim(), post.caption.trim()].filter(Boolean);

  if (!group || group.allowLinks) {
    if (post.link.trim()) parts.push(post.link.trim());
  } else if (post.link.trim()) {
    parts.push('ลิงก์อยู่ในคอมเมนต์แรกหรือติดต่อทีมงานเพื่อรับลิงก์');
  }

  if (group?.requiresAdminApproval) {
    parts.push('ฝากแอดมินพิจารณาอนุมัติโพสต์นี้ด้วยครับ');
  }

  if (post.hashtags.trim()) parts.push(post.hashtags.trim());
  return parts.join('\n\n');
}

function formatGroupList(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown} และอีก ${names.length - max} รายการ` : shown;
}

export function collectAutomationReminders(args: {
  queue: ShareQueueItem[];
  groups: Group[];
  campaigns: Campaign[];
  leads: Lead[];
  settings: AppSettings;
  lastBackupAt?: string | null;
  now?: Date;
}): AutomationReminder[] {
  if (!args.settings.automation.remindersEnabled) return [];

  const now = args.now ?? new Date();
  const groupMap = new Map(args.groups.map((group) => [group.id, group]));
  const campaignMap = new Map(args.campaigns.map((campaign) => [campaign.id, campaign]));
  const reminders: AutomationReminder[] = [];

  const dueToday = args.queue.filter((item) => {
    if (item.status !== 'not_started' || !item.scheduledAt) return false;
    const date = new Date(item.scheduledAt);
    return date.toDateString() === now.toDateString();
  });
  if (dueToday.length > 0) {
    reminders.push({
      id: 'due_today',
      title: `มีคิวแชร์วันนี้ ${dueToday.length} รายการ`,
      message: formatGroupList(dueToday.map((item) => groupMap.get(item.groupId)?.name || item.groupId)),
      severity: 'info',
    });
  }

  const overdue = args.queue.filter((item) => (
    item.status === 'not_started' && item.scheduledAt && new Date(item.scheduledAt).getTime() < now.getTime()
  ));
  if (overdue.length > 0) {
    reminders.push({
      id: 'overdue',
      title: `คิวเกินกำหนด ${overdue.length} รายการ`,
      message: formatGroupList(overdue.map((item) => groupMap.get(item.groupId)?.name || item.groupId)),
      severity: 'warning',
    });
  }

  const approvalMs = args.settings.automation.approvalReminderHours * 60 * 60 * 1000;
  const stalePending = args.queue.filter((item) => (
    item.status === 'pending_admin' &&
    item.submittedAt &&
    now.getTime() - new Date(item.submittedAt).getTime() >= approvalMs
  ));
  if (stalePending.length > 0) {
    reminders.push({
      id: 'pending_approval_sla',
      title: `ควรติดตามผลอนุมัติ ${stalePending.length} รายการ`,
      message: formatGroupList(stalePending.map((item) => {
        const groupName = groupMap.get(item.groupId)?.name || item.groupId;
        const campaignName = campaignMap.get(item.campaignId)?.name;
        return campaignName ? `${groupName} (${campaignName})` : groupName;
      })),
      severity: 'warning',
    });
  }

  const leadMs = args.settings.automation.leadFollowUpDays * 24 * 60 * 60 * 1000;
  const staleLeads = args.leads.filter((lead) => (
    (lead.status === 'new' || lead.status === 'contacted') &&
    now.getTime() - new Date(lead.createdAt).getTime() >= leadMs
  ));
  if (staleLeads.length > 0) {
    reminders.push({
      id: 'lead_follow_up',
      title: `มี lead ที่ควร follow-up ${staleLeads.length} รายการ`,
      message: formatGroupList(staleLeads.map((lead) => lead.customerName || groupMap.get(lead.groupId)?.name || lead.groupId)),
      severity: 'info',
    });
  }

  const backupMs = args.settings.automation.backupReminderDays * 24 * 60 * 60 * 1000;
  const lastBackupTime = args.lastBackupAt ? new Date(args.lastBackupAt).getTime() : 0;
  if (!lastBackupTime || now.getTime() - lastBackupTime >= backupMs) {
    reminders.push({
      id: 'backup_due',
      title: 'ถึงเวลาสำรองข้อมูล',
      message: 'Export JSON หรือ Sync Now เพื่อกันข้อมูล localStorage หาย',
      severity: 'info',
    });
  }

  return reminders;
}

export function reminderRunKey(date = new Date()): string {
  return `pgsc_automation_reminders_${date.toISOString().slice(0, 10)}`;
}
