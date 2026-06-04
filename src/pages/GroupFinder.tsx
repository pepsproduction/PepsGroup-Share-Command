import { useState } from 'react';
import type { Group, QualityScore } from '../types';
import { groupStorage } from '../lib/storage';
import { buildFbGroupSearchUrl, openInNewTab, isFbGroupUrl, parseFbGroupsFromHtml, parseFbGroupsFromText, guessCategoryByName, guessMemberCount, normalizeFbGroupUrl } from '../lib/facebook';
import { useNotifications } from '../components/NotificationContexts';
import { isoNow } from '../lib/date';

interface ImportItem {
  id: string;
  name: string;
  url: string;
  category: string;
  memberCountNote: string;
  isDuplicate: boolean;
}

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
  cooldownDays: 0,
  isBlacklisted: false,
};

export function GroupFinder() {
  const { addNotification } = useNotifications();
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [keywordsText, setKeywordsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Smart Import state
  const [activeTab, setActiveTab] = useState<'manual' | 'smart'>('manual');
  const [pastedText, setPastedText] = useState('');
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');


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

    const normalizedUrl = normalizeFbGroupUrl(form.url);

    // Check duplicate
    const existing = groupStorage.findByUrl(normalizedUrl);
    if (existing) {
      addNotification('warning', 'พบข้อมูลซ้ำ', `กลุ่ม "${existing.name}" มี URL นี้อยู่แล้ว`);
      return;
    }

    const now = isoNow();
    const group: Group = {
      ...form,
      url: normalizedUrl,
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

  // Handle paste in Smart Import area
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    let parsed: Array<{ name: string; url: string; memberCount?: string }> = [];
    if (html) {
      parsed = parseFbGroupsFromHtml(html);
    }
    if (parsed.length === 0 && text) {
      parsed = parseFbGroupsFromText(text);
    }

    if (parsed.length === 0) {
      addNotification('warning', 'ไม่พบกลุ่ม Facebook', 'ไม่พบลิงก์กลุ่ม Facebook ในข้อมูลที่วาง กรุณาลองตรวจสอบเนื้อหาที่คัดลอกมา');
      return;
    }

    const existingGroups = groupStorage.getAll();
    const items: ImportItem[] = parsed.map((p, idx) => {
      const isDup = existingGroups.some((g) => g.url.toLowerCase() === p.url.toLowerCase());
      return {
        id: `imp_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        name: p.name,
        url: p.url,
        category: guessCategoryByName(p.name),
        memberCountNote: p.memberCount || guessMemberCount(p.name),
        isDuplicate: isDup,
      };
    });

    setImportItems(items);
    // select all non-duplicates by default
    const nonDups = items.filter((i) => !i.isDuplicate).map((i) => i.id);
    setSelectedIds(new Set(nonDups));
    addNotification('success', 'สแกนสำเร็จ', `พบกลุ่มทั้งหมด ${items.length} กลุ่ม (กลุ่มใหม่พร้อมเลือก ${nonDups.length} กลุ่ม)`);
  }

  // Handle manual scanning of typed/pasted text
  function handleScanText() {
    if (!pastedText.trim()) {
      addNotification('warning', 'ไม่มีข้อมูล', 'กรุณาวางข้อความหรือข้อมูลในกล่องข้อความก่อนสแกน');
      return;
    }

    const parsed = parseFbGroupsFromText(pastedText);
    if (parsed.length === 0) {
      addNotification('warning', 'ไม่พบกลุ่ม Facebook', 'ไม่พบข้อมูลกลุ่มหรือลิงก์กลุ่มในกล่องข้อความ');
      return;
    }

    const existingGroups = groupStorage.getAll();
    const items: ImportItem[] = parsed.map((p, idx) => {
      const isDup = existingGroups.some((g) => g.url.toLowerCase() === p.url.toLowerCase());
      return {
        id: `imp_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        name: p.name,
        url: p.url,
        category: guessCategoryByName(p.name),
        memberCountNote: p.memberCount || guessMemberCount(p.name),
        isDuplicate: isDup,
      };
    });

    setImportItems(items);
    const nonDups = items.filter((i) => !i.isDuplicate).map((i) => i.id);
    setSelectedIds(new Set(nonDups));
    addNotification('success', 'สแกนสำเร็จ', `พบกลุ่มทั้งหมด ${items.length} กลุ่ม (กลุ่มใหม่พร้อมเลือก ${nonDups.length} กลุ่ม)`);
  }

  // Bookmarklet Javascript string
  const bookmarkletCode = `javascript:(function(){const buttons=Array.from(document.querySelectorAll('span,div,[role="button"]')).filter(el=>{const txt=el.innerText||'';return txt==='See more'||txt==='ดูเพิ่มเติม'||txt==='แสดงเพิ่มเติม'||txt==='See More';});buttons.forEach(btn=>btn.click());const links=Array.from(document.querySelectorAll('a[href*="/groups/"]'));const groups=[];const seen=new Set();links.forEach(a=>{const href=a.href;const match=href.match(/\\\\/groups\\\\/([^\\\\/?#]+)/);if(match){const groupId=match[1];if(['feed','search','discover','joins','create','categories'].includes(groupId.toLowerCase()))return;const url='https://www.facebook.com/groups/'+groupId+'/';if(!seen.has(url)){seen.add(url);let name=a.innerText.trim();if(!name&&a.querySelector('span')){name=a.querySelector('span').innerText.trim();}if(name){name=name.split('\\n')[0].trim();}if(name&&name!=='Groups'&&name.length>2){let memberCount='';let parent=a.parentElement;for(let i=0;i<5&&parent;i++){const text=parent.innerText||'';const mMatch=text.match(/(?:สมาชิก|members?)\\s*([0-9\\.,kKหมื่นแสนล้าน\\s]+)/i);if(mMatch){memberCount=mMatch[0].split('\\n')[0].trim();break;}parent=parent.parentElement;}groups.push({name,url,memberCount});}}}});if(groups.length===0){alert('ไม่พบกลุ่มในหน้านี้ กรุณาเลื่อนเมนูด้านซ้ายลงมาล่างสุด และตรวจดูว่าอยู่ในหน้า https://www.facebook.com/groups/');return;}const json=JSON.stringify(groups,null,2);const el=document.createElement('textarea');el.value=json;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);alert('ดึงข้อมูลสำเร็จ! พบ '+groups.length+' กลุ่ม และคัดลอกข้อมูลลง Clipboard แล้ว\\n\\nกรุณากลับไปที่เว็บ PepsGroup Share Command และกดวางในช่องนำเข้ากลุ่ม');})();`;

  function copyBookmarklet() {
    navigator.clipboard.writeText(bookmarkletCode).then(() => {
      addNotification('success', 'คัดลอกสำเร็จ', 'คัดลอกโค้ด Bookmarklet เรียบร้อยแล้ว! ดูวิธีการใช้งานด้านล่าง');
    }).catch(() => {
      addNotification('error', 'ล้มเหลว', 'ไม่สามารถคัดลอกลง Clipboard อัตโนมัติได้');
    });
  }

  // Set category for all selected items
  function handleBulkCategoryChange(cat: string) {
    setBulkCategory(cat);
    if (!cat) return;
    const updated = importItems.map((item) => {
      if (selectedIds.has(item.id)) {
        return { ...item, category: cat };
      }
      return item;
    });
    setImportItems(updated);
  }

  // Toggle selection for a single item
  function toggleSelectItem(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  // Toggle select all checkbox
  function toggleSelectAll() {
    if (selectedIds.size === importItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(importItems.map((item) => item.id)));
    }
  }

  // Save selected groups in bulk
  function handleImportSave() {
    const selected = importItems.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) {
      addNotification('warning', 'กรุณาเลือกกลุ่ม', 'กรุณาเลือกอย่างน้อย 1 กลุ่มเพื่อนำเข้า');
      return;
    }

    const missingCategory = selected.filter((s) => !s.category);
    if (missingCategory.length > 0) {
      addNotification('error', 'หมวดหมู่ไม่ครบ', `กรุณาเลือกหมวดหมู่ให้ครบถ้วน (${missingCategory.length} กลุ่มยังไม่ได้เลือกหมวดหมู่)`);
      return;
    }

    const now = isoNow();
    let importedCount = 0;
    
    selected.forEach((item) => {
      const normalizedUrl = normalizeFbGroupUrl(item.url);
      
      // Final duplication safeguard
      const existing = groupStorage.findByUrl(normalizedUrl);
      if (existing) return;

      const group: Group = {
        id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: item.name.trim(),
        url: normalizedUrl,
        category: item.category,
        keywords: [],
        memberCountNote: item.memberCountNote.trim(),
        requiresAdminApproval: false,
        approvalAvgHours: 24,
        allowLinks: true,
        allowSalesPost: false,
        rulesNote: 'นำเข้ากลุ่มผ่านระบบอัจฉริยะ',
        qualityScore: 'B',
        lastPostedAt: null,
        cooldownDays: 0,
        isBlacklisted: false,
        createdAt: now,
        updatedAt: now,
      };

      groupStorage.add(group);
      importedCount++;
    });

    addNotification('success', 'นำเข้ากลุ่มสำเร็จ', `นำเข้ากลุ่มสำเร็จเสร็จสิ้นจำนวน ${importedCount} กลุ่ม!`);
    setImportItems([]);
    setSelectedIds(new Set());
    setPastedText('');
  }

  const categories = ['กีฬา', 'ฟุตบอล', 'บาสเกตบอล', 'ช่างภาพ', 'ไลฟ์สด', 'อีเวนต์', 'ดนตรี', 'อาหาร', 'ท่องเที่ยว', 'เทคโนโลยี', 'ธุรกิจ', 'การศึกษา', 'ชุมชน', 'อื่นๆ'];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Group Finder</h1>
        <p className="page-subtitle">ค้นหากลุ่ม Facebook และบันทึกข้อมูลกลุ่มอย่างรวดเร็ว</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('manual')}
          style={{ borderRadius: '6px' }}
        >
          🔍 ค้นหาและบันทึกทั่วไป
        </button>
        <button
          className={`btn ${activeTab === 'smart' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('smart')}
          style={{ borderRadius: '6px' }}
          id="btn-smart-import-tab"
        >
          ✨ นำเข้ากลุ่มอัจฉริยะ (Smart Import)
        </button>
      </div>

      {activeTab === 'manual' ? (
        <>
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
                  <label className="form-label" htmlFor="grp-cooldown">Cooldown (วัน, 0 = ไม่มี)</label>
                  <input
                    id="grp-cooldown"
                    type="number"
                    className="form-input"
                    min={0}
                    value={form.cooldownDays}
                    onChange={(e) => setForm({ ...form, cooldownDays: Math.max(0, Number(e.target.value) || 0) })}
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
        </>
      ) : (
        /* Smart Import View */
        <div className="section">
          {/* Instruction cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card card-glass">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-text)', marginBottom: '0.5rem' }}>
                วิธีที่ 1: คัดลอกและวางแบบเร็ว (Easy HTML Copy-Paste)
              </h3>
              <ol style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: '1.5' }}>
                <li>เปิดแท็บใหม่ไปที่หน้า <a href="https://www.facebook.com/groups/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Facebook Groups (กลุ่มทั้งหมด)</a></li>
                <li>กด <strong>Ctrl + A</strong> (เลือกทั้งหมดบนหน้าเว็บ)</li>
                <li>กด <strong>Ctrl + C</strong> (คัดลอกทั้งหมด)</li>
                <li>กลับมาที่หน้านี้ คลิกในกล่องข้อความด้านล่างแล้วกด <strong>Ctrl + V</strong> (วาง) เพื่อดึงข้อมูลอัตโนมัติ</li>
              </ol>
            </div>
            <div className="card card-glass">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-text)', marginBottom: '0.5rem' }}>
                วิธีที่ 2: ใช้ปุ่ม Bookmarklet ดึงข้อมูลด่วน (แม่นยำสูง)
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                ลากปุ่มนี้ไปวางที่แถบบุ๊กมาร์ก (Bookmarks Bar) หรือคัดลอกโค้ดไปสร้างบุ๊กมาร์กใหม่
              </p>
              <div className="flex gap-1" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <a
                  className="btn btn-secondary btn-sm"
                  href={bookmarkletCode}
                  onClick={(e) => {
                    if (e.target instanceof HTMLAnchorElement && e.target.href.startsWith('javascript:')) {
                      // Prevent navigation
                    }
                  }}
                  style={{ cursor: 'grab', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}
                  title="ลากปุ่มนี้ไปที่ Bookmark Bar"
                >
                  ⭐ ลากวาง: ดึงกลุ่ม Facebook
                </a>
                <button className="btn btn-ghost btn-sm" onClick={copyBookmarklet}>
                  📋 คัดลอกโค้ด Bookmarklet
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                *<strong>ข้อแนะนำ:</strong> หากคุณมีกลุ่มจำนวนมาก ให้<strong>เลื่อนสกอลบาร์ด้านซ้ายมือบน Facebook ลงมาจนสุด</strong>เพื่อให้เบราว์เซอร์โหลดรายชื่อกลุ่มแสดงผลทั้งหมดก่อนรัน Bookmarklet นี้ครับ
              </p>
            </div>
          </div>

          {/* Paste Zone */}
          <div className="card mb-2" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" htmlFor="smart-paste-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>วางข้อมูลกลุ่ม Facebook (Ctrl+V)</span>
                <span className="badge badge-accent">รองรับ HTML / Plain Text / JSON</span>
              </label>
              <textarea
                id="smart-paste-area"
                className="form-textarea"
                style={{ minHeight: '120px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                placeholder="คลิกที่นี่เพื่อกดวาง (Ctrl+V) หน้าเว็บที่คัดลอกมา หรือข้อมูลที่ได้จาก Bookmarklet... หรือวางลิงก์กลุ่มทีละบรรทัดก็สามารถทำได้เช่นกัน"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                onPaste={handlePaste}
              />
            </div>
            <div className="flex gap-1" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                *ระบบจะตรวจจับชื่อกลุ่มและลิงก์แยกเป็นตารางให้ตรวจสอบก่อนบันทึกจริง
              </span>
              <div className="flex gap-1">
                {pastedText.trim() && (
                  <button className="btn btn-ghost" onClick={() => { setPastedText(''); setImportItems([]); setSelectedIds(new Set()); }}>
                    ล้างข้อมูลที่ป้อน
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleScanText}>
                  🔍 สแกนและดึงกลุ่ม
                </button>
              </div>
            </div>
          </div>

          {/* Import Items Preview */}
          {importItems.length > 0 && (
            <div className="section" style={{ marginTop: '2rem' }}>
              <div className="section-title">
                📋 รายการกลุ่มที่สแกนพบ ({importItems.length} กลุ่ม, เลือกนำเข้า {selectedIds.size} กลุ่ม)
              </div>
              
              {/* Bulk operations bar */}
              <div className="card mb-2" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: '1rem', padding: '1rem' }}>
                <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem' }}>
                  <div className="flex gap-1" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>ตั้งหมวดหมู่พร้อมกัน (Bulk Category):</span>
                    <select
                      className="form-select"
                      style={{ width: 'auto', padding: '0.4rem 2.5rem 0.4rem 0.75rem', fontSize: '0.85rem' }}
                      value={bulkCategory}
                      onChange={(e) => handleBulkCategoryChange(e.target.value)}
                    >
                      <option value="">— เลือกหมวดหมู่ —</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    *เฉพาะกลุ่มใหม่ที่ถูกเลือกด้านล่างเท่านั้นที่จะถูกบันทึก
                  </div>
                </div>
              </div>

              {/* Table wrap */}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={importItems.length > 0 && selectedIds.size === importItems.length}
                          onChange={toggleSelectAll}
                          aria-label="เลือกทั้งหมด"
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </th>
                      <th style={{ width: '100px' }}>สถานะ</th>
                      <th>ชื่อกลุ่ม (แก้ไขได้)</th>
                      <th>URL กลุ่ม</th>
                      <th style={{ width: '180px' }}>หมวดหมู่ *</th>
                      <th style={{ width: '180px' }}>จำนวนสมาชิก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importItems.map((item, idx) => (
                      <tr key={item.id} style={{ opacity: item.isDuplicate ? 0.6 : 1 }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            disabled={item.isDuplicate}
                            aria-label={`เลือกกลุ่ม ${item.name}`}
                            style={{ cursor: item.isDuplicate ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                        <td>
                          {item.isDuplicate ? (
                            <span className="badge badge-pending" title="มีกลุ่มนี้อยู่ในระบบแล้ว">มีอยู่แล้ว</span>
                          ) : (
                            <span className="badge badge-ready">กลุ่มใหม่</span>
                          )}
                        </td>
                        <td>
                          <input
                            className="form-input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...importItems];
                              updated[idx].name = e.target.value;
                              setImportItems(updated);
                            }}
                            disabled={item.isDuplicate}
                          />
                        </td>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>
                            {item.url.replace('https://www.facebook.com', '')}
                          </a>
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{ padding: '0.35rem 2rem 0.35rem 0.5rem', fontSize: '0.85rem' }}
                            value={item.category}
                            onChange={(e) => {
                              const updated = [...importItems];
                              updated[idx].category = e.target.value;
                              setImportItems(updated);
                            }}
                            disabled={item.isDuplicate}
                          >
                            <option value="">— เลือกหมวดหมู่ —</option>
                            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-input"
                            placeholder="เช่น 1.5 หมื่นคน"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                            value={item.memberCountNote}
                            onChange={(e) => {
                              const updated = [...importItems];
                              updated[idx].memberCountNote = e.target.value;
                              setImportItems(updated);
                            }}
                            disabled={item.isDuplicate}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save actions */}
              <div className="flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.5rem' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setImportItems([]); setSelectedIds(new Set()); setPastedText(''); }}
                >
                  ยกเลิกทั้งหมด
                </button>
                <button className="btn btn-primary" onClick={handleImportSave} disabled={selectedIds.size === 0}>
                  💾 นำเข้าและบันทึกกลุ่มที่เลือก ({selectedIds.size} กลุ่ม)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
