// =====================================================
// DATE UTILITIES
// =====================================================

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 0) return formatDateTime(iso);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return formatDate(iso);
}

export function daysSince(iso: string | null): number {
  if (!iso) return 999;
  const d = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function isOverdue(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  return new Date(scheduledAt) < new Date();
}

export function isToday(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  const d = new Date(scheduledAt);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function isTomorrow(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  const d = new Date(scheduledAt);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}
