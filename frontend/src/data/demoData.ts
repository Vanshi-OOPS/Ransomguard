import type {
  ThreatIncident, ProcessRecord, FileEvent, BackupEntry,
  AuditLogEntry, DetectionConfig, SystemHealth, SimulationRun,
  MetricPoint, DashboardStats, Severity
} from '../types';

// ─── Demo Data Generator ─────────────────────────────────────────────────────

const exes = [
  '/tmp/rg_test/attacker', '/usr/bin/python3', '/usr/bin/openssl',
  '/tmp/malware_x64', '/home/user/.local/bad.sh', '/bin/bash',
];

const paths = [
  '/tmp/rg_test/victim/document.txt', '/tmp/rg_test/victim/report.docx',
  '/tmp/rg_test/victim/data.csv', '/tmp/rg_test/victim/photo.jpg',
  '/tmp/rg_test/victim/backup.zip', '/tmp/rg_test/victim/notes.md',
  '/home/user/Desktop/thesis.pdf', '/home/user/Documents/budget.xlsx',
];

const now = Date.now() / 1000;

function randBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function randInt(a: number, b: number) {
  return Math.floor(randBetween(a, b));
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length)];
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function scoreToSeverity(score: number): Severity {
  if (score >= 120) return 'critical';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 30) return 'low';
  return 'clean';
}

// ─── Deterministic demo incidents from results.csv ───────────────────────────
export const DEMO_INCIDENTS: ThreatIncident[] = [
  {
    id: 'A1', ts: now - 3600, pid: 4231, group_pid: 4230, exe: '/tmp/rg_test/attacker',
    score: 135, files_affected: 6, latency_sec: 0.117, action: 'SIGKILL',
    state: 'killed', severity: 'critical', contained: true,
    evidence: [
      { kind: 'entropy', path: paths[0], detail: 'Shannon entropy 7.92 > threshold 7.5', pts: 10, ts: now - 3601 },
      { kind: 'rename', path: paths[0] + '.locked', detail: 'Extension changed .txt → .locked (unknown ext)', pts: 15, ts: now - 3600.9 },
      { kind: 'rate', path: '', detail: '50 files/s exceeds rate_threshold_files=15', pts: 20, ts: now - 3600.8 },
      { kind: 'write', path: paths[1], detail: 'High-entropy write 8.0 bits/byte', pts: 10, ts: now - 3600.7 },
    ],
  },
  {
    id: 'A5', ts: now - 2700, pid: 4890, group_pid: 4889, exe: '/tmp/rg_test/attacker',
    score: 128, files_affected: 3, latency_sec: 0.008, action: 'SIGKILL',
    state: 'killed', severity: 'critical', contained: true,
    evidence: [
      { kind: 'entropy', path: paths[2], detail: 'Shannon entropy 7.88', pts: 10, ts: now - 2701 },
      { kind: 'rename', path: paths[2] + '.locked', detail: 'Extension changed .csv → .locked', pts: 15, ts: now - 2700.9 },
      { kind: 'rate', path: '', detail: '4 parallel workers detected (group parent min members=3)', pts: 20, ts: now - 2700.8 },
    ],
  },
  {
    id: 'A2', ts: now - 1800, pid: 5110, group_pid: 5110, exe: '/usr/bin/python3',
    score: 95, files_affected: 6, latency_sec: 2.52, action: 'SIGSTOP',
    state: 'stopped', severity: 'high', contained: true,
    evidence: [
      { kind: 'entropy', path: paths[4], detail: 'Shannon entropy 7.75', pts: 10, ts: now - 1801 },
      { kind: 'write', path: paths[5], detail: 'High-entropy overwrite', pts: 10, ts: now - 1800.5 },
      { kind: 'rename', path: paths[3] + '.enc', detail: 'Extension changed .jpg → .enc', pts: 15, ts: now - 1800.2 },
    ],
  },
  {
    id: 'A6', ts: now - 900, pid: 5555, group_pid: 5554, exe: '/usr/bin/openssl',
    score: 142, files_affected: 6, latency_sec: 0.353, action: 'SIGKILL',
    state: 'killed', severity: 'critical', contained: true,
    evidence: [
      { kind: 'entropy', path: paths[6], detail: 'AES-256 CBC output entropy 8.0', pts: 10, ts: now - 901 },
      { kind: 'rename', path: paths[6] + '.locked', detail: 'Extension .pdf → .locked', pts: 15, ts: now - 900.8 },
      { kind: 'rate', path: '', detail: 'One openssl child per file; 6 files in 0.353s', pts: 20, ts: now - 900.5 },
      { kind: 'write', path: paths[7], detail: 'High-entropy write from openssl', pts: 10, ts: now - 900.3 },
    ],
  },
  {
    id: 'A3', ts: now - 300, pid: 6000, group_pid: 6000, exe: '/tmp/malware_x64',
    score: 72, files_affected: 8, latency_sec: 7.021, action: 'SIGSTOP',
    state: 'stopped', severity: 'medium', contained: true,
    evidence: [
      { kind: 'entropy', path: paths[1], detail: 'Shannon entropy 7.6', pts: 10, ts: now - 305 },
      { kind: 'write', path: paths[2], detail: 'Slow write pattern 1 file/s', pts: 0, ts: now - 302 },
      { kind: 'rename', path: paths[1] + '.locked', detail: '.docx → .locked', pts: 15, ts: now - 300 },
    ],
  },
];

