import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Overview from './pages/Overview';
import LiveMonitoring from './pages/LiveMonitoring';
import ThreatIncidents from './pages/ThreatIncidents';
import ProcessAnalysis from './pages/ProcessAnalysis';
import FileRecovery from './pages/FileRecovery';
import SimulationLab from './pages/SimulationLab';
import AuditLog from './pages/AuditLog';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="monitoring" element={<LiveMonitoring />} />
            <Route path="incidents" element={<ThreatIncidents />} />
            <Route path="processes" element={<ProcessAnalysis />} />
            <Route path="recovery" element={<FileRecovery />} />
            <Route path="simulation" element={<SimulationLab />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
