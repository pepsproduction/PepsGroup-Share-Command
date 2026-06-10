import type { Group } from '../types';
export function getGroupCooldownDays(group: Group): number {
  const days = Number(group.cooldownDays);
  if (!Number.isFinite(days)) return 0;
  return Math.max(0, Math.floor(days));
}

export const NEVER_POSTED_ELAPSED = Number.MAX_SAFE_INTEGER;

export function getCooldownElapsedDays(group: Group): number {
  if (!group.lastPostedAt) return NEVER_POSTED_ELAPSED;

  const posted = new Date(group.lastPostedAt);
  const postedDate = new Date(posted.getFullYear(), posted.getMonth(), posted.getDate());
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.floor((todayDate.getTime() - postedDate.getTime()) / 86400000);
}

export function getCooldownLeft(group: Group, cooldownEnabled: boolean): number {
  if (!cooldownEnabled || !group.lastPostedAt) return 0;
  const cooldownDays = getGroupCooldownDays(group);
  if (cooldownDays <= 0) return 0;
  return Math.max(0, cooldownDays - getCooldownElapsedDays(group));
}

export function isGroupInCooldown(group: Group, cooldownEnabled: boolean): boolean {
  return getCooldownLeft(group, cooldownEnabled) > 0;
}

export function formatCooldownValue(group: Group, cooldownEnabled: boolean): string {
  if (!cooldownEnabled) return 'ปิดอยู่';
  const cooldownDays = getGroupCooldownDays(group);
  return cooldownDays > 0 ? `${cooldownDays} วัน` : 'ไม่มี';
}
