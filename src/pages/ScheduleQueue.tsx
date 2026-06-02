import { useState, useCallback } from 'react';
import type { ShareQueueItem } from '../types';
import { queueStorage, campaignStorage, groupStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationContexts';
import { ShareStatusBadge } from '../components/Badge';
import { formatDateTime, isOverdue, isToday, isTomorrow, isoNow } from '../lib/date';
import { openInNewTab } from '../lib/facebook';

type QueueTab = 'today' | 'tomorrow' | 'overdue' | 'done' | 'all';

export function ScheduleQueue() {
  const { addNotification } = useNotifications();
  const [queue, setQueue] = useState<ShareQueueItem[]>(() => queueStorage.getAll());
  const [campaigns] = useState(() => campaignStorage.getAll());
  const [groups] = useState(() => groupStorage.getAll());
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [editItem, setEditItem] = useState<ShareQueueItem | null>(null);
  const [editSchedule, setEditSchedule] = useState('');

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  const reload = useCallback(() => setQueue(queueStorage.getAll()), []);

  const filtered = queue.filter((item) => {
    if (activeTab === 'today') return isToday(item.scheduledAt) && item.status === 'not_started';
    if (activeTab === 'tomorrow') return isTomorrow(item.scheduledAt) && item.status === 'not_started';
    if (activeTab === 'overdue') return isOverdue(item.scheduledAt) && item.status === 'not_started';
    if (activeTab === 'done') return ['posted', 'approved', 'completed', 'skipped', 'failed'].includes(item.status);
    return true;
  });

  function markCompleted(item: ShareQueueItem) {
    const updated: ShareQueueItem = { ...item, status: 'completed', updatedAt: isoNow() };
    queueStorage.update(updated);
    addNotification('success', 'อัปเดตสถานะ', `กลุ่ม ${groupMap.get(item.groupId)?.name} — เสร็จสิ้น`);
    reload();
  }

  function handleSaveSchedule() {
    if (!editItem) return;
    const updated: ShareQueueItem = { ...editItem, scheduledAt: editSchedule ? new Date(editSchedule).toISOString() : null, updatedAt: isoNow() };
    queueStorage.update(updated);
    addNotification('success', 'อัปเดตเวลาแล้ว', '');
    setEditItem(null);
    reload();
  }

  const tabs: { key: QueueTab; label: string; count?: number }[] = [
    { key: 'all', label: '📋 ทั้งหมด', count: queue.length },
    { key: 'today', label: '📅 วันนี้', count: queue.filter((q) => isToday(q.scheduledAt) && q.status === 'not_started').length },
    { key: 'tomorrow', label: '🌅 พรุ่งนี้', count: queue.filter((q) => isTomorrow(q.scheduledAt) && q.status === 'not_started').length },
    { key: 'overdue', label: '⚠️ เกินกำหนด', count: queue.filter((q) => isOverdue(q.scheduledAt) && q.status === 'not_started').length },
    { key: 'done', label: '✅ เสร็จแล้ว', count: queue.filter((q) => ['posted', 'approved', 'completed', 'skipped', 'failed'].includes(q.status)).length },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Schedule Queue</h1>
        <p className="page-subtitle">จัดการคิวและตั้งเวลาแชร์</p>
      </div>

      <div className="filter-bar mb-2">
        {tabs.map((t) => (
          <button key={t.key} className={`filter-chip ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label} {t.count !== undefined && t.count > 0 ? `(${t.count})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">ไม่มีรายการในหมวดนี้</div>
            <div className="empty-state-desc">สร้างแคมเปญและเลือกกลุ่มเพื่อเพิ่มเข้าคิว</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>กลุ่ม</th>
                <th>แคมเปญ</th>
                <th>สถานะ</th>
                <th>กำหนดแชร์</th>
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const group = groupMap.get(item.groupId);
                const campaign = campaignMap.get(item.campaignId);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-bold text-sm">{group?.name || item.groupId}</div>
                      <div className="text-xs text-muted">{group?.category}</div>
                    </td>
                    <td className="text-sm">{campaign?.name || item.campaignId}</td>
                    <td><ShareStatusBadge status={item.status} /></td>
                    <td className="text-sm text-muted">{item.scheduledAt ? formatDateTime(item.scheduledAt) : '—'}</td>
                    <td>
                      <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                        {group && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openInNewTab(group.url)} aria-label="เปิดกลุ่ม">🔗</button>
                        )}
                        {item.status === 'not_started' && (
                          <button className="btn btn-success btn-sm" onClick={() => markCompleted(item)}>✅ เสร็จ</button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(item); setEditSchedule(item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : ''); }}>
                          ✏️ แก้เวลา
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {editItem && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">ตั้งเวลาแชร์</h2>
              <button className="modal-close" onClick={() => setEditItem(null)}>×</button>
            </div>
            <div className="text-sm text-secondary mb-2">กลุ่ม: <strong>{groupMap.get(editItem.groupId)?.name}</strong></div>
            <div className="form-group">
              <label className="form-label">วันและเวลาที่ต้องการแชร์</label>
              <input type="datetime-local" className="form-input" value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditItem(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSaveSchedule}>💾 บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
