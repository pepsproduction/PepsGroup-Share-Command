import type { Group } from '../types';

// =====================================================
// STATUS BADGE for Groups
// =====================================================
export function GroupStatusBadge({ group }: { group: Group }) {
  if (group.isBlacklisted) return <span className="badge badge-blocked">Blacklisted</span>;
  if (group.requiresAdminApproval) return <span className="badge badge-pending">รอแอดมิน</span>;
  return <span className="badge badge-ready">โพสต์ได้</span>;
}

export function QualityBadge({ score }: { score: string }) {
  const cls = score === 'A' ? 'badge-ready' : score === 'B' ? 'badge-accent' : score === 'C' ? 'badge-rules' : 'badge-blocked';
  return <span className={`badge ${cls}`}>{score} Grade</span>;
}

export function LinkBadge({ allow }: { allow: boolean }) {
  if (allow) return null;
  return <span className="badge badge-blocked">ห้ามลิงก์</span>;
}

export function ShareStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    not_started:   ['badge-skipped', 'ยังไม่เริ่ม'],
    opened:        ['badge-accent', 'เปิดแล้ว'],
    posted:        ['badge-ready', 'โพสต์แล้ว'],
    pending_admin: ['badge-pending', 'รอแอดมิน'],
    approved:      ['badge-done', 'อนุมัติแล้ว'],
    rejected:      ['badge-blocked', 'ไม่อนุมัติ'],
    deleted:       ['badge-blocked', 'ถูกลบ'],
    skipped:       ['badge-skipped', 'ข้าม'],
    failed:        ['badge-blocked', 'โพสต์ไม่ได้'],
    lead_received: ['badge-gold', 'มีลูกค้าทัก'],
    completed:     ['badge-done', 'เสร็จสิ้น'],
  };
  const [cls, label] = map[status] || ['badge-skipped', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft:            ['badge-skipped', 'Draft'],
    scheduled:        ['badge-accent', 'Scheduled'],
    sharing:          ['badge-pending', 'Sharing'],
    pending_approval: ['badge-rules', 'Pending'],
    completed:        ['badge-done', 'Completed'],
  };
  const [cls, label] = map[status] || ['badge-skipped', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
