import { useState } from 'react';
import type { AppPage } from '../types';
import { groupStorage, campaignStorage, queueStorage, settingsStorage } from '../lib/storage';
import { formatRelative } from '../lib/date';
import { getCooldownLeft, isGroupInCooldown } from '../lib/cooldown';

interface DashboardProps {
  onNavigate: (page: AppPage) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [groups] = useState(() => groupStorage.getAll());
  const [campaigns] = useState(() => campaignStorage.getAll());
  const [queue] = useState(() => queueStorage.getAll());
  const [settings] = useState(() => settingsStorage.get());
  const cooldownEnabled = settings.automation.cooldownEnabled;

  const readyGroups = groups.filter((g) => !g.isBlacklisted && !g.requiresAdminApproval && g.allowLinks);
  const pendingGroups = groups.filter((g) => g.requiresAdminApproval && !g.isBlacklisted);
  const rulesGroups = groups.filter((g) => !g.allowLinks && !g.isBlacklisted);
  const activeQueue = queue.filter((q) => q.status === 'not_started' || q.status === 'opened');
  const pendingApproval = queue.filter((q) => q.status === 'pending_admin');

  const stats = [
    { label: 'กลุ่มทั้งหมด', value: groups.length, icon: '👥', sub: 'กลุ่มที่บันทึกไว้' },
    { label: 'พร้อมโพสต์', value: readyGroups.length, icon: '✅', sub: 'โพสต์ได้ทันที', color: 'var(--status-ready)' },
    { label: 'รอแอดมิน', value: pendingGroups.length, icon: '⏳', sub: 'ต้องได้รับอนุมัติ', color: 'var(--status-pending)' },
    { label: 'กฎพิเศษ', value: rulesGroups.length, icon: '⚠️', sub: 'ห้ามแนบลิงก์', color: 'var(--status-rules)' },
    { label: 'แคมเปญทั้งหมด', value: campaigns.length, icon: '🚀', sub: 'ที่สร้างแล้ว' },
    { label: 'คิวที่รอ', value: activeQueue.length, icon: '📅', sub: 'ยังไม่แชร์', color: 'var(--accent-text)' },
    { label: 'รอผลอนุมัติ', value: pendingApproval.length, icon: '🔔', sub: 'รอแอดมินตอบ', color: 'var(--gold-text)' },
    { label: 'A Grade', value: groups.filter((g) => g.qualityScore === 'A').length, icon: '⭐', sub: 'กลุ่มคุณภาพสูง', color: 'var(--status-ready)' },
  ];

  const recentCampaigns = [...campaigns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

  const overdueGroups = groups.filter((group) => isGroupInCooldown(group, cooldownEnabled));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Command Center</h1>
        <p className="page-subtitle">ภาพรวมระบบ PepsGroup Share Command</p>
      </div>

      <div className="disclaimer-banner">
        <span className="disclaimer-icon">🛡️</span>
        <div>
          <strong style={{ color: 'var(--accent-text)' }}>ระบบนี้เป็นเครื่องมือช่วยจัดการคิวและบันทึกผลเท่านั้น</strong>
          {' '}ไม่ใช่ระบบโพสต์อัตโนมัติ · ผู้ใช้ต้องเป็นผู้กดโพสต์/แชร์เองทุกครั้ง · ควรอ่านกฎของแต่ละกลุ่มก่อนโพสต์
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card-label">{s.icon} {s.label}</div>
            <div className="stat-card-value" style={{ color: s.color || 'var(--accent-text)' }}>{s.value}</div>
            <div className="stat-card-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Recent Campaigns */}
        <div>
          <div className="section-title">🚀 แคมเปญล่าสุด</div>
          {recentCampaigns.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon">🚀</div>
                <div className="empty-state-title">ยังไม่มีแคมเปญ</div>
                <button className="btn btn-primary btn-sm mt-1" onClick={() => onNavigate('campaign_builder')}>
                  สร้างแคมเปญแรก
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentCampaigns.map((c) => {
                const cQueue = queue.filter((q) => q.campaignId === c.id);
                const done = cQueue.filter((q) => ['posted', 'approved', 'completed'].includes(q.status)).length;
                return (
                  <div key={c.id} className="card card-lift" style={{ cursor: 'pointer' }} onClick={() => onNavigate('campaign_builder')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{c.name}</span>
                      <span className={`badge ${c.status === 'completed' ? 'badge-done' : c.status === 'sharing' ? 'badge-pending' : 'badge-skipped'}`}>
                        {c.status === 'completed' ? 'เสร็จสิ้น' : c.status === 'sharing' ? 'กำลังแชร์' : 'Draft'}
                      </span>
                    </div>
                    <div className="text-xs text-muted">{formatRelative(c.createdAt)}</div>
                    {cQueue.length > 0 && (
                      <div style={{ marginTop: '0.6rem' }}>
                        <div className="flex justify-between text-xs text-muted mb-1">
                          <span>ความคืบหน้า</span>
                          <span>{done}/{cQueue.length}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${cQueue.length > 0 ? (done / cQueue.length) * 100 : 0}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions & Cooldown Warning */}
        <div>
          <div className="section-title">⚡ Quick Actions</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-primary w-full" onClick={() => onNavigate('campaign_builder')}>
              🚀 สร้างแคมเปญใหม่
            </button>
            <button className="btn btn-secondary w-full" onClick={() => onNavigate('group_finder')}>
              🔍 เพิ่มกลุ่มใหม่
            </button>
            <button className="btn btn-secondary w-full" onClick={() => onNavigate('share_session')}>
              ▶️ เริ่ม Share Session
            </button>
            <button className="btn btn-ghost w-full" onClick={() => onNavigate('pending_approval')}>
              ⏳ ตรวจสอบรอแอดมิน ({pendingApproval.length})
            </button>
            <button className="btn btn-ghost w-full" onClick={() => onNavigate('reports')}>
              📈 ดูรายงาน
            </button>
          </div>

          {overdueGroups.length > 0 && (
            <>
              <div className="section-title mt-2">🕐 Cooldown เต็ม</div>
              <div className="card">
                <div className="text-xs text-muted mb-1">กลุ่มที่โพสต์เร็วเกินไป (ยังอยู่ใน Cooldown)</div>
                {overdueGroups.slice(0, 3).map((g) => (
                  <div key={g.id} className="timeline-item">
                    <div className="timeline-dot" style={{ background: 'var(--status-rules)' }} />
                    <div>
                      <div className="text-sm font-bold">{g.name}</div>
                      <div className="text-xs text-muted">เหลือ {getCooldownLeft(g, cooldownEnabled)} วัน</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
