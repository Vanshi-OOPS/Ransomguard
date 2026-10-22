import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { MobileNav } from './Sidebar';
import { Bell, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/monitoring': 'Live Monitoring',
  '/incidents': 'Threat Incidents',
  '/processes': 'Process Analysis',
  '/recovery': 'File Recovery',
  '/simulation': 'Simulation Lab',
  '/audit': 'Audit Log',
  '/settings': 'Settings',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? 'RansomGuard';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="shrink-0 h-14 flex items-center justify-between px-5 border-b border-white/[0.06] bg-navy-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <MobileNav />
            </div>
            <h1 className="text-sm font-semibold text-slate-100">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs font-semibold text-indigo-400">Demo Mode Active</span>
            </div>
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
