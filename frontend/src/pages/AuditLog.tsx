import React, { useEffect, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { getAuditLog } from '../services/api';
import type { AuditLogEntry } from '../types';
import { formatTs, exportToCsv, cn } from '../utils/helpers';
import SearchInput from '../components/SearchInput';

type Level = AuditLogEntry['level'] | 'all';

const levelBadge = (l: AuditLogEntry['level']) => ({
  info: 'badge-clean',
  warning: 'badge-high',
  error: 'badge-critical',
  critical: 'badge-critical',
}[l] ?? 'badge-low');

const levelRow = (l: AuditLogEntry['level']) => ({
  info: '',
  warning: 'bg-amber-500/[0.025]',
  error: 'bg-rose-500/[0.03]',
  critical: 'bg-rose-500/[0.05]',
}[l] ?? '');

export default function AuditLog() {
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<Level>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog().then(d => { setLog(d); setLoading(false); });
  }, []);

  const filtered = log
    .filter(e => levelFilter === 'all' || e.level === levelFilter)
    .filter(e =>
      e.event.toLowerCase().includes(search.toLowerCase()) ||
      e.detail.toLowerCase().includes(search.toLowerCase()) ||
      (e.exe ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(e.pid ?? '').includes(search)
    )
    .sort((a, b) => b.ts - a.ts);

  function handleExport() {
    exportToCsv(filtered.map(e => ({
      timestamp: formatTs(e.ts),
      event: e.event,
      level: e.level,
      pid: e.pid ?? '',
      exe: e.exe ?? '',
      score: e.score ?? '',
      action: e.action ?? '',
      detail: e.detail,
    })), `ransomguard_audit_${Date.now()}.csv`);
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Activity & Audit Log</h2>
          <p className="text-sm text-slate-500 mt-1">
            All engine events from <code className="text-emerald-400 text-xs">{`{log_file}`}</code> — JSON-lines format
          </p>
        </div>
        <button onClick={handleExport} className="btn-secondary">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search event, exe, detail…" className="w-72" />
        <div className="flex gap-1">
          {(['all', 'info', 'warning', 'error', 'critical'] as Level[]).map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                levelFilter === l
                  ? l === 'all' ? 'bg-slate-600 text-white' : `badge ${levelBadge(l as AuditLogEntry['level'])}`
                  : 'bg-navy-700 text-slate-400 hover:text-slate-200'
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} entries</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Timestamp', 'Event', 'Level', 'PID / Exe', 'Score', 'Action', 'Detail'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-slate-600 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-600">No log entries match</td>
                  </tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className={cn('table-row-hover', levelRow(e.level))}>
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{formatTs(e.ts)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-200">{e.event}</td>
                    <td className="px-4 py-3"><span className={`badge ${levelBadge(e.level)}`}>{e.level}</span></td>
                    <td className="px-4 py-3">
                      {e.pid && <div className="font-mono text-slate-400">PID {e.pid}</div>}
                      {e.exe && <div className="text-slate-600 truncate max-w-[140px]">{e.exe}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{e.score ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.action
                        ? <span className={e.action.includes('KILL') ? 'text-rose-400' : 'text-amber-400'}>{e.action}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[280px]">
                      <div className="truncate" title={e.detail}>{e.detail}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

