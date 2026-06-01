import { useState } from 'react';
import type { Group, Campaign } from '../types';
import { groupStorage, campaignStorage, queueStorage } from '../lib/storage';
import { daysSince } from '../lib/date';
import { useNotifications } from '../components/NotificationCenter';
import { GroupStatusBadge, QualityBadge, LinkBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import type { ShareQueueItem } from '../types';
import { isoNow } from '../lib/date';

type GradeFilter = 'all' | 'AB' | 'A' | 'cooldown';

export function GroupSelector() {
  const { addNotification } = useNotifications();
  const [groups] = useState<Group[]>(() => groupStorage.getAll());
  const [campaigns] = useState<Campaign[]>(() => campaignStorage.getAll());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCat, setFilterCat] = useState('all');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [showSummary, setShowSummary] = useState(false);
  const [targetCampaign, setTargetCampaign] = useState('');
  const [cooldownDays, setCooldownDays] = useState(7);

  const categories = ['all', ...Array.from(new Set(groups.map((g) => g.category)))];

  const filteredGroups = groups.filter((g) => {
    const catMatch = filterCat === 'all' || g.category === filterCat;
    const gradeMatch = gradeFilter === 'all' ? true
      : gradeFilter === 'AB' ? (g.qualityScore === 'A' || g.qualityScore === 'B')
      : gradeFilter === 'A' ? g.qualityScore === 'A'
      : gradeFilter === 'cooldown' ? daysSince(g.lastPostedAt) >= cooldownDays
      : true;
    return catMatch && gradeMatch;
  });

  function toggleAll() {
    if (selected.size === filteredGroups.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredGroups.map((g) => g.id)));
    }
  }

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  const selectedGroups = groups.filter((g) => selected.has(g.id));
  const readyCount = selectedGroups.filter((g) => !g.requiresAdminApproval && !g.isBlacklisted && g.allowLinks).length;
  const adminCount = selectedGroups.filter((g) => g.requiresAdminApproval).length;
  const specialCount = selectedGroups.filter((g) => !g.allowLinks).length;
  const noLinkCount = selectedGroups.filter((g) => !g.allowLinks).length;
  const tooSoonCount = selectedGroups.filter((g) => daysSince(g.lastPostedAt) < g.cooldownDays).length;
  const hasWarning = selectedGroups.some((g) => !g.allowLinks || g.isBlacklisted || daysSince(g.lastPostedAt) < g.cooldownDays);

  function handleAddToQueue() {
    if (!targetCampaign || selected.size === 0) {
      addNotification('warning', 'กรุณาเลือกแคมเปญและกลุ่ม', '');
      return;
    }
    const now = isoNow();
    const items: ShareQueueItem[] = Array.from(selected).map((groupId) => ({
      id: `qi_${Date.now()}_${groupId}`,
      campaignId: targetCampaign,
      postId: campaigns.find((c) => c.id === targetCampaign)?.postId || '',
      groupId,
      scheduledAt: null,
      status: 'not_started',
      submittedAt: null,
      approvedAt: null,
      rejectedAt: null,
      note: '',
      createdAt: now,
      updatedAt: now,
    }));
    queueStorage.addMany(items);
    addNotification('success', 'เพิ่มเข้าคิวสำเร็จ', `เพิ่ม ${items.length} กลุ่มเข้าคิวแคมเปญแล้ว`);
    setShowSummary(false);
    setSelected(new Set());
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Group Selector</h1>
        <p className="page-subtitle">เลือกหลายกลุ่มเพื่อเพิ่มเข้าคิวแชร์</p>
      </div>

      {/* Controls */}
      <div className="card mb-2">
        <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
              {selected.size === filteredGroups.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setGradeFilter('AB')}>เลือก A+B</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setGradeFilter('cooldown')}>หมด Cooldown</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>ล้าง</button>
          </div>
          <div className="flex items-center gap-1">
            <label className="form-check-label" style={{ fontSize: '0.8rem' }}>Cooldown วัน:</label>
            <input type="number" min={1} className="form-input" style={{ width: '70px' }} value={cooldownDays} onChange={(e) => setCooldownDays(Number(e.target.value))} />
          </div>
        </div>

        <div className="filter-bar mb-2">
          {[
            { key: 'all', label: 'ทุกระดับ' },
            { key: 'AB', label: 'A+B เท่านั้น' },
            { key: 'A', label: 'A เท่านั้น' },
            { key: 'cooldown', label: `หมด Cooldown (${cooldownDays}วัน+)` },
          ].map((f) => (
            <button key={f.key} className={`filter-chip ${gradeFilter === f.key ? 'active' : ''}`} onClick={() => setGradeFilter(f.key as GradeFilter)}>{f.label}</button>
          ))}
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {categories.map((c) => (
            <button key={c} className={`filter-chip ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>
              {c === 'all' ? 'ทุกหมวด' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Selection summary bar */}
      {selected.size > 0 && (
        <div className="card mb-2" style={{ borderColor: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}>
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <span className="badge badge-accent">เลือก {selected.size} กลุ่ม</span>
              <span className="badge badge-ready">พร้อมโพสต์ {readyCount}</span>
              {adminCount > 0 && <span className="badge badge-pending">รอแอดมิน {adminCount}</span>}
              {specialCount > 0 && <span className="badge badge-rules">กฎพิเศษ {specialCount}</span>}
              {tooSoonCount > 0 && <span className="badge badge-blocked">เร็วเกิน {tooSoonCount}</span>}
            </div>
            <button className="btn btn-primary" onClick={() => setShowSummary(true)}>
              ✅ ตรวจสอบก่อนแชร์
            </button>
          </div>
        </div>
      )}

      {/* Group List */}
      {filteredGroups.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">☑️</div><div className="empty-state-title">ไม่มีกลุ่มในตัวกรองนี้</div></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredGroups.map((g) => {
            const isSelected = selected.has(g.id);
            const inCooldown = daysSince(g.lastPostedAt) < g.cooldownDays;
            return (
              <div
                key={g.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--accent)' : undefined,
                  background: isSelected ? 'var(--accent-dim)' : undefined,
                  opacity: g.isBlacklisted ? 0.5 : 1,
                }}
                onClick={() => toggle(g.id)}
              >
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(g.id)} onClick={(e) => e.stopPropagation()} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                      <span className="font-bold text-sm">{g.name}</span>
                      <QualityBadge score={g.qualityScore} />
                      <GroupStatusBadge group={g} />
                      <LinkBadge allow={g.allowLinks} />
                      {inCooldown && <span className="badge badge-rules">Cooldown {g.cooldownDays - daysSince(g.lastPostedAt)} วัน</span>}
                    </div>
                    <div className="text-xs text-muted mt-1">{g.category} · {g.memberCountNote}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Modal */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="ตรวจสอบก่อนเริ่มแชร์" size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowSummary(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleAddToQueue}>✅ เพิ่มเข้าคิว</button>
          </>
        }
      >
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-item-label">เลือกทั้งหมด</span><span className="summary-item-value text-accent">{selected.size}</span></div>
          <div className="summary-item"><span className="summary-item-label">โพสต์ได้ทันที</span><span className="summary-item-value" style={{ color: 'var(--status-ready)' }}>{readyCount}</span></div>
          <div className="summary-item"><span className="summary-item-label">ต้องรอแอดมิน</span><span className="summary-item-value" style={{ color: 'var(--status-pending)' }}>{adminCount}</span></div>
          <div className="summary-item"><span className="summary-item-label">มีกฎพิเศษ</span><span className="summary-item-value" style={{ color: 'var(--status-rules)' }}>{specialCount}</span></div>
          <div className="summary-item"><span className="summary-item-label">ห้ามแนบลิงก์</span><span className="summary-item-value" style={{ color: 'var(--status-blocked)' }}>{noLinkCount}</span></div>
          <div className="summary-item"><span className="summary-item-label">เร็วเกินไป</span><span className="summary-item-value" style={{ color: 'var(--status-blocked)' }}>{tooSoonCount}</span></div>
        </div>

        {hasWarning && (
          <div className="disclaimer-banner" style={{ borderColor: 'rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.08)' }}>
            <span className="disclaimer-icon">⚠️</span>
            <div>
              <strong style={{ color: 'var(--status-rules)' }}>พบกลุ่มที่มีข้อจำกัด!</strong>
              <div className="text-xs text-secondary mt-1">บางกลุ่มมีกฎห้ามแนบลิงก์หรืออยู่ใน Cooldown โปรดอ่านกฎกลุ่มก่อนโพสต์</div>
            </div>
          </div>
        )}

        <div className="form-group mt-2">
          <label className="form-label">เลือกแคมเปญที่จะเพิ่ม</label>
          <select className="form-select" value={targetCampaign} onChange={(e) => setTargetCampaign(e.target.value)}>
            <option value="">— เลือกแคมเปญ —</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </Modal>
    </div>
  );
}
