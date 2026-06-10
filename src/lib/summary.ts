import type { ShareQueueItem } from '../types';

// =====================================================
// SUMMARY HELPERS
// =====================================================

export interface SessionSummary {
  total: number;
  notStarted: number;
  opened: number;
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
    notStarted: items.filter((i) => i.status === 'not_started').length,
    opened: items.filter((i) => i.status === 'opened').length,
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
  ];
  if (summary.notStarted > 0) lines.push(`💤 ยังไม่ได้เริ่ม: ${summary.notStarted} กลุ่ม`);
  if (summary.opened > 0) lines.push(`📖 เปิดแล้ว: ${summary.opened} กลุ่ม`);
  
  lines.push(
    `✅ โพสต์สำเร็จ: ${summary.posted} กลุ่ม`,
    `⏳ รอแอดมินอนุมัติ: ${summary.pendingAdmin} กลุ่ม`,
    `👍 อนุมัติแล้ว: ${summary.approved} กลุ่ม`,
    `❌ ไม่อนุมัติ: ${summary.rejected} กลุ่ม`,
    `⏭️ ข้าม: ${summary.skipped} กลุ่ม`,
    `🚫 โพสต์ไม่ได้: ${summary.failed} กลุ่ม`,
    `💬 มีลูกค้าทัก: ${summary.leadReceived} กลุ่ม`
  );
  
  lines.push(
    `━━━━━━━━━━━━━━━━━━━━`,
    `รวม: ${summary.total} กลุ่ม`
  );
  return lines.join('\n');
}
