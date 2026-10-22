import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Activity, AlertTriangle,
  Cpu, FolderOpen, FlaskConical, ScrollText, Settings,
  ChevronLeft, ChevronRight, Beaker, Zap, Menu, X
} from 'lucide-react';
import { cn } from '../utils/helpers';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/monitoring', icon: Activity, label: 'Live Monitoring' },
  { to: '/incidents', icon: AlertTriangle, label: 'Threat Incidents' },
  { to: '/processes', icon: Cpu, label: 'Process Analysis' },
  { to: '/recovery', icon: FolderOpen, label: 'File Recovery' },
  { to: '/simulation', icon: FlaskConical, label: 'Simulation Lab' },
  { to: '/audit', icon: ScrollText, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobile = false, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-navy-900 border-r border-white/[0.06] transition-all duration-300',
        collapsed && !mobile ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]', collapsed && !mobile && 'justify-center px-2')}>
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-glow">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-navy-900 animate-pulse-slow" />
        </div>
        {(!collapsed || mobile) && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-100 leading-tight">RansomGuard</div>
            <div className="text-[10px] text-emerald-400 font-semibold tracking-wide">SECURITY SOC</div>
          </div>
        )}
        {!mobile && (
          <button
            onClick={onToggle}
            className="ml-auto p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
        {mobile && onClose && (
          <button onClick={onClose} className="ml-auto p-1 text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Demo badge */}
      {(!collapsed || mobile) && (
        <div className="px-4 pt-4">
          <div className="demo-banner w-full justify-center">
            <Beaker className="w-3 h-3" />
            DEMO MODE
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {(!collapsed || mobile) && (
          <p className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Navigation</p>
        )}
        {navItems.map(({ to, icon: Icon, label, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={mobile ? onClose : undefined}
              className={cn(
                isActive ? 'nav-item-active' : 'nav-item',
                collapsed && !mobile && 'justify-center px-2',
              )}
              title={collapsed && !mobile ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(!collapsed || mobile) && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      {(!collapsed || mobile) && (
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Zap className="w-3 h-3 text-emerald-700" />
            <span>v1.0.0-prototype</span>
          </div>
          <div className="text-[10px] text-slate-700 mt-1">Linux fanotify + inotify engine</div>
        </div>
      )}
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg bg-navy-800 border border-white/[0.06] text-slate-400 hover:text-slate-200"
      >
        <Menu className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full">
            <Sidebar collapsed={false} onToggle={() => {}} mobile onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