export const DEMO_PROCESSES: ProcessRecord[] = [
  { pid: 4231, exe: '/tmp/rg_test/attacker', ppid: 4230, state: 'killed', score: 135, files_touched: 6, first_seen: now - 3601, last_seen: now - 3598, whitelisted: false },
  { pid: 4890, exe: '/tmp/rg_test/attacker', ppid: 4889, state: 'killed', score: 128, files_touched: 3, first_seen: now - 2701, last_seen: now - 2699, whitelisted: false },
  { pid: 5110, exe: '/usr/bin/python3', ppid: 1, state: 'stopped', score: 95, files_touched: 6, first_seen: now - 1801, last_seen: now - 1795, whitelisted: false },
  { pid: 5555, exe: '/usr/bin/openssl', ppid: 5554, state: 'killed', score: 142, files_touched: 6, first_seen: now - 901, last_seen: now - 898, whitelisted: false },
  { pid: 6000, exe: '/tmp/malware_x64', ppid: 1, state: 'stopped', score: 72, files_touched: 8, first_seen: now - 307, last_seen: now - 299, whitelisted: false },
  { pid: 1001, exe: '/usr/bin/rsync', ppid: 1, state: 'running', score: 0, files_touched: 120, first_seen: now - 7200, last_seen: now - 10, whitelisted: true },
  { pid: 1002, exe: '/usr/bin/apt', ppid: 1, state: 'running', score: 0, files_touched: 45, first_seen: now - 1200, last_seen: now - 60, whitelisted: true },
  { pid: 2001, exe: '/usr/bin/vim', ppid: 1, state: 'running', score: 2, files_touched: 3, first_seen: now - 400, last_seen: now - 5, whitelisted: false },
];

export const DEMO_FILE_EVENTS: FileEvent[] = Array.from({ length: 40 }, (_, i) => ({
  id: uid(),
  ts: now - i * 90,
  kind: pick(['write', 'rename', 'write', 'write', 'rename'] as const),
  path: pick(paths) + (Math.random() > 0.6 ? '.locked' : ''),
  pid: pick([4231, 4890, 5110, 5555, 6000, 1001, 2001]),
  exe: pick(exes),
  entropy: Math.random() > 0.3 ? parseFloat(randBetween(4, 8).toFixed(2)) : null,
  flagged: Math.random() > 0.6,
}));

export const DEMO_BACKUPS: BackupEntry[] = paths.map((p, i) => ({
  id: uid(),
  original_path: p,
  snapshot_path: `/tmp/rg_test/snapshots/${uid()}`,
  size_bytes: randInt(1024, 150000),
  created_at: now - i * 500 - 100,
  sha1: Math.random().toString(36).slice(2, 42),
  restorable: true,
}));

export const DEMO_AUDIT_LOG: AuditLogEntry[] = [
  { id: uid(), ts: now - 3600, event: 'CONTAIN', level: 'critical', pid: 4231, exe: exes[0], score: 135, files: 6, action: 'SIGKILL', detail: 'Process killed: score exceeded kill_score=120' },
  { id: uid(), ts: now - 3601, event: 'START', level: 'info', detail: 'RansomGuard engine started, watching /tmp/rg_test/victim' },
  { id: uid(), ts: now - 2700, event: 'CONTAIN', level: 'critical', pid: 4890, exe: exes[0], score: 128, files: 3, action: 'SIGKILL', detail: 'Parallel workers detected; group contained via parent PID' },
  { id: uid(), ts: now - 1800, event: 'CONTAIN', level: 'warning', pid: 5110, exe: exes[1], score: 95, files: 6, action: 'SIGSTOP', detail: 'Process suspended: score=95 ≥ suspend_score=60' },
  { id: uid(), ts: now - 900, event: 'CONTAIN', level: 'critical', pid: 5555, exe: exes[2], score: 142, files: 6, action: 'SIGKILL', detail: 'Real AES-256 encryption detected via openssl; killed' },
  { id: uid(), ts: now - 850, event: 'SNAPSHOT', level: 'info', detail: 'Snapshot created: 6 files backed up to /tmp/rg_test/snapshots' },
  { id: uid(), ts: now - 300, event: 'CONTAIN', level: 'warning', pid: 6000, exe: exes[3], score: 72, files: 8, action: 'SIGSTOP', detail: 'Slow ransomware detected after 7.0s window' },
  { id: uid(), ts: now - 60, event: 'TICK', level: 'info', detail: 'Escalation timer check: no pending escalations' },
  { id: uid(), ts: now - 10, event: 'WRITE', level: 'info', pid: 2001, exe: '/usr/bin/vim', detail: 'Low-entropy write, score=2, below thresholds' },
];

