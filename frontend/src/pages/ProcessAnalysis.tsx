import React, { useEffect, useState } from 'react';
import { Cpu, Shield, AlertTriangle, Clock } from 'lucide-react';
import { getProcesses } from '../services/api';
import type { ProcessRecord } from '../types';
import { formatTs, cn } from '../utils/helpers';
import ThreatScoreBar from '../components/ThreatScoreBar';
import SearchInput from '../components/SearchInput';

type SortKey = keyof ProcessRecord;

export default function ProcessAnalysis() {
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [stateFilter, setStateFilter] = useState<ProcessRecord['state'] | 'all'>('all');

  useEffect(() => {
    getProcesses().then(d => { setProcesses(d); setLoading(false); });
  }, []);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  const filtered = processes
    .filter(p => stateFilter === 'all' || p.state === stateFilter)
    .filter(p =>
      p.exe.toLowerCase().includes(search.toLowerCase()) ||
      String(p.pid).includes(search) ||
      String(p.ppid).includes(search)
    )
    .sort((a, b) => {
      const av = a[sortKey] as number | string | boolean;
      const bv = b[sortKey] as number | string | boolean;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const stateBadge = (s: ProcessRecord['state']) => ({
    running: 'badge-clean',
    stopped: 'badge-high',
    killed: 'badge-critical',
    unknown: 'badge-low',
  }[s] ?? 'badge-low');

  const cols: { key: SortKey; label: string; hide?: string }[] = [
    { key: 'pid', label: 'PID' },
    { key: 'exe', label: 'Executable' },
    { key: 'ppid', label: 'PPID', hide: 'lg' },
    { key: 'state', label: 'State' },
    { key: 'score', label: 'Threat Score' },
    { key: 'files_touched', label: 'Files', hide: 'md' },
    { key: 'first_seen', label: 'First Seen', hide: 'xl' },
    { key: 'whitelisted', label: 'Whitelisted', hide: 'lg' },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Process Analysis</h2>
          <p className="text-sm text-slate-500 mt-1">All processes observed by the detection engine</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search PID, PPID, exe…" className="w-64" />
        <div className="flex gap-1">
          {(['all', 'running', 'stopped', 'killed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                stateFilter === s ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-navy-700 text-slate-400 hover:text-slate-200'
              )}
            >
              {s.toUpperCase()}
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
                  {cols.map(({ key, label, hide }) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={cn(
                        'px-4 py-3 text-left text-slate-600 font-semibold uppercase tracking-wide text-[10px] cursor-pointer hover:text-slate-400 transition-colors select-none',
                        hide === 'md' && 'hidden md:table-cell',
                        hide === 'lg' && 'hidden lg:table-cell',
                        hide === 'xl' && 'hidden xl:table-cell',
                      )}
                    >
                      {label} {sortKey === key && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-600">
                      <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No processes match
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.pid} className={cn('table-row-hover', p.state === 'killed' && 'bg-rose-500/[0.02]', p.state === 'stopped' && 'bg-amber-500/[0.02]')}>
                    <td className="px-4 py-3 font-mono text-slate-200">{p.pid}</td>
                    <td className="px-4 py-3 font-mono text-slate-300 max-w-[220px]">
                      <div className="truncate">{p.exe}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 hidden lg:table-cell">{p.ppid}</td>
                    <td className="px-4 py-3"><span className={`badge ${stateBadge(p.state)}`}>{p.state}</span></td>
                    <td className="px-4 py-3 w-44">
                      <ThreatScoreBar score={p.score} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{p.files_touched}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap hidden xl:table-cell">{formatTs(p.first_seen, true)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.whitelisted
                        ? <span className="badge badge-clean"><Shield className="w-3 h-3" /> Yes</span>
                        : <span className="text-slate-600">No</span>}
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

