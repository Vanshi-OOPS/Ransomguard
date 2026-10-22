import React, { useEffect, useState } from 'react';
import { FolderOpen, RotateCcw, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';
import { getBackups, restoreFile } from '../services/api';
import type { BackupEntry } from '../types';
import { formatTs, formatBytes, cn } from '../utils/helpers';
import SearchInput from '../components/SearchInput';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export default function FileRecovery() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    getBackups().then(d => { setBackups(d); setLoading(false); });
  }, []);

  async function handleRestore() {
    if (!confirmId) return;
    setRestoring(confirmId);
    setConfirmId(null);
    try {
      const res = await restoreFile(confirmId);
      addToast({
        type: res.success ? 'success' : 'error',
        title: res.success ? 'Restore Simulated' : 'Restore Failed',
        message: res.message,
      });
    } catch (e) {
      addToast({ type: 'error', title: 'Restore Error', message: String(e) });
    } finally {
      setRestoring(null);
    }
  }

  const confirmEntry = backups.find(b => b.id === confirmId);
  const filtered = backups.filter(b =>
    b.original_path.toLowerCase().includes(search.toLowerCase()) ||
    b.sha1.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">File Recovery</h2>
          <p className="text-sm text-slate-500 mt-1">
            Snapshot backups created by the copy-on-first-write mechanism (<code className="text-emerald-400 text-xs">--snapshot</code> mode)
          </p>
        </div>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300/80 leading-relaxed">
          <span className="font-semibold text-amber-400">Demo Mode: </span>
          No actual files will be modified. In production, restoration calls
          <code className="mx-1 text-amber-300">python3 ransomguard.py --restore</code>
          which validates snapshot hashes before overwriting. Only files within watched directories can be restored.
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search path or SHA1…" className="w-72" />
        <div className="text-xs text-slate-500">{filtered.length} backups</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.length === 0 ? (
            <div className="card flex flex-col items-center py-16 text-slate-600">
              <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
              <p>No backups match your search</p>
            </div>
          ) : filtered.map(b => (
            <div key={b.id} className={cn('card p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-white/[0.12] transition-all', restoring === b.id && 'opacity-60')}>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-slate-200 truncate">{b.original_path}</div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span>{formatBytes(b.size_bytes)}</span>
                  <span className="text-slate-700">·</span>
                  <span>Backed up {formatTs(b.created_at, true)}</span>
                  <span className="text-slate-700">·</span>
                  <span className="font-mono text-slate-600 truncate max-w-[120px]">SHA1: {b.sha1.slice(0, 12)}…</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-600 truncate">{b.snapshot_path}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {b.restorable ? (
                  <span className="badge badge-clean"><ShieldCheck className="w-3 h-3" /> Restorable</span>
                ) : (
                  <span className="badge badge-low">Unavailable</span>
                )}
                <button
                  onClick={() => setConfirmId(b.id)}
                  disabled={!b.restorable || restoring === b.id}
                  className={cn('btn-secondary text-xs py-1.5', !b.restorable && 'opacity-40 cursor-not-allowed')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {restoring === b.id ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmId}
        title="Confirm File Restoration"
        variant="warning"
        confirmLabel="Restore File"
        description={`This will restore "${confirmEntry?.original_path ?? ''}" from snapshot to its original location.

In Demo Mode: no actual file operation will occur. In production, this operation requires root privileges and will overwrite the current file at the destination path. Ensure the destination is safe before proceeding.`}
        onConfirm={handleRestore}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