export const DEMO_METRIC_HISTORY: MetricPoint[] = Array.from({ length: 24 }, (_, i) => ({
  ts: now - (23 - i) * 3600,
  label: `${String(new Date(Date.now() - (23 - i) * 3600000).getHours()).padStart(2, '0')}:00`,
  events: randInt(10, 120),
  threats: i >= 20 ? randInt(1, 3) : 0,
  score: i >= 20 ? randInt(60, 145) : 0,
}));

export const DEMO_STATS: DashboardStats = {
  total_threats: 5,
  active_threats: 2,
  files_monitored: 60,
  processes_watched: 8,
  backups_available: 8,
  detection_rate_pct: 100,
  avg_latency_ms: 2000,
  last_24h_events: 487,
};

export const DEMO_HEALTH: SystemHealth = {
  status: 'warning',
  engine_running: true,
  watch_dirs: ['/tmp/rg_test/victim'],
  uptime_sec: 7200,
  events_processed: 487,
  threats_detected: 5,
  last_threat_ts: now - 300,
  demo_mode: true,
  version: '1.0.0-prototype',
};

export const DEMO_CONFIG: DetectionConfig = {
  watch_dirs: ['/tmp/rg_test/victim'],
  window_sec: 5,
  rate_threshold_files: 15,
  rate_points: 20,
  entropy_threshold: 7.5,
  write_points: 0,
  group_parent_min_members: 3,
  entropy_points: 10,
  min_sample_bytes: 512,
  ext_change_points: 15,
  suspend_score: 60,
  kill_score: 120,
  kill_after_suspend_sec: 5,
  whitelist_exe: ['/usr/bin/rsync', '/usr/bin/apt', '/usr/bin/dpkg'],
  natural_high_entropy_ext: ['.zip', '.gz', '.xz', '.bz2', '.7z', '.jpg', '.jpeg', '.png', '.mp3', '.mp4', '.pdf', '.docx', '.xlsx', '.pptx'],
  known_ext: ['.txt', '.md', '.csv', '.json', '.log', '.py', '.c', '.h', '.cpp', '.html', '.css', '.js', '.doc', '.docx', '.xlsx', '.pptx', '.pdf', '.jpg', '.png', '.zip', '.gz', '.tmp'],
  snapshot_dir: '/tmp/rg_test/snapshots',
  snapshot_max_mb: 50,
  log_file: '/tmp/rg_test/ransomguard.log',
};

export const DEMO_SIM_SCENARIOS: SimulationRun[] = [
  { id: 'sim-A1', scenario: 'Fast ransomware (50 files/s)', kind: 'attack', workers: 1, delay: 0.02, limit: 60, mode: 'inplace', status: 'idle', started_at: null, ended_at: null, files_processed: 0, detected: false, latency_sec: null, verdict: null },
  { id: 'sim-A2', scenario: 'Medium speed (2 files/s)', kind: 'attack', workers: 1, delay: 0.5, limit: 60, mode: 'copy', status: 'idle', started_at: null, ended_at: null, files_processed: 0, detected: false, latency_sec: null, verdict: null },
  { id: 'sim-A5', scenario: '4 parallel workers', kind: 'attack', workers: 4, delay: 0.02, limit: 60, mode: 'copy', status: 'idle', started_at: null, ended_at: null, files_processed: 0, detected: false, latency_sec: null, verdict: null },
  { id: 'sim-B1', scenario: 'tar czf (benign compression)', kind: 'benign', workers: 1, delay: 0, limit: 0, mode: 'copy', status: 'idle', started_at: null, ended_at: null, files_processed: 0, detected: false, latency_sec: null, verdict: null },
  { id: 'sim-B3', scenario: 'Python writes 40 text files (benign)', kind: 'benign', workers: 1, delay: 0.01, limit: 40, mode: 'copy', status: 'idle', started_at: null, ended_at: null, files_processed: 0, detected: false, latency_sec: null, verdict: null },
];
