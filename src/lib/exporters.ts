import type { ShareQueueItem, Campaign, Group, Lead } from '../types';
import { groupStorage } from './storage';

// =====================================================
// CSV EXPORT
// =====================================================
function escapeCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportQueueCsv(items: ShareQueueItem[], campaign?: Campaign): string {
  const groups = groupStorage.getAll();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const headers = [
    'แคมเปญ', 'ชื่อกลุ่ม', 'URL กลุ่ม', 'หมวดหมู่',
    'สถานะ', 'วันที่กำหนด', 'วันที่โพสต์', 'อนุมัติเมื่อ',
    'ปฏิเสธเมื่อ', 'หมายเหตุ',
  ];

  const statusLabel: Record<string, string> = {
    not_started: 'ยังไม่เริ่ม',
    opened: 'เปิดกลุ่มแล้ว',
    posted: 'โพสต์แล้ว',
    pending_admin: 'รอแอดมินอนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ',
    deleted: 'โพสต์ถูกลบ',
    skipped: 'ข้าม',
    failed: 'โพสต์ไม่ได้',
    lead_received: 'มีลูกค้าทัก',
    completed: 'เสร็จสิ้น',
  };

  const rows = items.map((item) => {
    const group = groupMap.get(item.groupId);
    return [
      campaign?.name || item.campaignId,
      group?.name || item.groupId,
      group?.url || '',
      group?.category || '',
      statusLabel[item.status] || item.status,
      item.scheduledAt || '',
      item.submittedAt || '',
      item.approvedAt || '',
      item.rejectedAt || '',
      item.note,
    ].map(escapeCsv).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export function exportGroupsCsv(groups: Group[]): string {
  const headers = [
    'ชื่อกลุ่ม', 'URL', 'หมวดหมู่', 'Keywords', 'จำนวนสมาชิก',
    'ต้องรอแอดมิน', 'อนุญาตลิงก์', 'อนุญาตขายของ', 'คะแนน',
    'Cooldown (วัน)', 'โพสต์ล่าสุด', 'Blacklist', 'กฎกลุ่ม',
  ];

  const rows = groups.map((g) => [
    g.name, g.url, g.category,
    g.keywords.join(';'),
    g.memberCountNote,
    g.requiresAdminApproval ? 'ใช่' : 'ไม่',
    g.allowLinks ? 'ใช่' : 'ไม่',
    g.allowSalesPost ? 'ใช่' : 'ไม่',
    g.qualityScore,
    g.cooldownDays,
    g.lastPostedAt || '',
    g.isBlacklisted ? 'ใช่' : 'ไม่',
    g.rulesNote,
  ].map(escapeCsv).join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

export function exportLeadsCsv(leads: Lead[], groups: Group[], campaigns: Campaign[]): string {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const headers = [
    'วันที่สร้าง', 'แคมเปญ', 'กลุ่ม', 'ชื่อลูกค้า', 'บริการที่สนใจ',
    'มูลค่าประเมิน', 'สถานะ', 'รายละเอียด',
  ];

  const rows = leads.map((lead) => [
    lead.createdAt,
    campaignMap.get(lead.campaignId)?.name || lead.campaignId,
    groupMap.get(lead.groupId)?.name || lead.groupId,
    lead.customerName,
    lead.serviceInterest,
    lead.valueEstimate,
    lead.status,
    lead.contactNote,
  ].map(escapeCsv).join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

// =====================================================
// DOWNLOAD HELPERS
// =====================================================
export function downloadFile(content: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  const bom = type.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([bom + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}
