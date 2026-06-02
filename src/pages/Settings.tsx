import { useState } from 'react';
import type { AppSettings, ThemeMode } from '../types';
import { settingsStorage, exportAllData, importAllData, clearAllData, groupStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationContexts';
import { ConfirmModal } from '../components/Modal';
import { downloadJson } from '../lib/exporters';
import { exportGroupsCsv, downloadFile } from '../lib/exporters';
import { BACKUP_MARKER_KEY } from '../lib/automation';

export function Settings() {
  const { addNotification } = useNotifications();
  const [settings, setSettings] = useState<AppSettings>(() => settingsStorage.get());
  const [showClear, setShowClear] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  function saveSettings(updated: AppSettings, notify = true) {
    settingsStorage.save(updated);
    setSettings(updated);
    // Apply theme
    document.documentElement.setAttribute('data-theme', updated.theme);
    if (notify) addNotification('success', 'บันทึกการตั้งค่าแล้ว', '');
  }

  function saveAutomation(updated: Partial<AppSettings['automation']>) {
    saveSettings({ ...settings, automation: { ...settings.automation, ...updated } }, false);
  }

  function reloadSoon() {
    window.setTimeout(() => window.location.reload(), 800);
  }

  function handleTheme(theme: ThemeMode) {
    saveSettings({ ...settings, theme });
  }

  function addCategory() {
    if (!newCategory.trim()) return;
    if (settings.categories.includes(newCategory.trim())) {
      addNotification('warning', 'มีหมวดหมู่นี้อยู่แล้ว', '');
      return;
    }
    const updated = { ...settings, categories: [...settings.categories, newCategory.trim()] };
    saveSettings(updated);
    setNewCategory('');
  }

  function removeCategory(cat: string) {
    const updated = { ...settings, categories: settings.categories.filter((c) => c !== cat) };
    saveSettings(updated);
  }

  function handleExportAll() {
    const data = exportAllData();
    downloadJson(data, `pgsc-backup-${new Date().toISOString().slice(0, 10)}.json`);
    localStorage.setItem(BACKUP_MARKER_KEY, new Date().toISOString());
    addNotification('success', 'Export JSON สำเร็จ', 'บันทึกข้อมูลทั้งหมดแล้ว');
  }

  function handleExportGroupsCsv() {
    const groups = groupStorage.getAll();
    const csv = exportGroupsCsv(groups);
    downloadFile(csv, 'groups-export.csv');
    addNotification('success', 'Export Groups CSV สำเร็จ', `${groups.length} กลุ่ม`);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          importAllData(data);
          addNotification('success', 'Import สำเร็จ', 'นำเข้าข้อมูลเรียบร้อย รีเฟรชหน้าเพื่อดูผล');
          reloadSoon();
        } catch {
          addNotification('error', 'Import ล้มเหลว', 'ไฟล์ JSON ไม่ถูกต้อง');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleClearAll() {
    clearAllData();
    addNotification('info', 'ล้างข้อมูลทั้งหมดแล้ว', 'รีเฟรชหน้าเพื่อเริ่มใหม่');
    reloadSoon();
  }

  function handleBrowserNotificationPermission() {
    if (!('Notification' in window)) {
      addNotification('warning', 'Browser นี้ไม่รองรับ Notification', '');
      return;
    }
    Notification.requestPermission().then((permission) => {
      const enabled = permission === 'granted';
      saveAutomation({ browserNotificationsEnabled: enabled });
      addNotification(enabled ? 'success' : 'warning', enabled ? 'เปิด Browser Notification แล้ว' : 'ยังไม่ได้รับสิทธิ์ Notification', '');
    });
  }

  async function handleWebhookSync() {
    const url = settings.automation.syncWebhookUrl.trim();
    if (!url) {
      addNotification('warning', 'กรุณาใส่ Webhook URL', '');
      return;
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportAllData()),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      localStorage.setItem(BACKUP_MARKER_KEY, new Date().toISOString());
      addNotification('success', 'Sync สำเร็จ', 'ส่งข้อมูล backup ไปยัง webhook แล้ว');
    } catch (error) {
      addNotification('error', 'Sync ล้มเหลว', error instanceof Error ? error.message : 'ไม่สามารถส่งข้อมูลได้');
    }
  }

  const themes: { key: ThemeMode; label: string; desc: string }[] = [
    { key: 'dark_orange', label: '🔶 Dark Orange', desc: 'ธีมหลัก — ดำ + ส้ม (ค่าเริ่มต้น)' },
    { key: 'dark_gold', label: '🥇 Dark Gold', desc: 'ดำ + ทอง — หรูหรา' },
    { key: 'high_contrast', label: '💡 High Contrast', desc: 'คอนทราสต์สูง — อ่านง่ายสุด' },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">ตั้งค่าระบบ PepsGroup Share Command</p>
      </div>

      {/* Theme */}
      <div className="section">
        <div className="section-title">🎨 ธีม</div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {themes.map((t) => (
              <label
                key={t.key}
                className="form-check"
                style={{
                  background: settings.theme === t.key ? 'var(--accent-dim)' : 'var(--bg-input)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `1px solid ${settings.theme === t.key ? 'var(--accent)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="radio"
                  name="theme"
                  checked={settings.theme === t.key}
                  onChange={() => handleTheme(t.key)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.label}</div>
                  <div className="text-xs text-muted">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="section">
        <div className="section-title">🏷️ หมวดหมู่กลุ่ม</div>
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {settings.categories.map((cat) => (
              <div key={cat} className="badge badge-accent" style={{ gap: '0.5rem' }}>
                {cat}
                <button
                  onClick={() => removeCategory(cat)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                  aria-label={`ลบหมวดหมู่ ${cat}`}
                >×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              className="form-input"
              placeholder="ชื่อหมวดหมู่ใหม่..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <button className="btn btn-primary" onClick={addCategory}>➕ เพิ่ม</button>
          </div>
        </div>
      </div>

      {/* Automation */}
      <div className="section">
        <div className="section-title">⚡ Automation</div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <label className="form-check">
              <input type="checkbox" checked={settings.automation.smartQueueEnabled} onChange={(e) => saveAutomation({ smartQueueEnabled: e.target.checked })} />
              <div>
                <div className="font-bold text-sm">Smart Queue</div>
                <div className="text-xs text-muted">กันคิวซ้ำ เรียงกลุ่มคุณภาพ และข้ามกลุ่มที่เสี่ยงตามตัวเลือกด้านล่าง</div>
              </div>
            </label>
            <div className="form-row-3">
              <label className="form-check"><input type="checkbox" checked={settings.automation.skipBlacklisted} onChange={(e) => saveAutomation({ skipBlacklisted: e.target.checked })} /> ข้าม blacklist</label>
              <label className="form-check"><input type="checkbox" checked={settings.automation.skipCooldown} onChange={(e) => saveAutomation({ skipCooldown: e.target.checked })} /> ข้าม cooldown</label>
              <label className="form-check"><input type="checkbox" checked={settings.automation.skipNoLinkGroups} onChange={(e) => saveAutomation({ skipNoLinkGroups: e.target.checked })} /> ข้ามกลุ่มห้ามลิงก์</label>
            </div>
            <div className="divider" />
            <label className="form-check">
              <input type="checkbox" checked={settings.automation.remindersEnabled} onChange={(e) => saveAutomation({ remindersEnabled: e.target.checked })} />
              <div>
                <div className="font-bold text-sm">Reminder Engine</div>
                <div className="text-xs text-muted">แจ้งเตือนคิววันนี้ คิวเกินกำหนด pending approval และ lead follow-up เมื่อเปิดเว็บ</div>
              </div>
            </label>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">ติดตามรอแอดมินหลัง (ชม.)</label>
                <input type="number" min={1} className="form-input" value={settings.automation.approvalReminderHours} onChange={(e) => saveAutomation({ approvalReminderHours: Number(e.target.value) || 24 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Follow-up lead หลัง (วัน)</label>
                <input type="number" min={1} className="form-input" value={settings.automation.leadFollowUpDays} onChange={(e) => saveAutomation({ leadFollowUpDays: Number(e.target.value) || 2 })} />
              </div>
              <div className="form-group">
                <label className="form-label">เตือน backup ทุก (วัน)</label>
                <input type="number" min={1} className="form-input" value={settings.automation.backupReminderDays} onChange={(e) => saveAutomation({ backupReminderDays: Number(e.target.value) || 7 })} />
              </div>
            </div>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={handleBrowserNotificationPermission}>🔔 เปิด Browser Notification</button>
              <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>
                สถานะ: {settings.automation.browserNotificationsEnabled ? 'เปิดอยู่' : 'ปิดอยู่'}
              </span>
            </div>
            <div className="divider" />
            <div className="form-group">
              <label className="form-label">Webhook Sync URL</label>
              <input className="form-input" value={settings.automation.syncWebhookUrl} onChange={(e) => saveAutomation({ syncWebhookUrl: e.target.value })} placeholder="https://... (เช่น Apps Script, Supabase Edge Function, Make/Zapier webhook)" />
              <div className="text-xs text-muted mt-1">กด Sync Now เพื่อส่ง backup JSON ไปยัง endpoint ที่คุณควบคุมเอง</div>
            </div>
            <button className="btn btn-secondary" onClick={handleWebhookSync}>☁️ Sync Now</button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="section">
        <div className="section-title">💾 จัดการข้อมูล</div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div className="font-bold text-sm">Export ข้อมูลทั้งหมด (JSON)</div>
                <div className="text-xs text-muted">สำรองข้อมูลทั้งหมด: กลุ่ม, โพสต์, แคมเปญ, คิว</div>
              </div>
              <button className="btn btn-secondary" onClick={handleExportAll}>📦 Export JSON</button>
            </div>
            <div className="divider" />
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div className="font-bold text-sm">Export กลุ่มทั้งหมด (CSV)</div>
                <div className="text-xs text-muted">ส่งออกข้อมูลกลุ่มทั้งหมดเป็นไฟล์ CSV</div>
              </div>
              <button className="btn btn-secondary" onClick={handleExportGroupsCsv}>📊 Export Groups CSV</button>
            </div>
            <div className="divider" />
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div className="font-bold text-sm">Import ข้อมูล (JSON)</div>
                <div className="text-xs text-muted">นำเข้าข้อมูลจากไฟล์ JSON ที่ Export ไว้</div>
              </div>
              <button className="btn btn-secondary" onClick={handleImport}>📥 Import JSON</button>
            </div>
            <div className="divider" />
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--status-blocked)' }}>ล้างข้อมูลทั้งหมด</div>
                <div className="text-xs text-muted">ลบข้อมูลทั้งหมดออกจาก localStorage (ย้อนกลับไม่ได้)</div>
              </div>
              <button className="btn btn-danger" onClick={() => setShowClear(true)}>🗑️ Clear All</button>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="section">
        <div className="section-title">ℹ️ เกี่ยวกับระบบ</div>
        <div className="card">
          <div className="disclaimer-banner" style={{ marginBottom: 0 }}>
            <span className="disclaimer-icon">🛡️</span>
            <div>
              <strong style={{ color: 'var(--accent-text)' }}>PepsGroup Share Command v1.0.0</strong>
              <div className="text-xs text-secondary mt-1">
                ระบบนี้เป็นเครื่องมือช่วยจัดการคิวและบันทึกผลเท่านั้น ไม่ใช่ระบบโพสต์อัตโนมัติ<br />
                ผู้ใช้ต้องเป็นผู้กดโพสต์/แชร์เองทุกครั้ง<br />
                ควรอ่านกฎของแต่ละกลุ่มก่อนโพสต์<br />
                ข้อมูลทั้งหมดเก็บใน localStorage บน Browser ของคุณเท่านั้น
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showClear}
        onClose={() => setShowClear(false)}
        onConfirm={handleClearAll}
        title="ล้างข้อมูลทั้งหมด"
        message="คุณแน่ใจหรือไม่? การกระทำนี้จะลบข้อมูลทั้งหมดออกจากระบบและไม่สามารถย้อนกลับได้ กรุณา Export ข้อมูลก่อนหากต้องการสำรอง"
        confirmLabel="ล้างข้อมูลทั้งหมด"
        danger
      />
    </div>
  );
}
