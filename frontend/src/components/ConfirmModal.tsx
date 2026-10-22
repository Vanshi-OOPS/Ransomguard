import React from 'react';
import { X, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '../utils/helpers';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', onConfirm, onCancel, loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  const btnClass = {
    danger: 'btn-danger',
    warning: 'btn-amber',
    primary: 'btn-primary',
  }[variant];

  const iconEl = variant === 'danger'
    ? <AlertTriangle className="w-6 h-6 text-rose-400" />
    : <Shield className="w-6 h-6 text-emerald-400" />;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            {iconEl}
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
        <div className="px-5 pb-5 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading} className={cn(btnClass, loading && 'opacity-60 cursor-not-allowed')}>
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
