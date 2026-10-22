import React from 'react';
import type { Severity } from '../types';
import { cn, severityColor } from '../utils/helpers';

interface Props {
  score: number;
  max?: number;
  severity?: Severity;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ThreatScoreBar({ score, max = 160, severity, showLabel = true, size = 'md' }: Props) {
  const pct = Math.min(100, (score / max) * 100);
  const s = severity ?? (score >= 120 ? 'critical' : score >= 80 ? 'high' : score >= 60 ? 'medium' : score >= 30 ? 'low' : 'clean');

  const barColor = {
    critical: 'bg-gradient-to-r from-rose-600 to-rose-400',
    high: 'bg-gradient-to-r from-amber-600 to-amber-400',
    medium: 'bg-gradient-to-r from-yellow-600 to-yellow-400',
    low: 'bg-gradient-to-r from-blue-600 to-blue-400',
    clean: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
  }[s];

  const h = size === 'sm' ? 'h-1' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className="flex items-center gap-3 w-full">
      <div className={cn('flex-1 rounded-full bg-navy-700 overflow-hidden', h)}>
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-xs font-mono font-semibold w-7 text-right shrink-0', severityColor(s))}>
          {score}
        </span>
      )}
    </div>
  );
}
