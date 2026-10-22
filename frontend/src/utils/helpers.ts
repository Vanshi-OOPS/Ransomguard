import { clsx } from 'clsx';
import type { Severity } from '../types';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}

export function severityColor(s: Severity) {
  return {
    critical: 'text-rose-400',
    high: 'text-amber-400',
    medium: 'text-yellow-400',
    low: 'text-blue-400',
    clean: 'text-emerald-400',
  }[s];
}

export function severityBgColor(s: Severity) {
  return {
    critical: 'bg-rose-500/10 border-rose-500/20',
    high: 'bg-amber-500/10 border-amber-500/20',
    medium: 'bg-yellow-500/10 border-yellow-500/20',
    low: 'bg-blue-500/10 border-blue-500/20',
    clean: 'bg-emerald-500/10 border-emerald-500/20',
  }[s];
}

export function severityLabel(s: Severity) {
  return s.toUpperCase();
}

export function formatTs(ts: number, relative = false): string {
  const d = new Date(ts * 1000);
  if (relative) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, 'HH:mm:ss yyyy-MM-dd');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
}

export function scoreToSeverity(score: number): Severity {
  if (score >= 120) return 'critical';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 30) return 'low';
  return 'clean';
}

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
