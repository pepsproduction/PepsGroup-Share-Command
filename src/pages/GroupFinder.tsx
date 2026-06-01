import { useState } from 'react';
import type { Group, QualityScore } from '../types';
import { groupStorage } from '../lib/storage';
import { buildFbGroupSearchUrl, openInNewTab, isFbGroupUrl } from '../lib/facebook';
import { useNotifications } from '../components/NotificationCenter';
import { isoNow } from '../lib/date';

const DEFAULT_FORM: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  url: '',
  category: '',
  keywords: [],
  memberCountNote: '',
  requiresAdminApproval: false,
  approvalAvgHours: 24,
  allowLinks: true,
  allowSalesPost: false,
  rulesNote: '',
  qualityScore: 'B',
  lastPostedAt: null,
  cooldownDays: 7,
  isBlacklisted: false,
};

export function GroupFinder() {
  const { addNotification } = useNotifications();
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [keywordsText, setKeywordsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function handleSearch() {
    if (!keyword.trim()) return;
    openInNewTab(buildFbGroupSearchUrl(keyword));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'กรุณากรอกชื่อกลุ่ม';
    if (!form.url.trim()) e.url = 'กรุณากรอก URL กลุ่ม';
    else if (!isFbGroupUrl(form.url)) e.url = 'URL ไม่ถูกต้อง ควรเป็น facebook.com/groups/...';
    if (!form.category.trim()) e.category = 'กรุณาเลือกหมวดหมู่';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    // Check duplicate
    const existing = groupStorage.findByUrl(form.url);
    if (existing) {
      addNotification('warning', 'พบข้อมูลซ้ำ', `กลุ่ม "${existing.name}" มี URL นี้อยู่แล้ว`);
      return;
    }

    const now = isoNow();
    const group: Group = {
      ...form,
      id: `grp_${Date.now()}`,
      keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    };
    groupStorage.add(group);
    addNotification('success', 'บันทึกกลุ่มสำเร็จ', `เพิ่ม "${group.name}" เรียบร้อย`);
    setForm({ ...DEFAULT_FORM });
    setKeywordsText('');
    setErrors({});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const categories = ['กีฬา', 'ฟุตบอล', 'บาสเกตบอล', 'ช่างภาพ', 'ไลฟ์สด', 'อีเวนต์', 'ดนตรี', 'อาหาร', 'ท่องเที่ยว', 'เทคโนโลยี', 'ธุรกิจ', 'การศึกษา', 'ชุมชน', 'อื่นๆ'];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Group Finder</h1>
        <p className="page-subtitle">ค้นหากลุ่ม Facebook และบันทึกข้อมูลกลุ่ม</p>
      </div>

      {/* Search Section */}
      <div className="section">
        <div className="section-title">🔍 ค้นหากลุ่ม Facebook</div>
        <div className="card">
          <p className="text-sm text-secondary mb-2">
            ใส่ keyword เพื่อเปิด Facebook Search Groups ในแท็บใหม่ แล้วนำ URL กลุ่มที่พบมาบันทึกด้านล่าง
          </p>
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            <input
              id="keyword-search"
              className="form-input"
              style={{ flex: 1, minWidth: '200px' }}
              placeholder="เช่น ฟุตบอล, ช่างภาพ, ไลฟ์สด, OBS..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label="คีย์เวิร์ดค้นหากลุ่ม"
            />
            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={!keyword.trim()}
              aria-label="ค้นหาบน Facebook"
            >
              🔍 ค้นหาบน Facebook
            </button>
          </div>
          <div className="disclaimer-banner mt-2" style={{ marginBottom: 0 }}>
            <span className="disclaimer-icon">ℹ️</span>
            <span>การกดค้นหาจะเปิดแท็บใหม่ไปยัง Facebook Search Groups เท่านั้น เว็บนี้ไม่ได้เข้าถึง Facebook โดยตรง</span>
          </div>
        </div>
      </div>

      {/* Save Group Form */}
      <div className="section">
        <div className="section-title">💾 บันทึกข้อมูลกลุ่ม</div>
        <div className="card">
          {saved && (
            <div className="disclaimer-banner mb-2" style={{ borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)' }}>
              <span className="disclaimer-icon">✅</span>
              <strong style={{ color: 'var(--status-ready)' }}>บันทึกกลุ่มเรียบร้อย!</strong>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="grp-name">ชื่อกลุ่ม *</label>
              <input
                id="grp-name"
                className="form-input"
                placeholder="ชื่อกลุ่ม Facebook"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-required
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="grp-url">URL กลุ่ม *</label>
              <input
                id="grp-url"
                className="form-input"
                placeholder="https://www.facebook.com/groups/..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                aria-required
              />
              {errors.url && <span className="form-error">{errors.url}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="grp-cat">หมวดหมู่ *</label>
              <select
                id="grp-cat"
                className="form-select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                aria-required
              >
                <option value="">— เลือกหมวดหมู่ —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <span className="form-error">{errors.category}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="grp-members">จำนวนสมาชิกโดยประมาณ</label>
              <input
                id="grp-members"
                className="form-input"
                placeholder="เช่น ประมาณ 15,000 คน"
                value={form.memberCountNote}
                onChange={(e) => setForm({ ...form, memberCountNote: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="grp-kw">Keywords (คั่นด้วยลูกน้ำ)</label>
            <input
              id="grp-kw"
              className="form-input"
              placeholder="เช่น ฟุตบอล, กีฬา, ภาคอีสาน"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
            />
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label" htmlFor="grp-score">คะแนนคุณภาพ</label>
              <select
                id="grp-score"
                className="form-select"
                value={form.qualityScore}
                onChange={(e) => setForm({ ...form, qualityScore: e.target.value as QualityScore })}
              >
                <option value="A">A — สูงมาก</option>
                <option value="B">B — ดี</option>
                <option value="C">C — ปานกลาง</option>
                <option value="D">D — ต่ำ</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="grp-cooldown">Cooldown (วัน)</label>
              <input
                id="grp-cooldown"
                type="number"
                className="form-input"
                min={0}
                value={form.cooldownDays}
                onChange={(e) => setForm({ ...form, cooldownDays: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="grp-approval-hrs">เวลาอนุมัติเฉลี่ย (ชม.)</label>
              <input
                id="grp-approval-hrs"
                type="number"
                className="form-input"
                min={0}
                value={form.approvalAvgHours}
                onChange={(e) => setForm({ ...form, approvalAvgHours: Number(e.target.value) })}
                disabled={!form.requiresAdminApproval}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label className="form-check">
              <input
                type="checkbox"
                checked={form.requiresAdminApproval}
                onChange={(e) => setForm({ ...form, requiresAdminApproval: e.target.checked })}
                id="grp-admin"
              />
              <span className="form-check-label">ต้องรอแอดมินอนุมัติ</span>
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                checked={form.allowLinks}
                onChange={(e) => setForm({ ...form, allowLinks: e.target.checked })}
                id="grp-links"
              />
              <span className="form-check-label">อนุญาตให้แนบลิงก์</span>
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                checked={form.allowSalesPost}
                onChange={(e) => setForm({ ...form, allowSalesPost: e.target.checked })}
                id="grp-sales"
              />
              <span className="form-check-label">อนุญาตโพสต์ขายของ</span>
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                checked={form.isBlacklisted}
                onChange={(e) => setForm({ ...form, isBlacklisted: e.target.checked })}
                id="grp-black"
              />
              <span className="form-check-label">Blacklist</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="grp-rules">หมายเหตุกฎกลุ่ม</label>
            <textarea
              id="grp-rules"
              className="form-textarea"
              placeholder="บันทึกกฎหรือข้อสังเกตของกลุ่มนี้..."
              value={form.rulesNote}
              onChange={(e) => setForm({ ...form, rulesNote: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              onClick={() => { setForm({ ...DEFAULT_FORM }); setKeywordsText(''); setErrors({}); }}
            >
              ล้างข้อมูล
            </button>
            <button className="btn btn-primary" onClick={handleSave} aria-label="บันทึกกลุ่ม">
              💾 บันทึกกลุ่ม
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
