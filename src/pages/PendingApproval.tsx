import { useState, useCallback } from 'react';
import type { ShareQueueItem, ShareItemStatus } from '../types';
import { queueStorage, groupStorage, campaignStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationCenter';
import { openInNewTab } from '../lib/facebook';
import { formatDateTime, isoNow } from '../lib/date';
import { ShareStatusBadge } from '../components/Badge';

export function PendingApproval() {
  const { addNotification } = useNotifications();
  const [queue, setQueue] = useState<ShareQueueItem[]>(() => queueStorage.getAll());
  const [groups] = useState(() => groupStorage.getAll());
  const [campaigns] = useState(() => campaignStorage.getAll());
  const [notes, setNotes] = useState<Record<string, string>>({});

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  const reload = useCallback(() => setQueue(queueStorage.getAll()), []);

  const pending = queue.filter((q) => q.status === 'pending_admin');
  const approved = queue.filter((q) => q.status === 'approved');
  const rejected = queue.filter((q) => q.status === 'rejected');

  function updateStatus(item: ShareQueueItem, status: ShareItemStatus) {
    const now = isoNow();
    const updated: ShareQueueItem = {
      ...item,
      status,
      note: notes[item.id] || item.note,
      approvedAt: status === 'approved' ? now : item.approvedAt,
      rejectedAt: status === 'rejected' || status === 'deleted' ? now : item.rejectedAt,
      updatedAt: now,
    };
    queueStorage.update(updated);
    const group = groupMap.get(item.groupId);
    const labels: Record<string, string> = { approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', deleted: 'โพสต์ถูกลบ', pending_admin: 'ยังรออยู่' };
    addNotification('success', `อัปเดตสถานะ: ${labels[status] || status}`, `กลุ่ม ${group?.name || ''}`);
    setNotes((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    reload();
  }

  function renderSection(title: string, items: ShareQueueItem[], color: string) {
    return (
      <div className="section">
        <div className="section-title" style={{ color }}>{title} ({items.length})</div>
        {items.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-desc">ไม่มีรายการ</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item) => {
              const group = groupMap.get(item.groupId);
              const campaign = campaignMap.get(item.campaignId);
              return (
                <div key={item.id} className="card">
                  <div className="flex items-center justify-between mb-1" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div className="font-bold">{group?.name || item.groupId}</div>
                      <div className="text-xs text-muted mt-1">
                        {campaign?.name} · โพสต์เมื่อ {formatDateTime(item.submittedAt)}
                      </div>
                    </div>
                    <ShareStatusBadge status={item.status} />
                  </div>

                  {item.note && (
                    <div className="text-xs text-secondary mb-1">📝 {item.note}</div>
                  )}

                  <div className="flex gap-1 mb-2" style={{ flexWrap: 'wrap' }}>
                    {group && (
                      <button className="btn btn-ghost btn-sm" onClick={() => openInNewTab(group.url)} aria-label="เปิดกลุ่ม">
                        🔗 เปิดกลุ่ม
                      </button>
                    )}
                  </div>

                  <div className="form-group mb-1">
                    <input
                      className="form-input"
                      placeholder="หมายเหตุ..."
                      value={notes[item.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>

                  {item.status === 'pending_admin' && (
                    <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn-success btn-sm" onClick={() => updateStatus(item, 'approved')}>✅ อนุมัติแล้ว</button>
                      <button className="btn btn-danger btn-sm" onClick={() => updateStatus(item, 'rejected')}>❌ ไม่อนุมัติ</button>
                      <button className="btn btn-danger btn-sm" onClick={() => updateStatus(item, 'deleted')}>🗑️ โพสต์ถูกลบ</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(item, 'pending_admin')}>🔄 ยังรออยู่</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Pending Approval</h1>
        <p className="page-subtitle">ติดตามกลุ่มที่รอแอดมินอนุมัติ</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-label">⏳ รออยู่</div>
          <div className="stat-card-value" style={{ color: 'var(--status-pending)' }}>{pending.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">✅ อนุมัติแล้ว</div>
          <div className="stat-card-value" style={{ color: 'var(--status-ready)' }}>{approved.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">❌ ไม่อนุมัติ</div>
          <div className="stat-card-value" style={{ color: 'var(--status-blocked)' }}>{rejected.length}</div>
        </div>
      </div>

      {renderSection('⏳ รอแอดมินอนุมัติ', pending, 'var(--status-pending)')}
      {renderSection('✅ อนุมัติแล้ว', approved, 'var(--status-ready)')}
      {renderSection('❌ ไม่อนุมัติ / ถูกลบ', rejected, 'var(--status-blocked)')}
    </div>
  );
}
