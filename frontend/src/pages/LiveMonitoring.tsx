import React, { useEffect, useState, useRef } from 'react';
import { Activity, AlertTriangle, FileText, RefreshCw, Eye } from 'lucide-react';
import { getFileEvents, getProcesses } from '../services/api';
import type { FileEvent, ProcessRecord } from '../types';
import { formatTs, cn } from '../utils/helpers';
import SearchInput from '../components/SearchInput';
import ThreatScoreBar from '../components/ThreatScoreBar';

function EntropyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = (value / 8) * 100;
  const color = value >= 7.5 ? 'bg-rose-500' : value >= 6 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400">{value.toFixed(2)}</span>
    </div>
  );
}

export default function LiveMonitoring() {
  const [events, setEvents] = useState<FileEvent[]>([]);
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'events' | 'processes'>('events');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const [ev, pr] = await Promise.all([getFileEvents(), getProcesses()]);
    setEvents(ev);
    setProcesses(pr);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh]);

  const filteredEvents = events.filter(e =>
    e.path.toLowerCase().includes(search.toLowerCase()) ||
    e.exe.toLowerCase().includes(search.toLowerCase()) ||
    String(e.pid).includes(search)
  );

  const filteredProcs = processes.filter(p =>
    p.exe.toLowerCase().includes(search.toLowerCase()) ||
    String(p.pid).includes(search)
  );

  const kindBadge = (k: FileEvent['kind']) => {
    const map = {
      write: 'bg-blue-500/20 text-blue-400',
      rename: 'bg-amber-500/20 text-amber-400',
      delete: 'bg-rose-500/20 text-rose-400',
      create: 'bg-emerald-500/20 text-emerald-400',
      read: 'bg-slate-500/20 text-slate-400',
    };
    return map[k] ?? map.read;
  };

  const procStateBadge = (s: ProcessRecord['state']) => {
    const map = {
      running: 'badge-clean',
      stopped: 'badge-high',
      killed: 'badge-critical',
      unknown: 'badge-low',
    };
    return map[s] ?? 'badge-low';
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Live Monitoring</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time filesystem activity and process tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(r => !r)}
            className={cn('btn-secondary', autoRefresh && 'border-emerald-500/30 text-emerald-400')}
          >
            <div className={cn('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex border-b border-transparent">
            <button className={tab === 'events' ? 'tab-active' : 'tab'} onClick={() => setTab('events')}>
              <FileText className="w-3.5 h-3.5 inline mr-1.5" />File Events ({events.length})
            </button>
            <button className={tab === 'processes' ? 'tab-active' : 'tab'} onClick={() => setTab('processes')}>
              <Activity className="w-3.5 h-3.5 inline mr-1.5" />Processes ({processes.length})
            </button>
          </div>
          <div className="sm:ml-auto">
            <SearchInput value={search} onChange={setSearch} placeholder="Filter path, PID, exe…" className="w-64" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'events' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Time', 'Kind', 'Path', 'PID / Exe', 'Entropy', 'Flagged'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-slate-600 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredEvents.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-600">No events match your filter</td></tr>
                ) : filteredEvents.map(ev => (
                  <tr key={ev.id} className="table-row-hover">
                    <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">{formatTs(ev.ts)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', kindBadge(ev.kind))}>{ev.kind}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300 max-w-[240px] truncate">{ev.path}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-400 font-mono">PID {ev.pid}</div>
                      <div className="text-slate-600 truncate max-w-[160px]">{ev.exe}</div>
                    </td>
                    <td className="px-4 py-3"><EntropyBar value={ev.entropy} /></td>
                    <td className="px-4 py-3">
                      {ev.flagged ? (
                        <span className="flex items-center gap-1 text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['PID', 'Executable', 'PPID', 'State', 'Threat Score', 'Files Touched', 'Whitelisted'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-slate-600 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredProcs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-600">No processes match</td></tr>
                ) : filteredProcs.map(p => (
                  <tr key={p.pid} className="table-row-hover">
                    <td className="px-4 py-3 font-mono text-slate-300">{p.pid}</td>
                    <td className="px-4 py-3 font-mono text-slate-300 max-w-[200px] truncate">{p.exe}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{p.ppid}</td>
                    <td className="px-4 py-3"><span className={`badge ${procStateBadge(p.state)}`}>{p.state}</span></td>
                    <td className="px-4 py-3 w-36"><ThreatScoreBar score={p.score} size="sm" /></td>
                    <td className="px-4 py-3 text-slate-400">{p.files_touched}</td>
                    <td className="px-4 py-3">
                      {p.whitelisted
                        ? <span className="text-emerald-400 flex items-center gap-1"><Eye className="w-3 h-3" /> Yes</span>
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

