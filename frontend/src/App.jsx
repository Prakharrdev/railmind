import React, { useState } from 'react';
import { SimulationProvider } from './context/SimulationContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CorridorMap from './components/CorridorMap';
import ConflictTimeline from './components/ConflictTimeline';
import ConsoleTabs from './components/ConsoleTabs';
import { useSimulatorState } from './hooks/useSimulatorState';
import { Clock, ShieldAlert, Award, Train, CheckCircle } from 'lucide-react';

function DashboardContent() {
  const { trains = [], conflicts = [], metrics } = useSimulatorState();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Derive top telemetry bar values
  const totalTrains = trains.length;
  const delayedTrains = trains.filter(t => t.delay_minutes >= 0.1).length;
  const onTimeTrains = totalTrains - delayedTrains;
  const activeConflicts = conflicts.length;
  
  const avgDelay = totalTrains > 0 
    ? trains.reduce((sum, t) => sum + t.delay_minutes, 0) / totalTrains 
    : 0;

  const delayReductionPct = metrics?.delay_reduction_pct || 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0e12] overflow-hidden text-slate-200">
      {/* Top Navigation */}
      <Navbar />

      {/* Top Telemetry Metrics Bar */}
      <div className="bg-[#15171e] border-b border-[#222530] px-6 py-2 flex items-center justify-between text-xs font-mono font-bold select-none text-slate-400">
        <div className="flex items-center gap-6 divide-x divide-[#222530]">
          <div className="flex items-center gap-2 pr-6">
            <Train className="h-4 w-4 text-purple-400" />
            <span>Active Fleet:</span>
            <span className="text-slate-100 font-semibold">{totalTrains}</span>
          </div>
          <div className="flex items-center gap-2 pl-6 pr-6">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>On Time:</span>
            <span className="text-emerald-400 font-semibold">{onTimeTrains}</span>
          </div>
          <div className="flex items-center gap-2 pl-6 pr-6">
            <Clock className="h-4 w-4 text-amber-500" />
            <span>Delayed:</span>
            <span className="text-amber-500 font-semibold">{delayedTrains}</span>
          </div>
          <div className="flex items-center gap-2 pl-6 pr-6">
            <ShieldAlert className={`h-4 w-4 ${activeConflicts > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-500'}`} />
            <span>Conflicts:</span>
            <span className={`${activeConflicts > 0 ? 'text-rose-400 font-bold' : 'text-slate-100 font-semibold'}`}>{activeConflicts}</span>
          </div>
          <div className="flex items-center gap-2 pl-6 pr-6">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>Avg Delay:</span>
            <span className="text-slate-100 font-semibold">{avgDelay.toFixed(1)}m</span>
          </div>
        </div>

        {metrics && (
          <div className="flex items-center gap-2 bg-[#7c3aed]/10 border border-[#7c3aed]/25 rounded px-2.5 py-1 text-[11px] font-semibold text-purple-300">
            <Award className="h-4 w-4 text-purple-400" />
            <span>Delay Reduction:</span>
            <span className="text-purple-200 font-bold">+{Math.round(delayReductionPct)}% via Planner</span>
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 h-[calc(100vh-108px)] w-full overflow-hidden">
        {/* Collapsible Active fleet sidebar */}
        {isSidebarOpen && <Sidebar />}

        {/* Sidebar Toggle Tab */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-[#15171e] hover:bg-[#1a1d26] border-r border-y border-[#222530] text-slate-400 hover:text-slate-200 px-1 py-4 flex items-center justify-center cursor-pointer transition-all self-center rounded-r-md z-50 text-[10px]"
          style={{ height: '50px' }}
        >
          {isSidebarOpen ? '◀' : '▶'}
        </button>

        {/* Core Workspace Columns */}
        <main className="flex-1 flex gap-4 p-4 h-full overflow-hidden">
          {/* Left Section (65%): Map + Occupancy Timeline */}
          <div className="flex-[65] flex flex-col gap-4 h-full overflow-hidden">
            {/* Map (55% height) */}
            <div className="flex-[55] flex flex-col overflow-hidden">
              <CorridorMap />
            </div>
            {/* Conflict list / Occupancy Timeline (45% height) */}
            <div className="flex-[45] flex flex-col overflow-hidden">
              <ConflictTimeline />
            </div>
          </div>

          {/* Right Section (35%): Tabbed Console */}
          <div className="flex-[35] flex flex-col h-full overflow-hidden">
            <ConsoleTabs />
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <SimulationProvider>
      <DashboardContent />
    </SimulationProvider>
  );
}

export default App;
