import type { Group, CaptionPost, Campaign, ShareQueueItem } from '../types';

// =====================================================
// SEED DATA — Sample groups for UI testing
// =====================================================

export const seedGroups: Group[] = [
  {
    id: 'grp_001',
    name: 'กลุ่มฟุตบอล 7 คน ภาคอีสาน',
    url: 'https://www.facebook.com/groups/football7isaan',
    category: 'ฟุตบอล',
    keywords: ['ฟุตบอล', '7คน', 'ภาคอีสาน', 'กีฬา'],
    memberCountNote: 'ประมาณ 15,000 คน',
    requiresAdminApproval: false,
    approvalAvgHours: 0,
    allowLinks: true,
    allowSalesPost: false,
    rulesNote: 'ห้ามโพสต์โฆษณาสินค้า อนุญาตแชร์กิจกรรมกีฬาได้',
    qualityScore: 'A',
    lastPostedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    cooldownDays: 0,
    isBlacklisted: false,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'grp_002',
    name: 'กลุ่มหาช่างภาพงานกีฬา',
    url: 'https://www.facebook.com/groups/sportphotographer.th',
    category: 'ช่างภาพ',
    keywords: ['ช่างภาพ', 'กีฬา', 'สปอร์ต', 'photography'],
    memberCountNote: 'ประมาณ 8,500 คน',
    requiresAdminApproval: true,
    approvalAvgHours: 12,
    allowLinks: true,
    allowSalesPost: true,
    rulesNote: 'ต้องรอแอดมินอนุมัติทุกโพสต์ใน 24 ชม. ควรมีตัวอย่างผลงาน',
    qualityScore: 'A',
    lastPostedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    cooldownDays: 0,
    isBlacklisted: false,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'grp_003',
    name: 'กลุ่มไลฟ์สดงานอีเวนต์ไทย',
    url: 'https://www.facebook.com/groups/liveevents.thailand',
    category: 'ไลฟ์สด',
    keywords: ['ไลฟ์สด', 'อีเวนต์', 'streaming', 'OBS'],
    memberCountNote: 'ประมาณ 32,000 คน',
    requiresAdminApproval: false,
    approvalAvgHours: 0,
    allowLinks: false,
    allowSalesPost: false,
    rulesNote: 'ห้ามแนบลิงก์ภายนอก ให้พิมพ์ข้อมูลในโพสต์เท่านั้น ห้ามสแปม',
    qualityScore: 'B',
    lastPostedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    cooldownDays: 0,
    isBlacklisted: false,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'grp_004',
    name: 'กลุ่มบาสเกตบอลสมัครเล่นไทย',
    url: 'https://www.facebook.com/groups/basketball.amateur.th',
    category: 'บาสเกตบอล',
    keywords: ['บาสเกตบอล', 'basketball', 'สมัครเล่น', 'กีฬา'],
    memberCountNote: 'ประมาณ 6,200 คน',
    requiresAdminApproval: true,
    approvalAvgHours: 6,
    allowLinks: true,
    allowSalesPost: false,
    rulesNote: 'รอแอดมินอนุมัติ ห้ามโพสต์โฆษณาสินค้า โพสต์กิจกรรมกีฬาได้',
    qualityScore: 'B',
    lastPostedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    cooldownDays: 0,
    isBlacklisted: false,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'grp_005',
    name: 'กลุ่มอุปกรณ์ OBS และไลฟ์สดมืออาชีพ',
    url: 'https://www.facebook.com/groups/obs.livestream.pro',
    category: 'เทคโนโลยี',
    keywords: ['OBS', 'ไลฟ์สด', 'streaming', 'อุปกรณ์', 'encoder'],
    memberCountNote: 'ประมาณ 11,000 คน',
    requiresAdminApproval: false,
    approvalAvgHours: 0,
    allowLinks: true,
    allowSalesPost: true,
    rulesNote: 'เน้นเนื้อหาเทคนิค ไม่รับโพสต์โปรโมทที่ไม่เกี่ยวข้อง',
    qualityScore: 'C',
    lastPostedAt: null,
    cooldownDays: 0,
    isBlacklisted: false,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

export const seedPost: CaptionPost = {
  id: 'post_001',
  title: 'PepsLive — บริการถ่ายทอดสดกีฬาระดับมืออาชีพ',
  caption: `🔴 LIVE กีฬาระดับมืออาชีพ ด้วยทีมงาน PepsLive

เราให้บริการถ่ายทอดสดงานกีฬาทุกประเภท ตั้งแต่ฟุตบอล, บาสเกตบอล ไปจนถึงงานแข่งขันระดับชาติ

✅ ทีมงานมืออาชีพพร้อมอุปกรณ์ครบครัน
✅ ระบบ Multi-Camera ถ่ายหลายมุม
✅ สตรีมออนไลน์คมชัด 1080p
✅ ราคาสมเหตุสมผล รับงานทุกขนาด`,
  link: 'https://pepsproduction.github.io/pepslive-tools/',
  hashtags: '#PepsLive #ไลฟ์สด #ถ่ายทอดสด #กีฬา #LiveStreaming',
  note: 'โพสต์โปรโมทหลักสำหรับแคมเปญ Q2/2024',
  variants: [
    {
      id: 'var_001',
      style: 'sport_event',
      label: 'Sport Event',
      caption: `⚽ มีงานแข่งกีฬา? ให้ PepsLive ถ่ายสดให้คุณ!

📡 ถ่ายทอดสดครบจบในทีมเดียว — กีฬาทุกประเภท
🏆 มืออาชีพ | คมชัด | ราคาโปร

🔗 ดูรายละเอียด: https://pepsproduction.github.io/pepslive-tools/

#PepsLive #ถ่ายทอดสด #กีฬาสด`,
    },
    {
      id: 'var_002',
      style: 'friendly',
      label: 'Friendly',
      caption: `👋 สวัสดีชาวกลุ่ม!

อยากถ่ายทอดสดงานกีฬาแต่ไม่รู้จะเริ่มยังไง? ทีม PepsLive ช่วยได้เลย! 😊

✨ เราดูแลครบ ตั้งแต่ติดตั้งกล้องจนจบไลฟ์
📞 ทักมาคุยได้เลยครับ

#PepsLive #ไลฟ์สดกีฬา`,
    },
  ],
  createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
};

export const seedCampaign: Campaign = {
  id: 'camp_001',
  name: 'โปรโมท PepsLive — มิถุนายน 2024',
  objective: 'pepslive_web',
  objectiveNote: 'แชร์บริการไลฟ์สดกีฬาลงกลุ่มกีฬาและช่างภาพ',
  postId: 'post_001',
  selectedGroupIds: ['grp_001', 'grp_002', 'grp_003', 'grp_004', 'grp_005'],
  status: 'draft',
  scheduledAt: null,
  createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
};

export const seedQueueItems: ShareQueueItem[] = seedCampaign.selectedGroupIds.map((groupId) => ({
  id: `qi_${groupId}`,
  campaignId: 'camp_001',
  postId: 'post_001',
  groupId,
  scheduledAt: null,
  status: 'not_started',
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  note: '',
  createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
}));

export function loadSeedData(): void {
  const key = 'pgsc_seeded_v1';
  if (localStorage.getItem(key)) return;
  localStorage.setItem('pgsc_groups', JSON.stringify(seedGroups));
  localStorage.setItem('pgsc_posts', JSON.stringify([seedPost]));
  localStorage.setItem('pgsc_campaigns', JSON.stringify([seedCampaign]));
  localStorage.setItem('pgsc_queue', JSON.stringify(seedQueueItems));
  localStorage.setItem(key, '1');
}
