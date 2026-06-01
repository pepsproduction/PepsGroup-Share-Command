import { useState, useCallback } from 'react';
import type { Group, QualityScore } from '../types';
import { groupStorage } from '../lib/storage';
import { openInNewTab } from '../lib/facebook';
import { useNotifications } from '../components/NotificationCenter';
import { GroupStatusBadge, QualityBadge, LinkBadge } from '../components/Badge';
import { ConfirmModal, Modal } from '../components/Modal';
import { daysSince, formatDate, isoNow } from '../lib/date';

type FilterStatus = 'all' | 'ready' | 'admin' | 'no_link' | 'blacklist' | 'A' | 'B' | 'C' | 'D';

export function GroupLibrary() {
  const { addNotification } = useNotifications();
  const [groups, setGroups] = useState<Group[]>(() => groupStorage.getAll());
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editKeywords, setEditKeywords] = useState('');

  const reload = useCallback(() => setGroups(groupStorage.getAll()), []);

  const categories = ['all', ...Array.from(new Set(groups.map((g) => g.category)))];

  const filtered = groups.filter((g) => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCat === 'all' || g.category === filterCat;
    const matchStatus: Record<FilterStatus, boolean> = {
      all: true,
      ready: !g.requiresAdminApproval && !g.isBlacklisted && g.allowLinks,
      admin: g.requiresAdminApproval,
      no_link: !g.allowLinks,
      blacklist: g.isBlacklisted,
      A: g.qualityScore === 'A',
      B: g.qualityScore === 'B',
      C: g.qualityScore === 'C',
      D: g.qualityScore === 'D',
    };
    return matchSearch && matchCat && matchStatus[filterStatus];
  });

  function handleDelete(id: string) {
    groupStorage.delete(id);
    addNotification('success', 'ลบกลุ่มสำเร็จ', 'ลบกลุ่มออกจากไลบรารีแล้ว');
    reload();
  }

  function handleEdit(g: Group) {
    setEditGroup({ ...g });
    setEditKeywords(g.keywords.join(', '));
  }

  function handleSaveEdit() {
    if (!editGroup) return;
    const updated: Group = {
      ...editGroup,
      keywords: editKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      updatedAt: isoNow(),
    };
    groupStorage.update(updated);
    addNotification('success', 'แก้ไขกลุ่มสำเร็จ', `อัปเดต "${updated.name}" เรียบร้อย`);
    setEditGroup(null);
    reload();
  }

  const statusFilters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'ready', label: '✅ โพสต์ได้' },
    { key: 'admin', label: '⏳ รอแอดมิน' },
    { key: 'no_link', label: '🚫 ห้ามลิงก์' },
    { key: 'A', label: '⭐ A Grade' },
    { key: 'B', label: 'B Grade' },
    { key: 'C', label: 'C Grade' },
    { key: 'blacklist', label: '🔴 Blacklist' },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Group Library</h1>
        <p className="page-subtitle">จัดการกลุ่มทั้งหมด {groups.length} กลุ่ม</p>
      </div>

      {/* Search & Filter */}
      <div className="card mb-2">
        <div className="search-bar mb-2">
          <span className="search-bar-icon">🔍</span>
          <input
            className="form-input"
            placeholder="ค้นหาจากชื่อหรือ keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="ค้นหากลุ่ม"
          />
        </div>
        <div className="filter-bar">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              className={`filter-chip ${filterStatus === f.key ? 'active' : ''}`}
              onClick={() => setFilterStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {categories.map((c) => (
            <button
              key={c}
              className={`filter-chip ${filterCat === c ? 'active' : ''}`}
              onClick={() => setFilterCat(c)}
            >
              {c === 'all' ? 'ทุกหมวด' : c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-title">ไม่พบกลุ่ม</div>
            <div className="empty-state-desc">ลองเปลี่ยนตัวกรองหรือเพิ่มกลุ่มใหม่จาก Group Finder</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.map((g) => {
            const cooldownLeft = g.lastPostedAt ? Math.max(0, g.cooldownDays - daysSince(g.lastPostedAt)) : 0;
            return (
              <div key={g.id} className="group-card">
                <div className="group-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="group-card-name truncate">{g.name}</div>
                    <div className="group-card-url truncate">{g.url}</div>
                  </div>
                  <QualityBadge score={g.qualityScore} />
                </div>

                <div className="group-card-badges">
                  <GroupStatusBadge group={g} />
                  <LinkBadge allow={g.allowLinks} />
                  {g.allowSalesPost && <span className="badge badge-accent">ขายได้</span>}
                  <span className="badge badge-skipped">{g.category}</span>
                  {cooldownLeft > 0 && <span className="badge badge-rules">Cooldown {cooldownLeft}วัน</span>}
                </div>

                <div className="group-card-meta">
                  <span>👥 {g.memberCountNote || '-'}</span>
                  <span>📅 โพสต์ล่าสุด: {formatDate(g.lastPostedAt)}</span>
                  <span>⏱️ Cooldown: {g.cooldownDays} วัน</span>
                  <span>⏳ อนุมัติ: ~{g.approvalAvgHours} ชม.</span>
                </div>

                {g.rulesNote && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    📋 {g.rulesNote}
                  </div>
                )}

                <div className="group-card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openInNewTab(g.url)}
                    aria-label={`เปิดกลุ่ม ${g.name}`}
                  >
                    🔗 เปิด
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(g)}
                    aria-label={`แก้ไขกลุ่ม ${g.name}`}
                  >
                    ✏️ แก้ไข
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteId(g.id)}
                    aria-label={`ลบกลุ่ม ${g.name}`}
                  >
                    🗑️ ลบ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="ยืนยันการลบกลุ่ม"
        message="คุณแน่ใจหรือไม่ที่จะลบกลุ่มนี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบกลุ่ม"
        danger
      />

      {/* Edit Modal */}
      {editGroup && (
        <Modal
          isOpen
          onClose={() => setEditGroup(null)}
          title={`แก้ไขกลุ่ม`}
          size="lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditGroup(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>💾 บันทึก</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ชื่อกลุ่ม</label>
              <input className="form-input" value={editGroup.name} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">URL กลุ่ม</label>
              <input className="form-input" value={editGroup.url} onChange={(e) => setEditGroup({ ...editGroup, url: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">หมวดหมู่</label>
              <input className="form-input" value={editGroup.category} onChange={(e) => setEditGroup({ ...editGroup, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">คะแนนคุณภาพ</label>
              <select className="form-select" value={editGroup.qualityScore} onChange={(e) => setEditGroup({ ...editGroup, qualityScore: e.target.value as QualityScore })}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Keywords</label>
            <input className="form-input" value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">จำนวนสมาชิก</label>
              <input className="form-input" value={editGroup.memberCountNote} onChange={(e) => setEditGroup({ ...editGroup, memberCountNote: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Cooldown (วัน)</label>
              <input type="number" className="form-input" min={0} value={editGroup.cooldownDays} onChange={(e) => setEditGroup({ ...editGroup, cooldownDays: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label className="form-check">
              <input type="checkbox" checked={editGroup.requiresAdminApproval} onChange={(e) => setEditGroup({ ...editGroup, requiresAdminApproval: e.target.checked })} />
              <span className="form-check-label">ต้องรอแอดมินอนุมัติ</span>
            </label>
            <label className="form-check">
              <input type="checkbox" checked={editGroup.allowLinks} onChange={(e) => setEditGroup({ ...editGroup, allowLinks: e.target.checked })} />
              <span className="form-check-label">อนุญาตให้แนบลิงก์</span>
            </label>
            <label className="form-check">
              <input type="checkbox" checked={editGroup.allowSalesPost} onChange={(e) => setEditGroup({ ...editGroup, allowSalesPost: e.target.checked })} />
              <span className="form-check-label">อนุญาตขายของ</span>
            </label>
            <label className="form-check">
              <input type="checkbox" checked={editGroup.isBlacklisted} onChange={(e) => setEditGroup({ ...editGroup, isBlacklisted: e.target.checked })} />
              <span className="form-check-label">Blacklist</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">หมายเหตุกฎกลุ่ม</label>
            <textarea className="form-textarea" value={editGroup.rulesNote} onChange={(e) => setEditGroup({ ...editGroup, rulesNote: e.target.value })} rows={3} />
          </div>
        </Modal>
      )}
    </div>
  );
}
