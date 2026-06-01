import { useState, useCallback } from 'react';
import type { Campaign, CampaignStatus, CampaignObjective } from '../types';
import { campaignStorage, postStorage, groupStorage, queueStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationCenter';
import { CampaignStatusBadge } from '../components/Badge';
import { ConfirmModal, Modal } from '../components/Modal';
import { formatDate, isoNow } from '../lib/date';
import type { ShareQueueItem } from '../types';

const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  promote_live_sport: '⚽ โปรโมทไลฟ์กีฬา',
  photography: '📸 ถ่ายภาพ/ช่างภาพ',
  event: '🎉 งานอีเวนต์',
  pepslive_web: '🌐 เว็บ PepsLive',
  other: '📌 อื่นๆ',
};

const DEFAULT_FORM = {
  name: '',
  objective: 'promote_live_sport' as CampaignObjective,
  objectiveNote: '',
  postId: '',
  selectedGroupIds: [] as string[],
  status: 'draft' as CampaignStatus,
  scheduledAt: '',
};

export function CampaignBuilder() {
  const { addNotification } = useNotifications();
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => campaignStorage.getAll());
  const [posts] = useState(() => postStorage.getAll());
  const [groups] = useState(() => groupStorage.getAll());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);

  const reload = useCallback(() => setCampaigns(campaignStorage.getAll()), []);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'กรุณากรอกชื่อแคมเปญ';
    if (!form.postId) e.postId = 'กรุณาเลือกโพสต์';
    if (form.selectedGroupIds.length === 0) e.groups = 'กรุณาเลือกอย่างน้อย 1 กลุ่ม';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleCreate() {
    if (!validate()) return;
    const now = isoNow();
    const campaign: Campaign = {
      id: `camp_${Date.now()}`,
      ...form,
      scheduledAt: form.scheduledAt || null,
      createdAt: now,
      updatedAt: now,
    };
    campaignStorage.add(campaign);

    // Create queue items
    const qItems: ShareQueueItem[] = form.selectedGroupIds.map((groupId) => ({
      id: `qi_${Date.now()}_${groupId}`,
      campaignId: campaign.id,
      postId: form.postId,
      groupId,
      scheduledAt: form.scheduledAt || null,
      status: 'not_started',
      submittedAt: null,
      approvedAt: null,
      rejectedAt: null,
      note: '',
      createdAt: now,
      updatedAt: now,
    }));
    queueStorage.addMany(qItems);

    addNotification('success', 'สร้างแคมเปญสำเร็จ', `"${campaign.name}" พร้อมแล้ว ${qItems.length} กลุ่ม`);
    setForm({ ...DEFAULT_FORM });
    setShowForm(false);
    reload();
  }

  function handleDelete(id: string) {
    campaignStorage.delete(id);
    queueStorage.deleteByCampaign(id);
    addNotification('info', 'ลบแคมเปญแล้ว', 'ลบแคมเปญและคิวที่เกี่ยวข้องออกแล้ว');
    reload();
  }

  function toggleGroup(id: string) {
    setForm((prev) => ({
      ...prev,
      selectedGroupIds: prev.selectedGroupIds.includes(id)
        ? prev.selectedGroupIds.filter((g) => g !== id)
        : [...prev.selectedGroupIds, id],
    }));
  }

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Campaign Builder</h1>
          <p className="page-subtitle">สร้างและจัดการแคมเปญการแชร์</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>🚀 สร้างแคมเปญใหม่</button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🚀</div>
            <div className="empty-state-title">ยังไม่มีแคมเปญ</div>
            <div className="empty-state-desc">สร้างแคมเปญแรกเพื่อเริ่มวางแผนการแชร์โพสต์</div>
            <button className="btn btn-primary mt-2" onClick={() => setShowForm(true)}>สร้างแคมเปญ</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {campaigns.map((c) => {
            const cQueue = queueStorage.getByCampaign(c.id);
            const done = cQueue.filter((q) => ['posted', 'approved', 'completed', 'lead_received'].includes(q.status)).length;
            const post = postStorage.getById(c.postId);
            return (
              <div key={c.id} className="card card-lift">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-bold" style={{ fontSize: '1.05rem' }}>{c.name}</div>
                    <div className="text-xs text-muted mt-1">
                      {OBJECTIVE_LABELS[c.objective]} · สร้าง {formatDate(c.createdAt)}
                      {c.scheduledAt && ` · กำหนด ${formatDate(c.scheduledAt)}`}
                    </div>
                  </div>
                  <CampaignStatusBadge status={c.status} />
                </div>

                {post && (
                  <div className="text-sm text-secondary mb-2">
                    📝 โพสต์: <strong>{post.title}</strong>
                  </div>
                )}

                {cQueue.length > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>ความคืบหน้า</span>
                      <span>{done}/{cQueue.length} กลุ่ม</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(done / cQueue.length) * 100}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setViewCampaign(c)}>
                    👁️ รายละเอียด
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(c.id)}>
                    🗑️ ลบ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setErrors({}); }} title="สร้างแคมเปญใหม่" size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleCreate}>🚀 สร้างแคมเปญ</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ชื่อแคมเปญ *</label>
            <input className="form-input" placeholder="เช่น โปรโมท PepsLive มิถุนายน" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">วัตถุประสงค์</label>
            <select className="form-select" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value as CampaignObjective })}>
              {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">โพสต์ที่จะใช้ *</label>
            <select className="form-select" value={form.postId} onChange={(e) => setForm({ ...form, postId: e.target.value })}>
              <option value="">— เลือกโพสต์ —</option>
              {posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {errors.postId && <span className="form-error">{errors.postId}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">วันที่กำหนด (ไม่บังคับ)</label>
            <input type="datetime-local" className="form-input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">หมายเหตุวัตถุประสงค์</label>
          <input className="form-input" placeholder="รายละเอียดเพิ่มเติม..." value={form.objectiveNote} onChange={(e) => setForm({ ...form, objectiveNote: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">เลือกกลุ่ม * ({form.selectedGroupIds.length} กลุ่มที่เลือก)</label>
          {errors.groups && <span className="form-error">{errors.groups}</span>}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, selectedGroupIds: groups.map((g) => g.id) })}>เลือกทั้งหมด</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, selectedGroupIds: groups.filter((g) => g.qualityScore === 'A' || g.qualityScore === 'B').map((g) => g.id) })}>A+B เท่านั้น</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, selectedGroupIds: [] })}>ล้างทั้งหมด</button>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {groups.length === 0 ? (
              <div className="text-sm text-muted">ยังไม่มีกลุ่ม กรุณาเพิ่มกลุ่มก่อน</div>
            ) : (
              groups.map((g) => (
                <label key={g.id} className="form-check" style={{ background: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.selectedGroupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{g.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {g.category} · {g.qualityScore} Grade · {g.requiresAdminApproval ? 'รอแอดมิน' : 'โพสต์ได้'} {!g.allowLinks ? '· ห้ามลิงก์' : ''}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} title="ลบแคมเปญ" message="แน่ใจหรือไม่? การกระทำนี้จะลบแคมเปญและคิวที่เกี่ยวข้องทั้งหมด" confirmLabel="ลบแคมเปญ" danger />

      {/* View Campaign */}
      {viewCampaign && (
        <Modal isOpen onClose={() => setViewCampaign(null)} title={viewCampaign.name} size="lg" footer={<button className="btn btn-ghost" onClick={() => setViewCampaign(null)}>ปิด</button>}>
          <div className="text-sm text-secondary mb-1">วัตถุประสงค์: {OBJECTIVE_LABELS[viewCampaign.objective]}</div>
          {viewCampaign.objectiveNote && <div className="text-sm text-muted mb-1">{viewCampaign.objectiveNote}</div>}
          <div className="text-sm text-secondary mb-2">สร้าง: {formatDate(viewCampaign.createdAt)}</div>
          <div className="section-title">กลุ่มที่เลือก ({viewCampaign.selectedGroupIds.length} กลุ่ม)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {viewCampaign.selectedGroupIds.map((gid) => {
              const g = groups.find((gr) => gr.id === gid);
              if (!g) return null;
              return (
                <div key={gid} style={{ background: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <span className="font-bold">{g.name}</span>
                  <span className="text-muted ml-1">· {g.qualityScore} · {g.category}</span>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
