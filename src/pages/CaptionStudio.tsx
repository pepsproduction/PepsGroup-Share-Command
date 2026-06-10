import { useState, useCallback } from 'react';
import type { CaptionPost, CaptionVariant, CaptionImage } from '../types';
import { postStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationContexts';
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
  imageUrl: '',
  images: [] as CaptionImage[],
};

export function CaptionStudio() {
  const { addNotification } = useNotifications();
  const [posts, setPosts] = useState<CaptionPost[]>(() => postStorage.getAll());
  const [selectedPost, setSelectedPost] = useState<CaptionPost | null>(posts[0] || null);
  const [form, setForm] = useState(selectedPost ? { title: selectedPost.title, caption: selectedPost.caption, link: selectedPost.link, hashtags: selectedPost.hashtags, note: selectedPost.note, imageUrl: selectedPost.imageUrl || '', images: selectedPost.images || [] } : { ...DEFAULT_FORM });
  const [activeVariantStyle, setActiveVariantStyle] = useState<string>('professional');
  const [variantCaption, setVariantCaption] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isNewPost, setIsNewPost] = useState(!selectedPost);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((fileList: FileList) => {
    const newImages: CaptionImage[] = [];
    const filesArray = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    
    if (filesArray.length === 0) return;

    let processedCount = 0;
    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push({
          name: file.name,
          data: reader.result as string,
        });
        processedCount++;
        if (processedCount === filesArray.length) {
          const sortedNew = [...newImages].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
          setForm((prev) => ({
            ...prev,
            images: [...(prev.images || []), ...sortedNew],
          }));
          addNotification('success', 'อัปโหลดสำเร็จ', `เพิ่มรูปภาพ ${filesArray.length} รูปเรียบร้อย`);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [addNotification]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeImage = useCallback((indexToRemove: number) => {
    setForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, index) => index !== indexToRemove),
    }));
  }, []);

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
    postStorage.deleteWithRelations(id);
    addNotification('info', 'ลบโพสต์แล้ว', 'ลบแคมเปญและคิวที่ใช้โพสต์นี้แล้ว');
    const remaining = postStorage.getAll();
    setPosts(remaining);
    setSelectedPost(remaining[0] || null);
    setIsNewPost(!remaining[0]);
    if (remaining[0]) setForm({ 
      title: remaining[0].title, 
      caption: remaining[0].caption, 
      link: remaining[0].link, 
      hashtags: remaining[0].hashtags, 
      note: remaining[0].note, 
      imageUrl: remaining[0].imageUrl || '', 
      images: remaining[0].images || (remaining[0].imageUrl ? [{ name: 'legacy_image.png', data: remaining[0].imageUrl }] : []) 
    });
    else setForm({ ...DEFAULT_FORM });
  }

  function selectPost(p: CaptionPost) {
    setSelectedPost(p);
    setForm({ 
      title: p.title, 
      caption: p.caption, 
      link: p.link, 
      hashtags: p.hashtags, 
      note: p.note, 
      imageUrl: p.imageUrl || '', 
      images: p.images || (p.imageUrl ? [{ name: 'legacy_image.png', data: p.imageUrl }] : []) 
    });
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
            <div className="form-group">
              <label className="form-label">🖼️ รูปภาพแนบ (Image Upload & Drag-Drop)</label>
              
              {/* Responsive Grid Preview */}
              {form.images && form.images.length > 0 && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                  gap: '12px', 
                  marginTop: '0.8rem',
                  marginBottom: '1rem' 
                }}>
                  {form.images.map((img, idx) => (
                    <div key={idx} style={{ 
                      position: 'relative', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border)', 
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <img src={img.data} alt={img.name} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                      <div className="text-xs text-muted truncate" style={{ width: '100%', textAlign: 'center', marginTop: '4px', fontSize: '10px', padding: '0 2px' }} title={img.name}>
                        {img.name}
                      </div>
                      <button 
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ 
                          position: 'absolute', 
                          top: '2px', 
                          right: '2px', 
                          padding: '2px 4px', 
                          fontSize: '8px',
                          borderRadius: '4px',
                          lineHeight: '1'
                        }}
                        onClick={() => removeImage(idx)}
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFiles(e.target.files);
                    }
                  }}
                  style={{ display: 'none' }}
                  id="post-image-upload"
                />
                <label 
                  htmlFor="post-image-upload" 
                  className="btn btn-secondary" 
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer', 
                    padding: '2rem 1.5rem',
                    border: dragActive ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    backgroundColor: dragActive ? 'rgba(255,107,43,0.06)' : 'rgba(255,255,255,0.01)',
                    transition: 'all 0.2s',
                    boxShadow: dragActive ? '0 0 15px rgba(255,107,43,0.15)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📥</span>
                  <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                    {dragActive ? 'วางไฟล์รูปภาพตรงนี้...' : 'ลากไฟล์รูปภาพมาวาง หรือคลิกเพื่ออัปโหลด'}
                  </span>
                  <span className="text-xs text-muted mt-1">อัปโหลดได้หลายไฟล์ ไม่จำกัดจำนวน (เรียงตามลำดับชื่อไฟล์เมื่อโพสต์)</span>
                </label>
              </div>
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
