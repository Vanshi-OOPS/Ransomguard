import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ShieldAlert, Zap, FolderClock, Activity, TrendingUp,
  AlertTriangle, CheckCircle, Clock, ArrowRight
} from 'lucide-react';
import { getDashboardStats, getMetricHistory, getIncidents, getSystemHealth } from '../services/api';
import type { DashboardStats, MetricPoint, ThreatIncident, SystemHealth } from '../types';
import { formatTs, severityColor } from '../utils/helpers';
import StatusBadge from '../components/StatusBadge';
import ThreatScoreBar from '../components/ThreatScoreBar';
import { Link } from 'react-router-dom';

const COLORS = ['#f43f5e', '#f59e0b', '#fbbf24', '#3b82f6', '#10b981'];

function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
  };
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] ?? colorMap.emerald}`}>
          <Icon className="w-5 h-5" />
        </div>
        <TrendingUp className="w-4 h-4 text-slate-700 group-hover:text-slate-500 transition-colors" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100 font-mono">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-slate-600 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800 border border-white/[0.08] rounded-xl px-4 py-3 shadow-modal text-xs">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}: <span className="font-semibold text-slate-100">{p.value}</span></span>
        </div>
      ))}
    </div>
  );
};

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [incidents, setIncidents] = useState<ThreatIncident[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getMetricHistory(), getIncidents(), getSystemHealth()])
      .then(([s, h, i, sys]) => { setStats(s); setHistory(h); setIncidents(i.slice(0, 5)); setHealth(sys); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const severityDist = [
    { name: 'Critical', value: incidents.filter(i => i.severity === 'critical').length },
    { name: 'High', value: incidents.filter(i => i.severity === 'high').length },
    { name: 'Medium', value: incidents.filter(i => i.severity === 'medium').length },
    { name: 'Low', value: incidents.filter(i => i.severity === 'low').length },
  ].filter(x => x.value > 0);

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Security Operations Center</h2>
          <p className="text-sm text-slate-500 mt-1">RansomGuard · fanotify + inotify detection engine · Linux prototype</p>
        </div>
        <div className="flex items-center gap-3">
          {health && <StatusBadge status={health.status} label={health.status.toUpperCase()} />}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Total Threats Detected" value={stats?.total_threats ?? 0} sub="Last 24h" color="rose" />
        <StatCard icon={ShieldAlert} label="Active Threats" value={stats?.active_threats ?? 0} sub="Needs attention" color="amber" />
        <StatCard icon={FolderClock} label="Backups Available" value={stats?.backups_available ?? 0} sub="Snapshot coverage" color="blue" />
        <StatCard icon={Activity} label="Detection Rate" value={`${stats?.detection_rate_pct ?? 0}%`} sub="vs. attack scenarios" color="emerald" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="Avg. Detection Latency" value={`${((stats?.avg_latency_ms ?? 0)/1000).toFixed(1)}s`} sub="Time to contain" color="indigo" />
        <StatCard icon={Activity} label="Events (24h)" value={stats?.last_24h_events ?? 0} sub="Files + renames" color="blue" />
        <StatCard icon={CheckCircle} label="Files Monitored" value={stats?.files_monitored ?? 0} sub="Sandbox test dir" color="emerald" />
        <StatCard icon={Clock} label="Processes Watched" value={stats?.processes_watched ?? 0} sub="Across all watchers" color="indigo" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="card xl:col-span-2">
          <div className="card-header flex items-center justify-between">
            <div>
              <p className="section-title">Event Timeline (24h)</p>
              <p className="section-subtitle">File events &amp; threat detections</p>
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="thrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="events" name="File Events" stroke="#10b981" fill="url(#evGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="threats" name="Threats" stroke="#f43f5e" fill="url(#thrGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <div className="card-header">
            <p className="section-title">Severity Distribution</p>
            <p className="section-subtitle">All detected incidents</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={severityDist} cx="50%" cy="45%" outerRadius={80} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {severityDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Score histogram */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <p className="section-title">Threat Score History</p>
            <p className="section-subtitle">Peak score per 1-hour window</p>
          </div>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Peak Score" radius={[3, 3, 0, 0]}>
                {history.map((h, i) => (
                  <Cell key={i} fill={h.score >= 120 ? '#f43f5e' : h.score >= 60 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <p className="section-title">Recent Threat Incidents</p>
            <p className="section-subtitle">Latest detections with containment status</p>
          </div>
          <Link to="/incidents" className="btn-secondary text-xs py-1.5 px-3">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {incidents.map(inc => (
            <div key={inc.id} className="flex items-center gap-4 px-5 py-3.5 table-row-hover">
              <div className={`w-2 h-2 rounded-full shrink-0 ${inc.severity === 'critical' ? 'bg-rose-400 shadow-glow-red' : inc.severity === 'high' ? 'bg-amber-400' : 'bg-yellow-400'} animate-pulse-slow`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300 truncate">{inc.exe}</span>
                  <span className={`badge badge-${inc.severity === 'critical' ? 'critical' : inc.severity === 'high' ? 'high' : 'medium'}`}>
                    {inc.severity.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{inc.files_affected} files · {inc.action} · PID {inc.pid}</div>
              </div>
              <div className="text-right shrink-0">
                <ThreatScoreBar score={inc.score} size="sm" />
                <div className="text-[10px] text-slate-600 mt-1">{formatTs(inc.ts, true)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

