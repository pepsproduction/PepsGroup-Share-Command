import { useState } from 'react';
import type { Lead, ShareQueueItem, ShareItemStatus } from '../types';
import { queueStorage, campaignStorage, groupStorage, postStorage, leadStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationContexts';
import { ShareStatusBadge, GroupStatusBadge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { openGroupAndSendCaptionToHelper } from '../lib/facebook';
import { computeSessionSummary, summaryToText } from '../lib/summary';
import { isoNow } from '../lib/date';
import { exportQueueCsv, downloadFile, downloadJson } from '../lib/exporters';
import { buildGroupAwareCaption } from '../lib/automation';
import { createId } from '../lib/ids';

const DEFAULT_LEAD_FORM = {
  customerName: '',
  contactNote: '',
  serviceInterest: '',
  valueEstimate: '',
};

function copyTextToClipboard(text: string): Promise<void> {
  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  };

  if (fallbackCopy()) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    return Promise.resolve();
  }

  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('Copy failed'));
}

export function ShareSession() {
  const { addNotification } = useNotifications();
  const [campaigns] = useState(() => campaignStorage.getAll());
  const [groups] = useState(() => groupStorage.getAll());
  const [posts] = useState(() => postStorage.getAll());
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [queueItems, setQueueItems] = useState<ShareQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ ...DEFAULT_LEAD_FORM });

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const postMap = new Map(posts.map((p) => [p.id, p]));

  function handleCampaignChange(campaignId: string) {
    setSelectedCampaign(campaignId);
    setQueueItems(campaignId ? queueStorage.getByCampaign(campaignId) : []);
    setCurrentIndex(0);
    setShowSummary(false);
  }

  function startSession() {
    if (!selectedCampaign) return;
    const items = queueStorage.getByCampaign(selectedCampaign).filter((q) => q.status === 'not_started');
    if (items.length === 0) {
      addNotification('warning', 'ไม่มีคิวที่ยังไม่เริ่ม', 'แคมเปญนี้ไม่มีรายการที่ยังไม่เริ่มแชร์');
      return;
    }
    setQueueItems(items);
    setCurrentIndex(0);
    setIsActive(true);
    addNotification('info', 'เริ่ม Share Session', `${items.length} กลุ่ม พร้อมแชร์`);
  }

  function updateStatus(status: ShareItemStatus, options?: { skipLeadPrompt?: boolean; noteOverride?: string }) {
    if (status === 'lead_received' && !options?.skipLeadPrompt) {
      setLeadForm({ ...DEFAULT_LEAD_FORM, contactNote: noteText });
      setShowLeadForm(true);
      return;
    }

    const item = queueItems[currentIndex];
    if (!item) return;
    const now = isoNow();
    const updated: ShareQueueItem = {
      ...item,
      status,
      note: options?.noteOverride || noteText || item.note,
      submittedAt: status === 'posted' || status === 'pending_admin' ? now : item.submittedAt,
      approvedAt: status === 'approved' ? now : item.approvedAt,
      rejectedAt: status === 'rejected' ? now : item.rejectedAt,
      updatedAt: now,
    };
    queueStorage.update(updated);

    const statusMessages: Record<string, string> = {
      posted: 'โพสต์สำเร็จ',
      pending_admin: 'รอแอดมินอนุมัติ',
      skipped: 'ข้ามกลุ่มนี้',
      failed: 'โพสต์ไม่ได้',
      lead_received: 'บันทึก: มีลูกค้าทัก',
    };
    const group = groupMap.get(item.groupId);
    addNotification('success', `บันทึกสถานะ: ${statusMessages[status] || status}`, `กลุ่ม ${group?.name || ''}`);

    // update lastPostedAt if posted
    if ((status === 'posted' || status === 'pending_admin') && group) {
      groupStorage.update({ ...group, lastPostedAt: now, updatedAt: now });
    }

    setNoteText('');

    // Move to next
    const next = currentIndex + 1;
    if (next >= queueItems.length) {
      // all done
      const allItems = queueStorage.getByCampaign(selectedCampaign);
      setQueueItems(allItems);
      setShowSummary(true);
      setIsActive(false);
    } else {
      setCurrentIndex(next);
      const updatedItems = [...queueItems];
      updatedItems[currentIndex] = updated;
      setQueueItems(updatedItems);
    }
  }

  const currentItem = isActive ? queueItems[currentIndex] : null;
  const currentGroup = currentItem ? groupMap.get(currentItem.groupId) : null;
  const currentPost = currentItem ? postMap.get(currentItem.postId) : null;
  const currentCaption = currentGroup && currentPost ? buildGroupAwareCaption(currentPost, currentGroup) : '';
  const summary = computeSessionSummary(queueItems);

  function copyCaption() {
    if (!currentCaption) return;
    copyTextToClipboard(currentCaption).then(() => addNotification('success', 'คัดลอก Caption สำเร็จ!', ''));
  }

  async function handleOpenAndCopy() {
    if (!currentCaption || !currentGroup) return;
    const copyPromise = copyTextToClipboard(currentCaption);
    const openResult = await openGroupAndSendCaptionToHelper(currentCaption, currentGroup.url, 'pgsc_share_session_fb_tab');

    copyPromise
      .then(() => {
        const detail = openResult.openedByHelper
          ? 'PGSC Helper เปิดกลุ่มในแท็บ Facebook เดิมและจะวางแคปชั่นให้เอง'
          : 'เปิดกลุ่มในแท็บ Facebook เดิมแล้ว หากติดตั้ง PGSC Helper ระบบจะวางให้เอง';
        addNotification('success', 'คัดลอก Caption สำเร็จ!', detail);
      })
      .catch((err) => {
        const detail = openResult.openedByHelper
          ? 'Clipboard ไม่อนุญาต แต่ PGSC Helper จะวางแคปชั่นให้บน Facebook'
          : openResult.opened
          ? 'เปิดกลุ่มแล้ว แต่ Clipboard ไม่อนุญาตให้คัดลอกอัตโนมัติ'
          : 'ไม่สามารถเปิดแท็บ Facebook ได้ กรุณาอนุญาต popup และลองอีกครั้ง';
        addNotification('warning', 'Clipboard ไม่อนุญาต', detail || String(err));
      });
  }

  function saveLeadAndAdvance() {
    const item = queueItems[currentIndex];
    if (!item) return;
    const group = groupMap.get(item.groupId);
    const now = isoNow();
    const lead: Lead = {
      id: createId('lead'),
      campaignId: item.campaignId,
      groupId: item.groupId,
      customerName: leadForm.customerName.trim() || `Lead จาก ${group?.name || item.groupId}`,
      contactNote: leadForm.contactNote.trim() || noteText,
      serviceInterest: leadForm.serviceInterest.trim(),
      valueEstimate: leadForm.valueEstimate.trim(),
      status: 'new',
      createdAt: now,
    };
    leadStorage.add(lead);
    setShowLeadForm(false);
    setLeadForm({ ...DEFAULT_LEAD_FORM });
    updateStatus('lead_received', {
      skipLeadPrompt: true,
      noteOverride: lead.contactNote || 'มีลูกค้าทัก',
    });
  }

  function handleExportCsv() {
    const campaign = campaigns.find((c) => c.id === selectedCampaign);
    const csv = exportQueueCsv(queueItems, campaign);
    downloadFile(csv, `share-session-${selectedCampaign}.csv`);
    addNotification('success', 'Export CSV สำเร็จ', '');
  }

  function handleExportJson() {
    downloadJson(queueItems, `share-session-${selectedCampaign}.json`);
    addNotification('success', 'Export JSON สำเร็จ', '');
  }

  function copySummary() {
    const campaign = campaigns.find((c) => c.id === selectedCampaign);
    const text = summaryToText(summary, campaign?.name);
    copyTextToClipboard(text).then(() => addNotification('success', 'คัดลอกสรุปแล้ว', ''));
  }

  // If not active, show setup
  if (!isActive) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Share Session</h1>
          <p className="page-subtitle">เริ่ม Session เพื่อแชร์โพสต์ลงกลุ่มทีละกลุ่ม</p>
        </div>

        <div className="disclaimer-banner">
          <span className="disclaimer-icon">🛡️</span>
          <div>
            <strong style={{ color: 'var(--accent-text)' }}>คุณต้องเป็นผู้กดโพสต์เองทุกครั้ง</strong>
            {' '}ระบบนี้จะเปิดแท็บกลุ่มให้เท่านั้น ไม่มีการโพสต์อัตโนมัติ
          </div>
        </div>

        <div className="card" style={{ maxWidth: '560px' }}>
          <div className="section-title">🚀 เลือกแคมเปญที่จะแชร์</div>
          <div className="form-group">
            <label className="form-label">แคมเปญ</label>
            <select className="form-select" value={selectedCampaign} onChange={(e) => handleCampaignChange(e.target.value)}>
              <option value="">— เลือกแคมเปญ —</option>
              {campaigns.map((c) => {
                const pending = queueStorage.getByCampaign(c.id).filter((q) => q.status === 'not_started').length;
                return <option key={c.id} value={c.id}>{c.name} ({pending} รายการรอ)</option>;
              })}
            </select>
          </div>
          {selectedCampaign && (
            <div className="text-sm text-secondary mb-2">
              คิวรอแชร์: {queueStorage.getByCampaign(selectedCampaign).filter((q) => q.status === 'not_started').length} กลุ่ม
            </div>
          )}
          <button
            className="btn btn-primary w-full"
            onClick={startSession}
            disabled={!selectedCampaign}
          >
            ▶️ เริ่ม Share Session
          </button>
        </div>
      </div>
    );
  }

  const progress = currentIndex + 1;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Share Session</h1>
        <p className="page-subtitle" style={{ color: 'var(--accent-text)' }}>
          กลุ่มที่ {progress} จาก {queueItems.length}
        </p>
      </div>

      {/* Progress */}
      <div className="session-progress">
        <div className="session-progress-label">
          <span>ความคืบหน้า</span>
          <span>{progress} / {queueItems.length}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(progress / queueItems.length) * 100}%` }} />
        </div>
      </div>

      {currentGroup && currentPost && (
        <div className="session-card">
          {/* Group Info */}
          <div className="mb-2">
            <div className="session-group-name">{currentGroup.name}</div>
            <div className="session-group-url">{currentGroup.url}</div>
          </div>

          <div className="flex gap-1" style={{ flexWrap: 'wrap', marginBottom: '1rem' }}>
            <GroupStatusBadge group={currentGroup} />
            {!currentGroup.allowLinks && <span className="badge badge-blocked">🚫 ห้ามลิงก์</span>}
            {currentGroup.allowSalesPost && <span className="badge badge-accent">ขายได้</span>}
            <span className="badge badge-skipped">{currentGroup.category}</span>
            <ShareStatusBadge status={currentItem!.status} />
          </div>

          {currentGroup.rulesNote && (
            <div className="disclaimer-banner mb-2" style={{ marginBottom: '1rem' }}>
              <span className="disclaimer-icon">📋</span>
              <span>{currentGroup.rulesNote}</span>
            </div>
          )}

          {/* Caption Preview */}
          <div className="section-title">📝 Caption</div>
          <div className="session-caption-box mb-2">
            {currentCaption}
          </div>
          <div className="flex gap-1 mb-2" style={{ flexWrap: 'wrap', width: '100%' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: '2 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: 'bold' }} 
              onClick={handleOpenAndCopy} 
              aria-label="เปิดกลุ่มและคัดลอกแคปชั่น"
            >
              🚀 เปิดกลุ่ม & คัดลอกแคปชั่น (ใช้แท็บเดิม)
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: '1 1 120px' }} 
              onClick={copyCaption}
              aria-label="คัดลอกแคปชั่น"
            >
              📋 คัดลอกแคปชั่น
            </button>
          </div>

          {/* Note */}
          <div className="form-group mb-2">
            <label className="form-label">หมายเหตุ (ไม่บังคับ)</label>
            <input className="form-input" placeholder="บันทึกสั้นๆ..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </div>

          {/* Status Buttons */}
          <div className="section-title">เลือกสถานะ</div>
          <div className="session-actions">
            <button className="btn btn-success" onClick={() => updateStatus('posted')}>✅ โพสต์แล้ว</button>
            <button className="btn btn-secondary" style={{ color: 'var(--status-pending)', borderColor: 'rgba(240,165,0,0.4)' }} onClick={() => updateStatus('pending_admin')}>⏳ รอแอดมิน</button>
            <button className="btn btn-ghost" onClick={() => updateStatus('skipped')}>⏭️ ข้าม</button>
            <button className="btn btn-danger" onClick={() => updateStatus('failed')}>🚫 โพสต์ไม่ได้</button>
            <button className="btn btn-secondary" style={{ color: 'var(--gold-text)', borderColor: 'rgba(240,165,0,0.3)' }} onClick={() => updateStatus('lead_received')}>💬 มีลูกค้าทัก</button>
          </div>
        </div>
      )}

      {currentItem && (!currentGroup || !currentPost) && (
        <div className="card">
          <div className="section-title">⚠️ ข้อมูลคิวไม่สมบูรณ์</div>
          <p className="text-sm text-secondary mb-2">
            รายการนี้อ้างถึง {currentGroup ? '' : 'กลุ่มที่ถูกลบ '} {currentPost ? '' : 'โพสต์ที่ถูกลบ '}
            ระบบยังให้ข้ามหรือบันทึกว่าโพสต์ไม่ได้เพื่อเดิน session ต่อได้
          </p>
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => updateStatus('skipped')}>ข้ามรายการนี้</button>
            <button className="btn btn-danger" onClick={() => updateStatus('failed')}>บันทึกว่าโพสต์ไม่ได้</button>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="🎉 แชร์โพสต์เสร็จแล้ว!" size="lg"
        footer={
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={copySummary}>📋 Copy สรุป</button>
            <button className="btn btn-secondary" onClick={handleExportCsv}>📊 Export CSV</button>
            <button className="btn btn-secondary" onClick={handleExportJson}>💾 Export JSON</button>
            <button className="btn btn-primary" onClick={() => { setShowSummary(false); setIsActive(false); }}>ปิด</button>
          </div>
        }
      >
        <div className="summary-grid">
          <div className="summary-item"><span className="summary-item-label">ทั้งหมด</span><span className="summary-item-value text-accent">{summary.total}</span></div>
          <div className="summary-item"><span className="summary-item-label">โพสต์สำเร็จ</span><span className="summary-item-value" style={{ color: 'var(--status-ready)' }}>{summary.posted}</span></div>
          <div className="summary-item"><span className="summary-item-label">รอแอดมิน</span><span className="summary-item-value" style={{ color: 'var(--status-pending)' }}>{summary.pendingAdmin}</span></div>
          <div className="summary-item"><span className="summary-item-label">อนุมัติแล้ว</span><span className="summary-item-value" style={{ color: 'var(--status-done)' }}>{summary.approved}</span></div>
          <div className="summary-item"><span className="summary-item-label">ข้าม</span><span className="summary-item-value" style={{ color: 'var(--status-skipped)' }}>{summary.skipped}</span></div>
          <div className="summary-item"><span className="summary-item-label">โพสต์ไม่ได้</span><span className="summary-item-value" style={{ color: 'var(--status-blocked)' }}>{summary.failed}</span></div>
          <div className="summary-item"><span className="summary-item-label">ลูกค้าทัก</span><span className="summary-item-value" style={{ color: 'var(--gold-text)' }}>{summary.leadReceived}</span></div>
        </div>
        <div className="disclaimer-banner" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <span className="disclaimer-icon">🛡️</span>
          <span>Session เสร็จสิ้น ตรวจสอบ Pending Approval เพื่อติดตามผลอนุมัติ</span>
        </div>
      </Modal>

      <Modal isOpen={showLeadForm} onClose={() => setShowLeadForm(false)} title="บันทึก Lead" size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowLeadForm(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={saveLeadAndAdvance}>บันทึก Lead และไปต่อ</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ชื่อลูกค้า / โปรไฟล์</label>
            <input className="form-input" value={leadForm.customerName} onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })} placeholder="เช่น คุณเอ, FB profile, เพจร้าน..." />
          </div>
          <div className="form-group">
            <label className="form-label">บริการที่สนใจ</label>
            <input className="form-input" value={leadForm.serviceInterest} onChange={(e) => setLeadForm({ ...leadForm, serviceInterest: e.target.value })} placeholder="เช่น ไลฟ์สด, ถ่ายภาพ, โปรโมทเว็บ..." />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">รายละเอียดการติดต่อ</label>
          <textarea className="form-textarea" rows={3} value={leadForm.contactNote} onChange={(e) => setLeadForm({ ...leadForm, contactNote: e.target.value })} placeholder="สรุปว่าลูกค้าทักเรื่องอะไร ต้อง follow-up อะไรต่อ..." />
        </div>
        <div className="form-group">
          <label className="form-label">มูลค่าประเมิน</label>
          <input className="form-input" value={leadForm.valueEstimate} onChange={(e) => setLeadForm({ ...leadForm, valueEstimate: e.target.value })} placeholder="เช่น 5,000 บาท, ยังไม่ทราบ" />
        </div>
      </Modal>
    </div>
  );
}
