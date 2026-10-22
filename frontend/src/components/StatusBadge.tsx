import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '../utils/helpers';

type Status = 'healthy' | 'warning' | 'critical' | 'offline' | 'loading';

interface Props {
  status: Status;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, label, size = 'md' }: Props) {
  const config = {
    healthy: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
    warning: { icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
    critical: { icon: ShieldX, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-400' },
    offline: { icon: WifiOff, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400' },
    loading: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400' },
  }[status];

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-semibold', config.bg, textSize)}>
      <div className={cn('rounded-full animate-pulse-slow', config.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      <Icon className={cn(iconSize, config.color, status === 'loading' && 'animate-spin')} />
      <span className={config.color}>{label ?? status.toUpperCase()}</span>
    </div>
  );
}
