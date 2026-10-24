import { useState } from 'react';
import { DayAheadDesk } from './components/DayAheadDesk';
import { AccuracyLab } from './components/AccuracyLab';
import { Wind, Sun, Droplets, Activity, BarChart3 } from 'lucide-react';

export function App() {
  const [activeView, setActiveView] = useState<'desk' | 'accuracy'>('desk');

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  GridPulse UK
                </h1>
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                  Elexon BMRS Day-Ahead Desk
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Wholesale Day-Ahead Renewable Generation Forecasting & Thermal Procurement Risk Engine
              </p>
            </div>
          </div>

          {/* Renewable Generation Source Tabs (Product Roadmap Scoped) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
            <button className="flex items-center gap-1.5 rounded-md bg-sky-500/20 border border-sky-500/40 px-3 py-1.5 font-semibold text-sky-300">
              <Wind className="h-3.5 w-3.5" />
              UK National Wind (Elexon)
            </button>
            <button
              disabled
              title="Scoped out for v1 challenge (Sheffield Solar PV_Live integration planned for v2)"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-500"
            >
              <Sun className="h-3.5 w-3.5" />
              Solar PV (Phase 2)
            </button>
            <button
              disabled
              title="Scoped out for v1 challenge"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-500"
            >
              <Droplets className="h-3.5 w-3.5" />
              Hydro (Phase 2)
            </button>
          </div>
        </div>

        {/* Workspace Sub-Navigation */}
        <div className="mx-auto flex max-w-7xl gap-6 px-6">
          <button
            onClick={() => setActiveView('desk')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition ${
              activeView === 'desk'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-4 w-4" />
            1. Day-Ahead Procurement Desk (Trader View)
          </button>
          <button
            onClick={() => setActiveView('accuracy')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition ${
              activeView === 'accuracy'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            2. Quantitative Forecast Accuracy Lab (Jan 2026 Audit)
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {activeView === 'desk' ? <DayAheadDesk /> : <AccuracyLab />}
      </main>
    </div>
  );
}

export default App;