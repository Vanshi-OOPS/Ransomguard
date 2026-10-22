import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Shield, X, AlertTriangle, Clock, FileText } from 'lucide-react';
import { getIncidents } from '../services/api';
import type { ThreatIncident, Severity } from '../types';
import { formatTs, severityColor, cn } from '../utils/helpers';
import ThreatScoreBar from '../components/ThreatScoreBar';
import SearchInput from '../components/SearchInput';

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'clean'];

function EvidenceRow({ e }: { e: ThreatIncident['evidence'][0] }) {
  const kindColor = {
    entropy: 'text-rose-400 bg-rose-500/10',
    rename: 'text-amber-400 bg-amber-500/10',
    rate: 'text-orange-400 bg-orange-500/10',
    write: 'text-blue-400 bg-blue-500/10',
  }[e.kind] ?? 'text-slate-400 bg-slate-500/10';

  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className={cn('badge shrink-0 mt-0.5', kindColor)}>{e.kind}</span>
      <div className="flex-1 min-w-0">
        {e.path && <div className="font-mono text-xs text-slate-400 truncate">{e.path}</div>}
        <div className="text-xs text-slate-500 mt-0.5">{e.detail}</div>
      </div>
      <div className="shrink-0 text-xs font-mono font-semibold text-amber-400">+{e.pts}pts</div>
    </div>
  );
}

function IncidentRow({ inc }: { inc: ThreatIncident }) {
  const [expanded, setExpanded] = useState(false);

  const actionBadge = inc.action === 'SIGKILL'
    ? 'badge-critical'
    : inc.action === 'SIGSTOP'
    ? 'badge-high'
    : 'badge-low';

  return (
    <>
      <tr className={cn('table-row-hover', expanded && 'bg-white/[0.02]')} onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full shrink-0 animate-pulse-slow',
              inc.severity === 'critical' ? 'bg-rose-400' : inc.severity === 'high' ? 'bg-amber-400' : 'bg-yellow-400'
            )} />
            <span className={cn('text-xs font-semibold uppercase', severityColor(inc.severity))}>{inc.severity}</span>
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-400">{inc.id}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-[200px] truncate">{inc.exe}</td>
        <td className="px-4 py-3 text-xs text-slate-400 font-mono">PID {inc.pid}</td>
        <td className="px-4 py-3 w-36 hidden md:table-cell"><ThreatScoreBar score={inc.score} size="sm" /></td>
        <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">{inc.files_affected}</td>
        <td className="px-4 py-3 hidden lg:table-cell"><span className={`badge ${actionBadge}`}>{inc.action}</span></td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap hidden xl:table-cell">{formatTs(inc.ts, true)}</td>
        <td className="px-4 py-3 text-slate-500">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-navy-900/50">
          <td colSpan={9} className="px-8 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Details */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Incident Details</h4>
                <div className="space-y-2 text-xs">
                  {[
                    ['Group PID', inc.group_pid],
                    ['Detection Latency', `${inc.latency_sec.toFixed(3)}s`],
                    ['Files Affected', inc.files_affected],
                    ['Containment', inc.contained ? '✓ Contained' : '✗ Not contained'],
                    ['Process State', inc.state],
                    ['Timestamp', formatTs(inc.ts)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-mono text-slate-300">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Evidence */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Evidence ({inc.evidence.length} signals)
                </h4>
                <div>
                  {inc.evidence.map((e, i) => <EvidenceRow key={i} e={e} />)}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ThreatIncidents() {
  const [incidents, setIncidents] = useState<ThreatIncident[]>([]);
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIncidents().then(d => { setIncidents(d); setLoading(false); });
  }, []);

  const filtered = incidents
    .filter(i => sevFilter === 'all' || i.severity === sevFilter)
    .filter(i =>
      i.exe.toLowerCase().includes(search.toLowerCase()) ||
      String(i.pid).includes(search) ||
      i.id.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.ts - a.ts);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Threat Incidents</h2>
          <p className="text-sm text-slate-500 mt-1">{incidents.length} total incidents detected by the RansomGuard engine</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search PID, exe, ID…" className="w-64" />
        <div className="flex gap-1">
          {(['all', ...SEV_ORDER] as const).map(s => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                sevFilter === s
                  ? s === 'all'
                    ? 'bg-slate-600 text-white'
                    : `badge-${s === 'clean' ? 'clean' : s === 'critical' ? 'critical' : s === 'high' ? 'high' : s === 'medium' ? 'medium' : 'low'} bg-opacity-100`
                  : 'bg-navy-700 text-slate-400 hover:text-slate-200'
              )}
            >
              {s === 'all' ? 'All' : s.toUpperCase()}
            </button>
          ))}
        </div>
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
                  {['Severity', 'ID', 'Executable', 'PID', 'Score', 'Files', 'Action', 'Time', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-slate-600 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-600">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No incidents match your filter
                    </td>
                  </tr>
                ) : filtered.map(inc => <IncidentRow key={inc.id} inc={inc} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

