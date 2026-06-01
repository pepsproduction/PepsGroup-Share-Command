import type { ShareQueueItem } from '../types';

// =====================================================
// SUMMARY HELPERS
// =====================================================

export interface SessionSummary {
  total: number;
  posted: number;
  pendingAdmin: number;
  approved: number;
  rejected: number;
  skipped: number;
  failed: number;
  leadReceived: number;
  completed: number;
}

export function computeSessionSummary(items: ShareQueueItem[]): SessionSummary {
  return {
    total: items.length,
    posted: items.filter((i) => i.status === 'posted').length,
    pendingAdmin: items.filter((i) => i.status === 'pending_admin').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    skipped: items.filter((i) => i.status === 'skipped').length,
    failed: items.filter((i) => i.status === 'failed').length,
    leadReceived: items.filter((i) => i.status === 'lead_received').length,
    completed: items.filter((i) => i.status === 'completed').length,
  };
}

export function summaryToText(summary: SessionSummary, campaignName?: string): string {
  const lines = [
    `📊 สรุปผลการแชร์${campaignName ? ` — ${campaignName}` : ''}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `✅ โพสต์สำเร็จ: ${summary.posted} กลุ่ม`,
    `⏳ รอแอดมินอนุมัติ: ${summary.pendingAdmin} กลุ่ม`,
    `👍 อนุมัติแล้ว: ${summary.approved} กลุ่ม`,
    `❌ ไม่อนุมัติ: ${summary.rejected} กลุ่ม`,
    `⏭️ ข้าม: ${summary.skipped} กลุ่ม`,
    `🚫 โพสต์ไม่ได้: ${summary.failed} กลุ่ม`,
    `💬 มีลูกค้าทัก: ${summary.leadReceived} กลุ่ม`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `รวม: ${summary.total} กลุ่ม`,
  ];
  return lines.join('\n');
}
