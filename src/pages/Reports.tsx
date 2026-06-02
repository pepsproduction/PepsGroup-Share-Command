import { useState } from 'react';
import type { Campaign } from '../types';
import { campaignStorage, queueStorage, leadStorage, groupStorage } from '../lib/storage';
import { useNotifications } from '../components/NotificationContexts';
import { formatDate } from '../lib/date';
import { exportLeadsCsv, exportQueueCsv, downloadFile, downloadJson } from '../lib/exporters';
import { computeSessionSummary, summaryToText } from '../lib/summary';

export function Reports() {
  const { addNotification } = useNotifications();
  const [campaigns] = useState<Campaign[]>(() => campaignStorage.getAll());
  const [groups] = useState(() => groupStorage.getAll());
  const [leads] = useState(() => leadStorage.getAll());


  const reportRows = campaigns.map((c) => {
    const items = queueStorage.getByCampaign(c.id);
    const s = computeSessionSummary(items);
    return { campaign: c, items, summary: s };
  });

  function handleExportCsv(row: typeof reportRows[0]) {
    const csv = exportQueueCsv(row.items, row.campaign);
    downloadFile(csv, `report-${row.campaign.id}.csv`);
    addNotification('success', 'Export CSV สำเร็จ', row.campaign.name);
  }

  function handleExportJson(row: typeof reportRows[0]) {
    downloadJson({ campaign: row.campaign, items: row.items }, `report-${row.campaign.id}.json`);
    addNotification('success', 'Export JSON สำเร็จ', row.campaign.name);
  }

  function copySummary(row: typeof reportRows[0]) {
    const text = summaryToText(row.summary, row.campaign.name);
    navigator.clipboard.writeText(text).then(() => addNotification('success', 'คัดลอกสรุปแล้ว', ''));
  }

  function handleExportLeadsCsv() {
    const csv = exportLeadsCsv(leads, groups, campaigns);
    downloadFile(csv, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
    addNotification('success', 'Export Leads CSV สำเร็จ', `${leads.length} รายการ`);
  }

  // Overall stats
  const allQueue = queueStorage.getAll();
  const overall = computeSessionSummary(allQueue);

  // Bar chart data
  const barData = [
    { label: 'โพสต์แล้ว', value: overall.posted, color: 'var(--status-ready)' },
    { label: 'รอแอดมิน', value: overall.pendingAdmin, color: 'var(--status-pending)' },
    { label: 'อนุมัติ', value: overall.approved, color: 'var(--status-done)' },
    { label: 'ไม่อนุมัติ', value: overall.rejected, color: 'var(--status-blocked)' },
    { label: 'ข้าม', value: overall.skipped, color: 'var(--status-skipped)' },
    { label: 'ไม่ได้', value: overall.failed, color: '#ff4444' },
    { label: 'ลูกค้าทัก', value: overall.leadReceived, color: 'var(--gold-text)' },
  ];
  const maxBar = Math.max(...barData.map((b) => b.value), 1);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">สรุปผลการแชร์ทุกแคมเปญ</p>
      </div>

      {/* Overall Stats */}
      <div className="section">
        <div className="section-title">📊 ภาพรวมทั้งหมด</div>
        <div className="card">
          <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card"><div className="stat-card-label">ทั้งหมด</div><div className="stat-card-value">{overall.total}</div></div>
            <div className="stat-card"><div className="stat-card-label">โพสต์สำเร็จ</div><div className="stat-card-value" style={{ color: 'var(--status-ready)' }}>{overall.posted}</div></div>
            <div className="stat-card"><div className="stat-card-label">รอแอดมิน</div><div className="stat-card-value" style={{ color: 'var(--status-pending)' }}>{overall.pendingAdmin}</div></div>
            <div className="stat-card"><div className="stat-card-label">อนุมัติแล้ว</div><div className="stat-card-value" style={{ color: 'var(--status-done)' }}>{overall.approved}</div></div>
            <div className="stat-card"><div className="stat-card-label">ข้าม</div><div className="stat-card-value" style={{ color: 'var(--status-skipped)' }}>{overall.skipped}</div></div>
            <div className="stat-card"><div className="stat-card-label">ลูกค้าทัก</div><div className="stat-card-value" style={{ color: 'var(--gold-text)' }}>{overall.leadReceived}</div></div>
            <div className="stat-card"><div className="stat-card-label">Lead records</div><div className="stat-card-value" style={{ color: 'var(--gold-text)' }}>{leads.length}</div></div>
          </div>

          {/* Bar Chart */}
          <div className="section-title">กราฟสถานะรวม</div>
          <div className="bar-chart">
            {barData.map((b) => (
              <div key={b.label} className="bar-col">
                <span className="bar-value">{b.value}</span>
                <div className="bar-fill" style={{ height: `${(b.value / maxBar) * 80}px`, background: b.color }} />
                <span className="bar-label">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Pipeline */}
      <div className="section">
        <div className="section-title">💬 Lead Pipeline</div>
        <div className="card">
          <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="font-bold text-sm">Lead ทั้งหมด {leads.length} รายการ</div>
              <div className="text-xs text-muted">สร้างจากปุ่ม “มีลูกค้าทัก” ใน Share Session</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleExportLeadsCsv}>📊 Export Leads CSV</button>
          </div>
          {leads.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-desc">ยังไม่มี lead ที่บันทึกไว้</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ลูกค้า</th>
                    <th>แคมเปญ</th>
                    <th>กลุ่ม</th>
                    <th>บริการ</th>
                    <th>มูลค่า</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div className="font-bold text-sm">{lead.customerName}</div>
                        <div className="text-xs text-muted">{lead.contactNote}</div>
                      </td>
                      <td>{campaigns.find((c) => c.id === lead.campaignId)?.name || lead.campaignId}</td>
                      <td>{groups.find((g) => g.id === lead.groupId)?.name || lead.groupId}</td>
                      <td>{lead.serviceInterest || '-'}</td>
                      <td>{lead.valueEstimate || '-'}</td>
                      <td><span className="badge badge-gold">{lead.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Per-campaign table */}
      <div className="section">
        <div className="section-title">📋 รายงานต่อแคมเปญ</div>
        {reportRows.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-title">ยังไม่มีข้อมูล</div>
              <div className="empty-state-desc">สร้างแคมเปญและเริ่ม Share Session เพื่อดูรายงาน</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reportRows.map((row) => {
              const { campaign: c, summary: s } = row;
              return (
                <div key={c.id} className="card">
                  <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-muted">{formatDate(c.createdAt)}</div>
                    </div>
                    <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => copySummary(row)}>📋 Copy</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleExportCsv(row)}>📊 CSV</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleExportJson(row)}>💾 JSON</button>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>รวม</th>
                          <th>โพสต์แล้ว</th>
                          <th>รอแอดมิน</th>
                          <th>อนุมัติ</th>
                          <th>ไม่อนุมัติ</th>
                          <th>ข้าม</th>
                          <th>ไม่ได้</th>
                          <th>ลูกค้าทัก</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-bold">{s.total}</td>
                          <td style={{ color: 'var(--status-ready)' }}>{s.posted}</td>
                          <td style={{ color: 'var(--status-pending)' }}>{s.pendingAdmin}</td>
                          <td style={{ color: 'var(--status-done)' }}>{s.approved}</td>
                          <td style={{ color: 'var(--status-blocked)' }}>{s.rejected}</td>
                          <td style={{ color: 'var(--status-skipped)' }}>{s.skipped}</td>
                          <td style={{ color: 'var(--status-blocked)' }}>{s.failed}</td>
                          <td style={{ color: 'var(--gold-text)' }}>{s.leadReceived}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Progress */}
                  {s.total > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div className="flex justify-between text-xs text-muted mb-1">
                        <span>ความคืบหน้า</span>
                        <span>{((s.posted + s.approved + s.skipped + s.failed + s.leadReceived) / s.total * 100).toFixed(0)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${((s.posted + s.approved + s.skipped + s.failed + s.leadReceived) / s.total * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
