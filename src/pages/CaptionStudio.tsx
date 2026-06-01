import { useState, useCallback } from 'react';
import type { CaptionPost, CaptionVariant } from '../types';
import { postStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationCenter';
import { ConfirmModal } from '../components/Modal';
import { isoNow } from '../lib/date';

const STYLES = [
  { key: 'professional', label: '💼 Professional' },
  { key: 'friendly', label: '😊 Friendly' },
  { key: 'sport_event', label: '⚽ Sport Event' },
  { key: 'photographer', label: '📸 Photographer' },
  { key: 'local_community', label: '🏘️ Local Community' },
  { key: 'custom', label: '✏️ Custom' },
] as const;

const TEMPLATES: Record<string, (title: string, caption: string, link: string, hashtags: string) => string> = {
  professional: (t, c, l, h) => `🎯 ${t}\n\n${c}\n\n🔗 ${l}\n\n${h}`,
  friendly: (t, c, l, h) => `👋 ${t}\n\n${c}\n\n✨ คลิกเลย! ${l}\n\n${h}`,
  sport_event: (t, c, l, h) => `⚽ ${t}\n\n🏆 ${c}\n\n🔥 ดูสด: ${l}\n\n${h}`,
  photographer: (t, c, l, h) => `📸 ${t}\n\n${c}\n\n📞 ติดต่อ/ดูพอร์ต: ${l}\n\n${h}`,
  local_community: (t, c, l, h) => `📢 ${t}\n\n${c}\n\n${l}\n\n${h}`,
  custom: (t, c, l, h) => `${t}\n\n${c}\n\n${l}\n\n${h}`,
};

const DEFAULT_FORM = {
  title: '',
  caption: '',
  link: '',
  hashtags: '',
  note: '',
};

export function CaptionStudio() {
  const { addNotification } = useNotifications();
  const [posts, setPosts] = useState<CaptionPost[]>(() => postStorage.getAll());
  const [selectedPost, setSelectedPost] = useState<CaptionPost | null>(posts[0] || null);
  const [form, setForm] = useState(selectedPost ? { title: selectedPost.title, caption: selectedPost.caption, link: selectedPost.link, hashtags: selectedPost.hashtags, note: selectedPost.note } : { ...DEFAULT_FORM });
  const [activeVariantStyle, setActiveVariantStyle] = useState<string>('professional');
  const [variantCaption, setVariantCaption] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isNewPost, setIsNewPost] = useState(!selectedPost);

  const reload = useCallback(() => {
    const all = postStorage.getAll();
    setPosts(all);
  }, []);

  const charCount = form.caption.length + form.title.length + form.link.length + form.hashtags.length;

  function getPreview() {
    const fn = TEMPLATES[activeVariantStyle] || TEMPLATES.professional;
    return fn(form.title, form.caption, form.link, form.hashtags);
  }

  function generateVariant() {
    const text = getPreview();
    setVariantCaption(text);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      addNotification('success', 'คัดลอกสำเร็จ', `คัดลอก ${label} แล้ว`);
    });
  }

  function handleSave() {
    if (!form.title.trim()) {
      addNotification('error', 'กรุณากรอกชื่อโพสต์', '');
      return;
    }
    const now = isoNow();
    if (isNewPost || !selectedPost) {
      const post: CaptionPost = {
        id: `post_${Date.now()}`,
        ...form,
        variants: variantCaption ? [{
          id: `var_${Date.now()}`,
          style: activeVariantStyle as CaptionVariant['style'],
          label: STYLES.find((s) => s.key === activeVariantStyle)?.label || activeVariantStyle,
          caption: variantCaption,
        }] : [],
        createdAt: now,
        updatedAt: now,
      };
      postStorage.add(post);
      addNotification('success', 'สร้างโพสต์สำเร็จ', `"${post.title}" บันทึกแล้ว`);
      setSelectedPost(post);
      setIsNewPost(false);
    } else {
      const updated: CaptionPost = {
        ...selectedPost,
        ...form,
        updatedAt: now,
      };
      postStorage.update(updated);
      addNotification('success', 'อัปเดตโพสต์สำเร็จ', `"${updated.title}" อัปเดตแล้ว`);
      setSelectedPost(updated);
    }
    reload();
  }

  function handleAddVariant() {
    if (!selectedPost || !variantCaption.trim()) return;
    const newVariant: CaptionVariant = {
      id: `var_${Date.now()}`,
      style: activeVariantStyle as CaptionVariant['style'],
      label: STYLES.find((s) => s.key === activeVariantStyle)?.label || activeVariantStyle,
      caption: variantCaption,
    };
    const updated: CaptionPost = {
      ...selectedPost,
      variants: [...selectedPost.variants, newVariant],
      updatedAt: isoNow(),
    };
    postStorage.update(updated);
    setSelectedPost(updated);
    setVariantCaption('');
    addNotification('success', 'เพิ่ม Variant แล้ว', `เพิ่ม ${newVariant.label} เรียบร้อย`);
    reload();
  }

  function deletePost(id: string) {
    postStorage.delete(id);
    addNotification('info', 'ลบโพสต์แล้ว', '');
    const remaining = postStorage.getAll();
    setPosts(remaining);
    setSelectedPost(remaining[0] || null);
    setIsNewPost(!remaining[0]);
    if (remaining[0]) setForm({ title: remaining[0].title, caption: remaining[0].caption, link: remaining[0].link, hashtags: remaining[0].hashtags, note: remaining[0].note });
    else setForm({ ...DEFAULT_FORM });
  }

  function selectPost(p: CaptionPost) {
    setSelectedPost(p);
    setForm({ title: p.title, caption: p.caption, link: p.link, hashtags: p.hashtags, note: p.note });
    setIsNewPost(false);
    setVariantCaption('');
  }

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Caption Studio</h1>
          <p className="page-subtitle">เขียนและจัดการแคปชั่นสำหรับแชร์กลุ่ม</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setIsNewPost(true); setSelectedPost(null); setForm({ ...DEFAULT_FORM }); setVariantCaption(''); }}>
          ➕ สร้างโพสต์ใหม่
        </button>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Post List */}
        <div>
          <div className="section-title">📝 โพสต์ทั้งหมด ({posts.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {posts.map((p) => (
              <div
                key={p.id}
                className={`card card-lift`}
                style={{ cursor: 'pointer', borderColor: selectedPost?.id === p.id ? 'var(--accent)' : undefined }}
                onClick={() => selectPost(p)}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm truncate" style={{ flex: 1 }}>{p.title}</div>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                    aria-label="ลบโพสต์"
                  >
                    🗑️
                  </button>
                </div>
                <div className="text-xs text-muted mt-1">{p.variants.length} variant · {p.caption.length} ตัวอักษร</div>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="card">
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-icon">✍️</div>
                  <div className="empty-state-desc">ยังไม่มีโพสต์</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div>
          <div className="section-title">{isNewPost ? '✍️ สร้างโพสต์ใหม่' : `✏️ แก้ไข: ${selectedPost?.title || '...'}`}</div>
          <div className="card">
            <div className="form-group">
              <label className="form-label" htmlFor="cap-title">ชื่อโพสต์ (Title)</label>
              <input id="cap-title" className="form-input" placeholder="ชื่อแคมเปญ/โพสต์..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cap-body">Caption หลัก</label>
              <textarea id="cap-body" className="form-textarea" placeholder="เนื้อหาโพสต์หลัก..." value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} rows={5} />
              <div className="text-xs text-muted mt-1" style={{ textAlign: 'right' }}>
                {form.caption.length} ตัวอักษร · รวม {charCount} ตัวอักษร
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cap-link">Link</label>
                <input id="cap-link" className="form-input" placeholder="https://..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cap-hash">Hashtags</label>
                <input id="cap-hash" className="form-input" placeholder="#tag1 #tag2..." value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cap-note">หมายเหตุ</label>
              <textarea id="cap-note" className="form-textarea" rows={2} placeholder="หมายเหตุสำหรับตัวเอง..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => copyText(getPreview(), 'แคปชั่น')}>📋 Copy Caption</button>
              <button className="btn btn-primary" onClick={handleSave}>💾 บันทึกโพสต์</button>
            </div>
          </div>

          {/* Variant Generator */}
          <div className="section-title mt-2">🎨 Caption Variant Generator</div>
          <div className="card">
            <div className="filter-bar mb-2">
              {STYLES.map((s) => (
                <button key={s.key} className={`filter-chip ${activeVariantStyle === s.key ? 'active' : ''}`} onClick={() => setActiveVariantStyle(s.key)}>{s.label}</button>
              ))}
            </div>
            <button className="btn btn-secondary w-full mb-2" onClick={generateVariant}>⚡ สร้าง Variant</button>
            {variantCaption && (
              <div>
                <div className="session-caption-box mb-1">{variantCaption}</div>
                <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyText(variantCaption, 'Variant')}>📋 Copy</button>
                  {selectedPost && <button className="btn btn-secondary btn-sm" onClick={handleAddVariant}>💾 บันทึก Variant</button>}
                </div>
              </div>
            )}
          </div>

          {/* Variants */}
          {selectedPost && selectedPost.variants.length > 0 && (
            <>
              <div className="section-title mt-2">📚 Variants ที่บันทึกแล้ว</div>
              {selectedPost.variants.map((v) => (
                <div key={v.id} className="card mb-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="badge badge-accent">{v.label}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyText(v.caption, v.label)}>📋 Copy</button>
                  </div>
                  <div className="session-caption-box" style={{ maxHeight: '120px' }}>{v.caption}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deletePost(deleteId); setDeleteId(null); } }} title="ลบโพสต์" message="แน่ใจหรือไม่ที่จะลบโพสต์นี้?" confirmLabel="ลบโพสต์" danger />
    </div>
  );
}
