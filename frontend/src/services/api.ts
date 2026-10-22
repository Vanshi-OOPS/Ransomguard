/**
 * API Service Layer – ready to connect to the Python RansomGuard backend.
 *
 * When VITE_DEMO_MODE=true (or backend is unreachable), all calls return
 * demo data. When backend is available at /api, real data is fetched.
 *
 * Backend integration: add a FastAPI/Flask wrapper around ransomguard.py that
 * exposes the endpoints below.
 */

import type {
  ThreatIncident, ProcessRecord, FileEvent, BackupEntry,
  AuditLogEntry, DetectionConfig, SystemHealth, SimulationRun,
  MetricPoint, DashboardStats
} from '../types';

import {
  DEMO_INCIDENTS, DEMO_PROCESSES, DEMO_FILE_EVENTS, DEMO_BACKUPS,
  DEMO_AUDIT_LOG, DEMO_CONFIG, DEMO_HEALTH, DEMO_SIM_SCENARIOS,
  DEMO_METRIC_HISTORY, DEMO_STATS
} from '../data/demoData';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || true; // always demo until backend ready
const BASE = '/api';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

// Simulated network delay for demo realism
function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise(r => setTimeout(() => r(value), ms));
}

// ─── System Health ────────────────────────────────────────────────────────────
export async function getSystemHealth(): Promise<SystemHealth> {
  if (DEMO_MODE) return delay(DEMO_HEALTH);
  return apiFetch<SystemHealth>('/health');
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  if (DEMO_MODE) return delay(DEMO_STATS);
  return apiFetch<DashboardStats>('/stats');
}

export async function getMetricHistory(): Promise<MetricPoint[]> {
  if (DEMO_MODE) return delay(DEMO_METRIC_HISTORY);
  return apiFetch<MetricPoint[]>('/stats/history');
}

// ─── Threat Incidents ─────────────────────────────────────────────────────────
export async function getIncidents(): Promise<ThreatIncident[]> {
  if (DEMO_MODE) return delay(DEMO_INCIDENTS);
  return apiFetch<ThreatIncident[]>('/incidents');
}

export async function getIncidentById(id: string): Promise<ThreatIncident | null> {
  if (DEMO_MODE) return delay(DEMO_INCIDENTS.find(i => i.id === id) ?? null);
  return apiFetch<ThreatIncident>(`/incidents/${id}`);
}

// ─── Processes ────────────────────────────────────────────────────────────────
export async function getProcesses(): Promise<ProcessRecord[]> {
  if (DEMO_MODE) return delay(DEMO_PROCESSES);
  return apiFetch<ProcessRecord[]>('/processes');
}

// ─── File Events (Live Monitoring) ────────────────────────────────────────────
export async function getFileEvents(): Promise<FileEvent[]> {
  if (DEMO_MODE) return delay(DEMO_FILE_EVENTS);
  return apiFetch<FileEvent[]>('/events');
}

// ─── Backups / Snapshots ──────────────────────────────────────────────────────
export async function getBackups(): Promise<BackupEntry[]> {
  if (DEMO_MODE) return delay(DEMO_BACKUPS);
  return apiFetch<BackupEntry[]>('/backups');
}

/**
 * Restore a single file from snapshot.
 * SAFETY: In real mode, the Python engine validates that the destination is
 * within a watched directory and that the snapshot hash matches.
 * In demo mode, no actual file operation is performed.
 */
export async function restoreFile(backupId: string): Promise<{ success: boolean; message: string }> {
  if (DEMO_MODE) {
    return delay({ success: true, message: `[DEMO] File restoration simulated. No actual file was modified.` }, 800);
  }
  return apiFetch<{ success: boolean; message: string }>(`/backups/${backupId}/restore`, { method: 'POST' });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export async function getAuditLog(): Promise<AuditLogEntry[]> {
  if (DEMO_MODE) return delay(DEMO_AUDIT_LOG);
  return apiFetch<AuditLogEntry[]>('/audit');
}

// ─── Configuration ────────────────────────────────────────────────────────────
export async function getConfig(): Promise<DetectionConfig> {
  if (DEMO_MODE) return delay(DEMO_CONFIG);
  return apiFetch<DetectionConfig>('/config');
}

export async function updateConfig(cfg: DetectionConfig): Promise<{ success: boolean }> {
  if (DEMO_MODE) {
    return delay({ success: true }, 500);
  }
  return apiFetch<{ success: boolean }>('/config', { method: 'PUT', body: JSON.stringify(cfg) });
}

// ─── Simulation ───────────────────────────────────────────────────────────────
export async function getSimulationScenarios(): Promise<SimulationRun[]> {
  if (DEMO_MODE) return delay(DEMO_SIM_SCENARIOS);
  return apiFetch<SimulationRun[]>('/simulation/scenarios');
}

/**
 * Start a simulation run.
 * SAFETY: Real mode only runs within a directory containing a .rg_sandbox marker,
 * as enforced by fake_ransom.py and aes_attacker.py.
 * Demo mode: no subprocess is spawned; UI simulates progress with timers.
 */
export async function startSimulation(scenarioId: string): Promise<{ run_id: string }> {
  if (DEMO_MODE) {
    return delay({ run_id: `demo-${scenarioId}-${Date.now()}` }, 400);
  }
  return apiFetch<{ run_id: string }>(`/simulation/run`, { method: 'POST', body: JSON.stringify({ scenario_id: scenarioId }) });
}

export async function getSimulationStatus(runId: string): Promise<SimulationRun> {
  if (DEMO_MODE) return delay(DEMO_SIM_SCENARIOS[0]);
  return apiFetch<SimulationRun>(`/simulation/status/${runId}`);
}
