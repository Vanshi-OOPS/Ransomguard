# RansomGuard – Frontend

A premium **Security Operations Center (SOC) dashboard** for the RansomGuard ransomware detection engine.  
Built with React + TypeScript + Vite + Tailwind CSS.

---

## Quick Start (Windows PowerShell)

```powershell
# 1 – Enter the frontend directory
cd C:\Users\HP\OneDrive\Desktop\RansomGuard\Ransomguard-main\frontend

# 2 – Install dependencies (only needed once)
npm install

# 3 – Start the development server
npm run dev
# → Open http://localhost:5173 in your browser

# 4 – (Optional) Production build
npm run build
# → Output in frontend/dist/
```

---

## Pages & Features

| Page | Route | Status |
|------|-------|--------|
| Overview Dashboard | `/` | ✅ Functional (Demo) |
| Live Monitoring | `/monitoring` | ✅ Functional (Demo) |
| Threat Incidents | `/incidents` | ✅ Functional (Demo) |
| Process Analysis | `/processes` | ✅ Functional (Demo) |
| File Recovery | `/recovery` | ✅ Functional (Demo) |
| Simulation Lab | `/simulation` | ✅ Functional (Demo) |
| Activity / Audit Log | `/audit` | ✅ Functional (Demo) |
| Settings | `/settings` | ✅ Functional (Demo) |

---

## Feature Status

### ✅ Fully Functional in Demo Mode
- **Sidebar navigation** – collapsible desktop + mobile drawer
- **Overview dashboard** – stat cards, area chart, bar chart, pie chart, recent incidents
- **Live Monitoring** – tabbed file events table and process table with auto-refresh
- **Threat Incidents** – expandable rows with evidence display, severity/search filtering
- **Process Analysis** – sortable, filterable process table with threat score bars
- **File Recovery** – backup card listing with restore confirmation modal and safety warnings
- **Simulation Lab** – baseline `results.csv` table + interactive demo scenarios with progress simulation
- **Audit Log** – filterable log with CSV export
- **Settings** – all `config.json` parameters with tag-list editors, number fields, dirty-state tracking
- **Toast notifications** – success/error/warning/info
- **Confirmation modals** – for sensitive operations (restore, simulation)
- **Responsive layout** – desktop sidebar + mobile drawer

### 🔶 Simulated (Demo Data Only)
All data is replayed from `demoData.ts` and `results.csv`. No actual Python engine calls are made.
- File event stream
- Process records
- Threat detections & containment
- Snapshot backup listings
- Simulation scenario outcomes

### ⏳ Awaiting Backend Integration
The typed API service layer (`src/services/api.ts`) is **ready to connect** to the Python engine.  
To activate real data, you need to:

1. Wrap `ransomguard.py` in a FastAPI or Flask server exposing the REST endpoints in `api.ts`.
2. Set `VITE_DEMO_MODE=false` in `.env.local`.
3. The proxy in `vite.config.ts` routes `/api/*` → `http://localhost:8000` (or change target).

**Endpoints expected** (see `src/services/api.ts` for full signatures):
```
GET  /health                      → SystemHealth
GET  /stats                       → DashboardStats
GET  /stats/history               → MetricPoint[]
GET  /incidents                   → ThreatIncident[]
GET  /incidents/:id               → ThreatIncident
GET  /processes                   → ProcessRecord[]
GET  /events                      → FileEvent[]
GET  /backups                     → BackupEntry[]
POST /backups/:id/restore         → { success, message }
GET  /audit                       → AuditLogEntry[]
GET  /config                      → DetectionConfig
PUT  /config                      → { success }
GET  /simulation/scenarios        → SimulationRun[]
POST /simulation/run              → { run_id }
GET  /simulation/status/:run_id   → SimulationRun
```

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 8 | Build tool |
| Tailwind CSS | 3 | Styling |
| Recharts | latest | Charts |
| Lucide React | latest | Icons |
| React Router | v6 | Navigation |
| date-fns | latest | Date formatting |
| clsx | latest | Class utilities |

---

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx          # Root layout + header
│   │   ├── Sidebar.tsx         # Collapsible nav + mobile drawer
│   │   ├── ConfirmModal.tsx    # Reusable confirmation dialog
│   │   ├── ThreatScoreBar.tsx  # Animated threat score bar
│   │   ├── SearchInput.tsx     # Search input with clear button
│   │   ├── StatusBadge.tsx     # System health status badge
│   │   └── Toast.tsx           # Toast notification system
│   ├── data/
│   │   └── demoData.ts         # All demo data (mapped from results.csv + ransomguard.py)
│   ├── pages/
│   │   ├── Overview.tsx        # Dashboard with charts
│   │   ├── LiveMonitoring.tsx  # File events + process tables
│   │   ├── ThreatIncidents.tsx # Expandable incident table
│   │   ├── ProcessAnalysis.tsx # Sortable process table
│   │   ├── FileRecovery.tsx    # Backup listing + restore
│   │   ├── SimulationLab.tsx   # Scenario runner + results table
│   │   ├── AuditLog.tsx        # Audit log + CSV export
│   │   └── Settings.tsx        # Config editor
│   ├── services/
│   │   └── api.ts              # Typed API layer (demo or real)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces mirroring ransomguard.py
│   └── utils/
│       └── helpers.ts          # Formatters, color helpers, CSV export
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## Safety Notes

- **No Python files were modified.** The frontend is in its own `frontend/` directory.
- **No destructive operations are simulated.** File restoration and simulation runs show confirmation dialogs with explicit warnings.
- **Simulation sandbox**: In production mode, `fake_ransom.py` and `aes_attacker.py` refuse to run without a `.rg_sandbox` marker file.
- **Demo mode**: Clearly labelled throughout the UI with an "DEMO MODE" badge and indigo banners.

---

## Backend Integration Checklist

- [ ] Write a FastAPI/Flask REST wrapper for `ransomguard.py`
- [ ] Expose the 14 API endpoints listed above
- [ ] Set `VITE_DEMO_MODE=false` in `.env.local`
- [ ] Change the proxy target in `vite.config.ts` if your backend runs on a different port
- [ ] The `--snapshot` flag enables backup creation (requires root on Linux)
- [ ] The `--restore` flag restores all snapshotted files

---

*RansomGuard prototype – Linux fanotify + inotify based ransomware detection engine.*  
*Frontend: React 19 · TypeScript 5 · Vite 8 · Tailwind CSS 3 · Recharts*
