import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, RotateCcw, Plus, X, Info, AlertTriangle } from 'lucide-react';
import { getConfig, updateConfig } from '../services/api';
import type { DetectionConfig } from '../types';
import { useToast } from '../components/Toast';
import { cn } from '../utils/helpers';

function NumberField({ label, name, value, onChange, min, max, step = 1, hint }: {
  label: string; name: string; value: number; onChange: (name: string, v: number) => void;
  min?: number; max?: number; step?: number; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-400">{label}</label>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(name, parseFloat(e.target.value))}
        className="input font-mono"
      />
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

function TagList({ label, values, onChange, hint }: {
  label: string; values: string[]; onChange: (vals: string[]) => void; hint?: string;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  }
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-400">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2.5 bg-navy-900 border border-white/[0.08] rounded-lg min-h-[48px]">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 bg-navy-700 border border-white/[0.08] rounded-full text-xs font-mono text-slate-300">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="text-slate-600 hover:text-slate-300 ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add…"
          className="flex-1 min-w-[80px] bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none"
        />
      </div>
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<DetectionConfig | null>(null);
  const [original, setOriginal] = useState<DetectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    getConfig().then(d => {
      setCfg(JSON.parse(JSON.stringify(d)));
      setOriginal(JSON.parse(JSON.stringify(d)));
      setLoading(false);
    });
  }, []);

  function update(key: string, value: unknown) {
    setCfg(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function updateNum(key: string, value: number) {
    update(key, value);
  }

  async function handleSave() {
    if (!cfg) return;
    setSaving(true);
    try {
      await updateConfig(cfg);
      setOriginal(JSON.parse(JSON.stringify(cfg)));
      addToast({ type: 'success', title: 'Settings Saved', message: 'Demo Mode: changes are not persisted to disk.' });
    } catch (e) {
      addToast({ type: 'error', title: 'Save Failed', message: String(e) });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (original) setCfg(JSON.parse(JSON.stringify(original)));
    addToast({ type: 'info', title: 'Settings Reset', message: 'Reverted to last saved values.' });
  }

  const isDirty = JSON.stringify(cfg) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!cfg) return null;

  return (
    <div className="space-y-6 max-w-[900px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Detection Settings</h2>
          <p className="text-sm text-slate-500 mt-1">
            Maps to <code className="text-emerald-400 text-xs">config.json</code> — the RansomGuard engine configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} disabled={!isDirty} className={cn('btn-secondary', !isDirty && 'opacity-40 cursor-not-allowed')}>
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving || !isDirty} className={cn('btn-primary', (saving || !isDirty) && 'opacity-60 cursor-not-allowed')}>
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          You have unsaved changes. Click "Save Changes" to apply.
        </div>
      )}

      {/* Demo notice */}
      <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-xs text-indigo-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Demo Mode: edits are reflected in the UI only. In production, saving updates <code className="mx-1">config.json</code> and requires restarting the engine.
      </div>

      {/* Scoring Thresholds */}
      <section className="card">
        <div className="card-header">
          <p className="section-title">Scoring Thresholds</p>
          <p className="section-subtitle">Point thresholds that trigger containment actions</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NumberField label="Suspend Score (SIGSTOP)" name="suspend_score" value={cfg.suspend_score} onChange={updateNum} min={0} hint="Score at which process is suspended" />
          <NumberField label="Kill Score (SIGKILL)" name="kill_score" value={cfg.kill_score} onChange={updateNum} min={0} hint="Score at which process is killed" />
          <NumberField label="Kill After Suspend (sec)" name="kill_after_suspend_sec" value={cfg.kill_after_suspend_sec} onChange={updateNum} min={1} hint="Grace period before escalating SIGSTOP → SIGKILL" />
        </div>
      </section>

      {/* Signal Weights */}
      <section className="card">
        <div className="card-header">
          <p className="section-title">Signal Weights</p>
          <p className="section-subtitle">Points added per detected signal type</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NumberField label="Entropy Points" name="entropy_points" value={cfg.entropy_points} onChange={updateNum} min={0} hint="Added when Shannon entropy ≥ threshold" />
          <NumberField label="Rate Points" name="rate_points" value={cfg.rate_points} onChange={updateNum} min={0} hint="Added when file rate exceeds threshold" />
          <NumberField label="Extension Change Points" name="ext_change_points" value={cfg.ext_change_points} onChange={updateNum} min={0} hint="Added on unknown extension rename" />
          <NumberField label="Write Points" name="write_points" value={cfg.write_points} onChange={updateNum} min={0} hint="Base points for each write event" />
          <NumberField label="Entropy Threshold (bits)" name="entropy_threshold" value={cfg.entropy_threshold} onChange={updateNum} min={0} max={8} step={0.1} hint="Shannon entropy above which a write is flagged" />
          <NumberField label="Min Sample Bytes" name="min_sample_bytes" value={cfg.min_sample_bytes} onChange={updateNum} min={64} hint="Minimum file size to check entropy" />
        </div>
      </section>

      {/* Rate Detection */}
      <section className="card">
        <div className="card-header">
          <p className="section-title">Rate Detection</p>
          <p className="section-subtitle">Sliding window parameters</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <NumberField label="Window (seconds)" name="window_sec" value={cfg.window_sec} onChange={updateNum} min={1} hint="Sliding time window for score accumulation" />
          <NumberField label="Rate Threshold (files)" name="rate_threshold_files" value={cfg.rate_threshold_files} onChange={updateNum} min={1} hint="File count in window to trigger rate_points" />
          <NumberField label="Group Parent Min Members" name="group_parent_min_members" value={cfg.group_parent_min_members} onChange={updateNum} min={1} hint="Min parallel workers before freezing parent too" />
          <NumberField label="Snapshot Max (MB)" name="snapshot_max_mb" value={cfg.snapshot_max_mb} onChange={updateNum} min={1} hint="Max file size to snapshot in --snapshot mode" />
        </div>
      </section>

      {/* Lists */}
      <section className="card">
        <div className="card-header">
          <p className="section-title">Whitelist & Extension Lists</p>
          <p className="section-subtitle">Press Enter to add an item, click × to remove</p>
        </div>
        <div className="p-5 space-y-5">
          <TagList
            label="Whitelisted Executables"
            values={cfg.whitelist_exe}
            onChange={v => update('whitelist_exe', v)}
            hint="These executables are never flagged regardless of score"
          />
          <TagList
            label="Natural High-Entropy Extensions (skip entropy check)"
            values={cfg.natural_high_entropy_ext}
            onChange={v => update('natural_high_entropy_ext', v)}
          />
          <TagList
            label="Known Good Extensions (prevent ext-change penalty)"
            values={cfg.known_ext}
            onChange={v => update('known_ext', v)}
          />
          <TagList
            label="Watch Directories"
            values={cfg.watch_dirs}
            onChange={v => update('watch_dirs', v)}
            hint="Directories monitored by fanotify"
          />
        </div>
      </section>

      {/* Paths */}
      <section className="card">
        <div className="card-header">
          <p className="section-title">File Paths</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { key: 'snapshot_dir', label: 'Snapshot Directory' },
            { key: 'log_file', label: 'Log File Path' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">{label}</label>
              <input
                value={(cfg as any)[key]}
                onChange={e => update(key, e.target.value)}
                className="input font-mono"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

