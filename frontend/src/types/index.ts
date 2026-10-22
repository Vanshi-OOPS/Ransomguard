// ─── Types matching ransomguard.py backend ──────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'clean';
export type ContainmentAction = 'SIGSTOP' | 'SIGKILL' | 'none';
export type ProcessState = 'running' | 'stopped' | 'killed' | 'unknown';
export type SimMode = 'copy' | 'inplace';

export interface ThreatIncident {
  id: string;
  ts: number;           // unix timestamp
  pid: number;
  group_pid: number;
  exe: string;
  score: number;
  files_affected: number;
  latency_sec: number;
  action: ContainmentAction;
  state: ProcessState;
  severity: Severity;
  evidence: EvidenceEntry[];
  contained: boolean;
}

export interface EvidenceEntry {
  kind: 'write' | 'rename' | 'entropy' | 'rate';
  path: string;
  detail: string;
  pts: number;
  ts: number;
}

export interface ProcessRecord {
  pid: number;
  exe: string;
  ppid: number;
  state: ProcessState;
  score: number;
  files_touched: number;
  first_seen: number;
  last_seen: number;
  whitelisted: boolean;
}

export interface FileEvent {
  id: string;
  ts: number;
  kind: 'write' | 'rename' | 'delete' | 'create' | 'read';
  path: string;
  pid: number;
  exe: string;
  entropy: number | null;
  flagged: boolean;
}

export interface BackupEntry {
  id: string;
  original_path: string;
  snapshot_path: string;
  size_bytes: number;
  created_at: number;
  sha1: string;
  restorable: boolean;
}

export interface AuditLogEntry {
  id: string;
  ts: number;
  event: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  pid?: number;
  exe?: string;
  score?: number;
  files?: number;
  action?: string;
  detail: string;
}

export interface DetectionConfig {
  watch_dirs: string[];
  window_sec: number;
  rate_threshold_files: number;
  rate_points: number;
  entropy_threshold: number;
  write_points: number;
  group_parent_min_members: number;
  entropy_points: number;
  min_sample_bytes: number;
  ext_change_points: number;
  suspend_score: number;
  kill_score: number;
  kill_after_suspend_sec: number;
  whitelist_exe: string[];
  natural_high_entropy_ext: string[];
  known_ext: string[];
  snapshot_dir: string;
  snapshot_max_mb: number;
  log_file: string;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  engine_running: boolean;
  watch_dirs: string[];
  uptime_sec: number;
  events_processed: number;
  threats_detected: number;
  last_threat_ts: number | null;
  demo_mode: boolean;
  version: string;
}

export interface SimulationRun {
  id: string;
  scenario: string;
  kind: 'attack' | 'benign';
  workers: number;
  delay: number;
  limit: number;
  mode: SimMode;
  status: 'idle' | 'running' | 'detected' | 'completed' | 'error';
  started_at: number | null;
  ended_at: number | null;
  files_processed: number;
  detected: boolean;
  latency_sec: number | null;
  verdict: 'PASS' | 'FAIL' | 'PENDING' | null;
}

export interface MetricPoint {
  ts: number;
  label: string;
  events: number;
  threats: number;
  score: number;
}

export interface DashboardStats {
  total_threats: number;
  active_threats: number;
  files_monitored: number;
  processes_watched: number;
  backups_available: number;
  detection_rate_pct: number;
  avg_latency_ms: number;
  last_24h_events: number;
}
