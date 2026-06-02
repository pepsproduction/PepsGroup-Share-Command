import re

with open(r'd:\00 github\PepsGroup Share Command\src\pages\ShareSession.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix imports
content = content.replace(
    "import { useState } from 'react';",
    "import { useState, useEffect, useCallback } from 'react';"
)
content = content.replace(
    "import { createId } from '../lib/ids';",
    "import { createId } from '../lib/ids';\nimport {\n  isExtensionInstalled,\n  pingExtension,\n  startExtensionSession,\n  cancelExtensionSession,\n  subscribeToExtensionEvents,\n  type ExtensionShareResult,\n} from '../lib/extension';"
)

# 2. Add extension state after [leadForm, setLeadForm]
old_state = "  const [leadForm, setLeadForm] = useState({ ...DEFAULT_LEAD_FORM });"
new_state = """  const [leadForm, setLeadForm] = useState({ ...DEFAULT_LEAD_FORM });

  // Auto Share Extension State
  const [extInstalled, setExtInstalled] = useState(false);
  const [autoPostUrl, setAutoPostUrl] = useState('');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResults, setAutoResults] = useState<ExtensionShareResult[]>([]);
  const [autoProgress, setAutoProgress] = useState<{ current: number; total: number; group: string } | null>(null);
  const [showAutoSummary, setShowAutoSummary] = useState(false);

  useEffect(() => {
    if (isExtensionInstalled()) {
      pingExtension().then(ok => setExtInstalled(ok));
    }
  }, []);

  useEffect(() => {
    if (!extInstalled) return;
    const unsub = subscribeToExtensionEvents({
      onProgress: (data) => {
        setAutoProgress({ current: data.currentIndex + 1, total: data.total, group: data.group });
      },
      onResult: (result) => {
        setAutoResults(prev => [...prev, result]);
        const allGroups = groupStorage.getAll();
        const matchedItem = queueStorage.getAll().find(
          (q) => q.campaignId === selectedCampaign && allGroups.find(g => g.id === q.groupId)?.name === result.group
        );
        if (matchedItem) {
          const st = result.status === 'posted' ? 'posted'
            : result.status === 'pending_admin' ? 'pending_admin'
            : result.status === 'failed' ? 'failed'
            : 'skipped';
          queueStorage.update({ ...matchedItem, status: st as ShareItemStatus, updatedAt: isoNow(), submittedAt: isoNow() });
        }
      },
      onDone: (data) => {
        setAutoRunning(false);
        setAutoProgress(null);
        setAutoResults(data.results);
        setShowAutoSummary(true);
        addNotification('success', 'Auto Share \u0e40\u0e2a\u0e23\u0e47\u0e08\u0e2a\u0e34\u0e49\u0e19!', `\u0e41\u0e0a\u0e23\u0e4c\u0e04\u0e23\u0e1a ${data.results.length} \u0e01\u0e25\u0e38\u0e48\u0e21\u0e41\u0e25\u0e49\u0e27`);
      },
      onCancelled: () => {
        setAutoRunning(false);
        setAutoProgress(null);
        addNotification('warning', '\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01 Auto Share', 'Session \u0e16\u0e39\u0e01\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01');
      },
    });
    return unsub;
  }, [extInstalled, selectedCampaign]);

  const handleStartAutoShare = useCallback(async () => {
    if (!selectedCampaign || !autoPostUrl.trim()) {
      addNotification('warning', '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e04\u0e23\u0e1a', '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d\u0e41\u0e25\u0e30\u0e01\u0e23\u0e2d\u0e01 URL \u0e42\u0e1e\u0e2a\u0e15\u0e4c');
      return;
    }
    const pendingItems = queueStorage.getByCampaign(selectedCampaign).filter(q => q.status === 'not_started');
    if (pendingItems.length === 0) {
      addNotification('warning', '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e34\u0e27\u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e23\u0e34\u0e48\u0e21', '\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e23\u0e34\u0e48\u0e21\u0e41\u0e0a\u0e23\u0e4c');
      return;
    }
    const allGroups = groupStorage.getAll();
    const extGroups = pendingItems
      .map(item => allGroups.find(g => g.id === item.groupId))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map(g => ({ id: g.id, name: g.name, url: g.url }));

    const sessionId = createId('ext_session');
    setAutoResults([]);
    setAutoProgress({ current: 0, total: extGroups.length, group: '' });
    setAutoRunning(true);
    setShowAutoSummary(false);

    const firstItem = pendingItems[0];
    const firstPost = postStorage.getAll().find(p => p.id === firstItem?.postId);
    const caption = firstPost
      ? [firstPost.title, firstPost.caption, firstPost.link, firstPost.hashtags].filter(Boolean).join('\\n\\n').trim()
      : '';

    const result = await startExtensionSession({ sessionId, postUrl: autoPostUrl.trim(), groups: extGroups, caption });
    if (!result.ok) {
      setAutoRunning(false);
      setAutoProgress(null);
      addNotification('error', '\u0e40\u0e23\u0e34\u0e48\u0e21 Auto Share \u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08', result.error || '\u0e44\u0e21\u0e48\u0e17\u0e23\u0e32\u0e1a\u0e2a\u0e32\u0e40\u0e2b\u0e15\u0e38');
    } else {
      addNotification('info', 'Auto Share \u0e40\u0e23\u0e34\u0e48\u0e21\u0e41\u0e25\u0e49\u0e27', `\u0e01\u0e33\u0e25\u0e31\u0e07\u0e41\u0e0a\u0e23\u0e4c\u0e44\u0e1b\u0e22\u0e31\u0e07 ${extGroups.length} \u0e01\u0e25\u0e38\u0e48\u0e21`);
    }
  }, [selectedCampaign, autoPostUrl, addNotification]);

  const handleCancelAutoShare = useCallback(async () => {
    await cancelExtensionSession();
    setAutoRunning(false);
    setAutoProgress(null);
  }, []);"""

content = content.replace(old_state, new_state)

# 3. Replace the !isActive return block
old_block = '''  // If not active, show setup
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
  }'''

new_block = """  // Auto summary counts
  const autoPosted  = autoResults.filter(r => r.status === 'posted').length;
  const autoPending = autoResults.filter(r => r.status === 'pending_admin').length;
  const autoFailed  = autoResults.filter(r => r.status === 'failed').length;
  void showAutoSummary; // used in JSX below

  // If not active, show setup
  if (!isActive) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Share Session</h1>
          <p className="page-subtitle">\u0e40\u0e23\u0e34\u0e48\u0e21 Session \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e41\u0e0a\u0e23\u0e4c\u0e42\u0e1e\u0e2a\u0e15\u0e4c\u0e25\u0e07\u0e01\u0e25\u0e38\u0e48\u0e21\u0e17\u0e35\u0e25\u0e30\u0e01\u0e25\u0e38\u0e48\u0e21</p>
        </div>

        {extInstalled && (
          <div className="card" style={{ maxWidth: '560px', marginBottom: '1.5rem', border: '1px solid rgba(255,107,43,0.35)', background: 'linear-gradient(135deg,rgba(255,107,43,0.06) 0%,rgba(30,30,46,0.9) 100%)' }}>
            <div className="section-title" style={{ color: 'var(--accent-text)' }}>\ud83e\udd16 Auto Share (PGSC Extension)</div>
            <div className="text-sm text-secondary mb-2" style={{ lineHeight: 1.5 }}>
              Extension \u0e15\u0e23\u0e27\u0e08\u0e1e\u0e1a\u0e41\u0e25\u0e49\u0e27 \u2705 \u2014 \u0e23\u0e30\u0e1a\u0e1a\u0e08\u0e30\u0e41\u0e0a\u0e23\u0e4c\u0e42\u0e1e\u0e2a\u0e15\u0e4c\u0e1c\u0e48\u0e32\u0e19 Native Share Dialog \u0e02\u0e2d\u0e07 Facebook \u0e43\u0e2b\u0e49\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34
            </div>
            <div className="form-group">
              <label className="form-label">\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d</label>
              <select className="form-select" value={selectedCampaign} onChange={(e) => handleCampaignChange(e.target.value)} disabled={autoRunning}>
                <option value="">\u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d \u2014</option>
                {campaigns.map((c) => {
                  const pending = queueStorage.getByCampaign(c.id).filter((q) => q.status === 'not_started').length;
                  return <option key={c.id} value={c.id}>{c.name} ({pending} \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e23\u0e2d)</option>;
                })}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">URL \u0e42\u0e1e\u0e2a\u0e15\u0e4c Facebook \u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e41\u0e0a\u0e23\u0e4c</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://www.facebook.com/Pepsproduction/posts/..."
                value={autoPostUrl}
                onChange={(e) => setAutoPostUrl(e.target.value)}
                disabled={autoRunning}
              />
            </div>
            {(autoRunning || autoResults.length > 0) && (
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                {autoProgress && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>
                      <span>\u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e41\u0e0a\u0e23\u0e4c: <strong style={{ color: '#fff' }}>{autoProgress.group || '...'}</strong></span>
                      <span>{Math.min(autoProgress.current, autoProgress.total)} / {autoProgress.total}</span>
                    </div>
                    <div style={{ height: '8px', background: '#2a2a40', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg,#FF6B2B,#FF8C42)', borderRadius: '4px', transition: 'width 0.5s ease', width: autoProgress.total > 0 ? `${(autoProgress.current / autoProgress.total) * 100}%` : '0%' }} />
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '13px' }}>
                  <span style={{ color: '#4CAF50' }}>\u2705 {autoPosted} \u0e42\u0e1e\u0e2a\u0e15\u0e4c</span>
                  <span style={{ color: '#FFA726' }}>\u23f3 {autoPending} \u0e23\u0e2d\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19</span>
                  <span style={{ color: '#ef5350' }}>\u274c {autoFailed} \u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27</span>
                </div>
                {autoResults.length > 0 && (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', marginTop: '10px' }}>
                    {[...autoResults].reverse().map((r, i) => (
                      <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{r.group}</span>
                        <span style={{ color: r.status === 'posted' ? '#4CAF50' : r.status === 'pending_admin' ? '#FFA726' : '#ef5350', flexShrink: 0 }}>
                          {r.status === 'posted' ? '\u2705' : r.status === 'pending_admin' ? '\u23f3' : '\u274c'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-1">
              {!autoRunning ? (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'linear-gradient(135deg,#FF6B2B,#FF8C42)', fontWeight: 700 }}
                  onClick={handleStartAutoShare}
                  disabled={!selectedCampaign || !autoPostUrl.trim()}
                >
                  \ud83e\udd16 \u0e40\u0e23\u0e34\u0e48\u0e21 Auto Share
                </button>
              ) : (
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleCancelAutoShare}>
                  \u26d4 \u0e2b\u0e22\u0e38\u0e14 Auto Share
                </button>
              )}
            </div>
          </div>
        )}

        {!extInstalled && (
          <div className="disclaimer-banner" style={{ maxWidth: '560px', marginBottom: '1.5rem', borderColor: 'rgba(255,107,43,0.25)' }}>
            <span className="disclaimer-icon">\ud83d\udd0c</span>
            <div>
              <strong style={{ color: 'var(--accent-text)' }}>\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e41\u0e0a\u0e23\u0e4c\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34?</strong>
              {' '}\u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07 <strong>PGSC Share Helper Extension</strong> \u0e08\u0e32\u0e01\u0e42\u0e1f\u0e25\u0e40\u0e14\u0e2d\u0e23\u0e4c <code>pgsc-extension/</code> \u0e41\u0e25\u0e49\u0e27\u0e42\u0e2b\u0e25\u0e14\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48
            </div>
          </div>
        )}

        <div className="disclaimer-banner" style={{ maxWidth: '560px' }}>
          <span className="disclaimer-icon">\ud83d\udee1\ufe0f</span>
          <div>
            <strong style={{ color: 'var(--accent-text)' }}>Manual Mode: \u0e04\u0e38\u0e13\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e1b\u0e47\u0e19\u0e1c\u0e39\u0e49\u0e01\u0e14\u0e42\u0e1e\u0e2a\u0e15\u0e4c\u0e40\u0e2d\u0e07\u0e17\u0e38\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07</strong>
            {' '}\u0e23\u0e30\u0e1a\u0e1a\u0e19\u0e35\u0e49\u0e08\u0e30\u0e40\u0e1b\u0e34\u0e14\u0e41\u0e17\u0e47\u0e1a\u0e01\u0e25\u0e38\u0e48\u0e21\u0e43\u0e2b\u0e49\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19 \u0e44\u0e21\u0e48\u0e21\u0e35\u0e01\u0e32\u0e23\u0e42\u0e1e\u0e2a\u0e15\u0e4c\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34
          </div>
        </div>

        <div className="card" style={{ maxWidth: '560px', marginTop: '1rem' }}>
          <div className="section-title">\ud83d\ude80 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d\u0e17\u0e35\u0e48\u0e08\u0e30\u0e41\u0e0a\u0e23\u0e4c (Manual)</div>
          <div className="form-group">
            <label className="form-label">\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d</label>
            <select className="form-select" value={selectedCampaign} onChange={(e) => handleCampaignChange(e.target.value)}>
              <option value="">\u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d \u2014</option>
              {campaigns.map((c) => {
                const pending = queueStorage.getByCampaign(c.id).filter((q) => q.status === 'not_started').length;
                return <option key={c.id} value={c.id}>{c.name} ({pending} \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e23\u0e2d)</option>;
              })}
            </select>
          </div>
          {selectedCampaign && (
            <div className="text-sm text-secondary mb-2">
              \u0e04\u0e34\u0e27\u0e23\u0e2d\u0e41\u0e0a\u0e23\u0e4c: {queueStorage.getByCampaign(selectedCampaign).filter((q) => q.status === 'not_started').length} \u0e01\u0e25\u0e38\u0e48\u0e21
            </div>
          )}
          <button
            className="btn btn-primary w-full"
            onClick={startSession}
            disabled={!selectedCampaign}
          >
            \u25b6\ufe0f \u0e40\u0e23\u0e34\u0e48\u0e21 Share Session (Manual)
          </button>
        </div>
      </div>
    );
  }"""

content = content.replace(old_block, new_block)

with open(r'd:\00 github\PepsGroup Share Command\src\pages\ShareSession.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('All patches done')
