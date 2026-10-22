import React, { useEffect, useState, useRef } from 'react';
import { FlaskConical, Play, CheckCircle, XCircle, Clock, AlertTriangle, Info, Zap } from 'lucide-react';
import { getSimulationScenarios, startSimulation } from '../services/api';
import type { SimulationRun } from '../types';
import { cn, formatDuration } from '../utils/helpers';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function ScenarioCard({ sim, onRun }: { sim: SimulationRun; onRun: (id: string) => void }) {
  const isAttack = sim.kind === 'attack';
  const kindBadge = isAttack ? 'badge-high' : 'badge-clean';
  const isRunning = sim.status === 'running';

  const statusIcon = {
    idle: <Clock className="w-4 h-4 text-slate-500" />,
    running: <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />,
    detected: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    completed: <CheckCircle className="w-4 h-4 text-blue-400" />,
    error: <XCircle className="w-4 h-4 text-rose-400" />,
  }[sim.status];

  return (
    <div className={cn(
      'card p-5 flex flex-col gap-4 transition-all duration-300 hover:border-white/[0.14]',
      isAttack && 'border-l-2 border-l-amber-500/40',
      !isAttack && 'border-l-2 border-l-emerald-500/40',
      isRunning && 'shadow-glow',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${kindBadge}`}>{sim.kind.toUpperCase()}</span>
            <span className="text-xs font-semibold text-slate-200">{sim.scenario}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
            <span>Workers: {sim.workers}</span>
            <span>Delay: {sim.delay}s</span>
            <span>Files: {sim.limit || '∞'}</span>
            <span>Mode: {sim.mode}</span>
          </div>
        </div>
        <div className="shrink-0">{statusIcon}</div>
      </div>

      {/* Progress bar for running */}
      {isRunning && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Simulating…</span>
            <span>{sim.files_processed} files</span>
          </div>
          <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* Result */}
      {sim.verdict && (
        <div className={cn(
          'flex items-center gap-2 p-2 rounded-lg text-xs font-semibold',
          sim.verdict === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
        )}>
          {sim.verdict === 'PASS' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {sim.verdict} · {sim.kind === 'attack' ? (sim.detected ? `Detected in ${sim.latency_sec?.toFixed(3)}s` : 'Not detected') : 'No false positive'}
        </div>
      )}

      <button
        onClick={() => onRun(sim.id)}
        disabled={isRunning}
        className={cn('btn-primary w-full justify-center', isRunning && 'opacity-60 cursor-not-allowed')}
      >
        <Play className="w-3.5 h-3.5" />
        {isRunning ? 'Running…' : 'Run Scenario'}
      </button>
    </div>
  );
}

export default function SimulationLab() {
  const [scenarios, setScenarios] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { addToast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSimulationScenarios().then(d => { setScenarios(d); setLoading(false); });
  }, []);

  const confirmScenario = scenarios.find(s => s.id === confirmId);

  async function handleRun() {
    if (!confirmId) return;
    setConfirmId(null);
    const id = confirmId;

    // Mark as running
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, status: 'running', started_at: Date.now() / 1000, verdict: null } : s));

    try {
      await startSimulation(id);

      // Simulate progress and result (demo)
      const scenario = scenarios.find(s => s.id === id)!;
      const duration = scenario.kind === 'attack' ? 3000 : 2000;

      // After scenario results from results.csv
      const resultMap: Record<string, Partial<SimulationRun>> = {
        'sim-A1': { detected: true, latency_sec: 0.117, files_processed: 60, verdict: 'PASS' },
        'sim-A2': { detected: true, latency_sec: 2.52, files_processed: 60, verdict: 'PASS' },
        'sim-A5': { detected: true, latency_sec: 0.008, files_processed: 60, verdict: 'PASS' },
        'sim-B1': { detected: false, latency_sec: null, files_processed: 1, verdict: 'PASS' },
        'sim-B3': { detected: false, latency_sec: null, files_processed: 40, verdict: 'PASS' },
      };

      timerRef.current = setTimeout(() => {
        const result = resultMap[id] ?? { detected: false, verdict: 'PASS' };
        setScenarios(prev => prev.map(s => s.id === id ? {
          ...s, status: 'completed', ended_at: Date.now() / 1000, ...result
        } : s));
        addToast({
          type: result.verdict === 'PASS' ? 'success' : 'error',
          title: `Simulation Complete: ${result.verdict}`,
          message: scenario.kind === 'attack'
            ? (result.detected ? `Attack detected in ${result.latency_sec?.toFixed(3)}s` : 'Attack NOT detected (false negative)')
            : 'No false positive triggered',
        });
      }, duration);
    } catch (e) {
      setScenarios(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s));
      addToast({ type: 'error', title: 'Simulation Error', message: String(e) });
    }
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Simulation Lab</h2>
          <p className="text-sm text-slate-500 mt-1">Safe test scenarios based on <code className="text-emerald-400 text-xs">fake_ransom.py</code> and <code className="text-emerald-400 text-xs">aes_attacker.py</code></p>
        </div>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-300/80 leading-relaxed">
          <span className="font-semibold text-indigo-400">Demo Mode: </span>
          No subprocess is executed. Results are replayed from
          <code className="mx-1 text-indigo-300">results.csv</code>
          (100% detection rate on attack scenarios, 0% false positives on benign). In production, simulations only run within
          directories containing a <code className="mx-1 text-indigo-300">.rg_sandbox</code> marker file.
        </div>
      </div>

      {/* Results from paper */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Baseline Results (from results.csv)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['ID', 'Scenario', 'Kind', 'Detected', 'Latency', 'Files Damaged', 'Recovered', 'Verdict'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-600 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {[
                { id: 'A1', scenario: 'Fast ransomware (50 files/s)', kind: 'attack', detected: 'yes', latency: '0.117s', damaged: '6', recovered: '60/60', verdict: 'PASS' },
                { id: 'A2', scenario: 'Medium (2 files/s)', kind: 'attack', detected: 'yes', latency: '2.52s', damaged: '6', recovered: '60/60', verdict: 'PASS' },
                { id: 'A3', scenario: 'Slow (1 file/s)', kind: 'attack', detected: 'yes', latency: '7.021s', damaged: '8', recovered: '60/60', verdict: 'PASS' },
                { id: 'A5', scenario: '4 parallel workers', kind: 'attack', detected: 'yes', latency: '0.008s', damaged: '3', recovered: '60/60', verdict: 'PASS' },
                { id: 'A6', scenario: 'Real AES-256 (openssl)', kind: 'attack', detected: 'yes', latency: '0.353s', damaged: '6', recovered: '60/60', verdict: 'PASS' },
                { id: 'B1', scenario: 'tar czf (benign)', kind: 'benign', detected: 'no', latency: '—', damaged: '—', recovered: '—', verdict: 'PASS' },
                { id: 'B3', scenario: 'Python writes 40 text files', kind: 'benign', detected: 'no', latency: '—', damaged: '—', recovered: '—', verdict: 'PASS' },
              ].map(r => (
                <tr key={r.id} className="table-row-hover">
                  <td className="px-3 py-2.5 font-mono text-slate-400">{r.id}</td>
                  <td className="px-3 py-2.5 text-slate-300">{r.scenario}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${r.kind === 'attack' ? 'badge-high' : 'badge-clean'}`}>{r.kind}</span></td>
                  <td className="px-3 py-2.5">
                    <span className={r.detected === 'yes' ? 'text-rose-400' : 'text-emerald-400'}>{r.detected}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-400">{r.latency}</td>
                  <td className="px-3 py-2.5 text-slate-400">{r.damaged}</td>
                  <td className="px-3 py-2.5 text-slate-400">{r.recovered}</td>
                  <td className="px-3 py-2.5">
                    <span className={`badge ${r.verdict === 'PASS' ? 'badge-clean' : 'badge-critical'}`}>{r.verdict}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Scenarios */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Interactive Demo Scenarios</h3>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scenarios.map(s => (
              <ScenarioCard key={s.id} sim={s} onRun={id => setConfirmId(id)} />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmId}
        title="Start Simulation Scenario"
        variant="warning"
        confirmLabel="Run Scenario"
        description={`You are about to run: "${confirmScenario?.scenario}"\n\nDemo Mode: No actual files are encrypted or deleted. Results are replayed from baseline test data. In production, this would execute ${confirmScenario?.kind === 'attack' ? 'fake_ransom.py or aes_attacker.py' : 'a benign workload'} in a .rg_sandbox directory.`}
        onConfirm={handleRun}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

