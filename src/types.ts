// =====================================================
// TYPE DEFINITIONS — PepsGroup Share Command
// =====================================================

export type QualityScore = 'A' | 'B' | 'C' | 'D';

export interface Group {
  id: string;
  name: string;
  url: string;
  category: string;
  keywords: string[];
  memberCountNote: string;
  requiresAdminApproval: boolean;
  approvalAvgHours: number;
  allowLinks: boolean;
  allowSalesPost: boolean;
  rulesNote: string;
  qualityScore: QualityScore;
  lastPostedAt: string | null;
  cooldownDays: number;
  isBlacklisted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaptionVariant {
  id: string;
  style: 'professional' | 'friendly' | 'sport_event' | 'photographer' | 'local_community' | 'custom';
  label: string;
  caption: string;
}

export interface CaptionImage {
  name: string;
  data: string;
}

export interface CaptionPost {
  id: string;
  title: string;
  caption: string;
  link: string;
  hashtags: string;
  note: string;
  variants: CaptionVariant[];
  imageUrl?: string;
  images?: CaptionImage[];
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sharing' | 'pending_approval' | 'completed';
export type CampaignObjective =
  | 'promote_live_sport'
  | 'photography'
  | 'event'
  | 'pepslive_web'
  | 'other';

export interface Campaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  objectiveNote: string;
  postId: string;
  selectedGroupIds: string[];
  status: CampaignStatus;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ShareItemStatus =
  | 'not_started'
  | 'opened'
  | 'posted'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'deleted'
  | 'skipped'
  | 'failed'
  | 'lead_received'
  | 'completed';

export interface ShareQueueItem {
  id: string;
  campaignId: string;
  postId: string;
  groupId: string;
  scheduledAt: string | null;
  status: ShareItemStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export type LeadStatus = 'new' | 'contacted' | 'closed_won' | 'closed_lost';

export interface Lead {
  id: string;
  campaignId: string;
  groupId: string;
  customerName: string;
  contactNote: string;
  serviceInterest: string;
  valueEstimate: string;
  status: LeadStatus;
  createdAt: string;
}

export type AppPage =
  | 'dashboard'
  | 'group_finder'
  | 'group_library'
  | 'campaign_builder'
  | 'caption_studio'
  | 'group_selector'
  | 'schedule_queue'
  | 'share_session'
  | 'pending_approval'
  | 'reports'
  | 'settings';

export type ThemeMode = 'dark_orange' | 'dark_gold' | 'high_contrast';

export interface AppSettings {
  theme: ThemeMode;
  categories: string[];
  captionTemplates: Record<string, string>;
  automation: AutomationSettings;
}

export interface AutomationSettings {
  smartQueueEnabled: boolean;
  skipBlacklisted: boolean;
  cooldownEnabled: boolean;
  skipCooldown: boolean;
  skipNoLinkGroups: boolean;
  remindersEnabled: boolean;
  browserNotificationsEnabled: boolean;
  approvalReminderHours: number;
  leadFollowUpDays: number;
  backupReminderDays: number;
  syncWebhookUrl: string;
}

// Share Session state
export interface ShareSessionState {
  campaignId: string;
  queueItems: ShareQueueItem[];
  currentIndex: number;
  isActive: boolean;
}
