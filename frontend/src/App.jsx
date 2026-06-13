import React from 'react';
import { SimulationProvider } from './context/SimulationContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import CorridorMap from './components/CorridorMap';
import ConflictTimeline from './components/ConflictTimeline';
import RecommendationPanel from './components/RecommendationPanel';
import DecisionTree from './components/DecisionTree';
import MetricsCard from './components/MetricsCard';
import PlannerConfig from './components/PlannerConfig';

function App() {
  return (
    <SimulationProvider>
      <div className="flex flex-col h-screen w-screen bg-[#0f1015] overflow-hidden text-slate-200">
        {/* Top Navigation */}
        <Navbar />

        {/* Dashboard Panels */}
        <div className="flex flex-1 h-[calc(100vh-68px)] w-full overflow-hidden">
          {/* Active fleet sidebar */}
          <Sidebar />

          {/* Core Columns */}
          <main className="flex-1 flex gap-4 p-4 h-full overflow-hidden">
            {/* Left Column (35%): live network map */}
            <div className="flex-[35] flex flex-col h-full overflow-hidden">
              <CorridorMap />
            </div>

            {/* Center Column (35%): conflict Timeline list */}
            <div className="flex-[35] flex flex-col h-full overflow-hidden">
              <ConflictTimeline />
            </div>

            {/* Right Column (30%): planner advisory & diagnostics stack */}
            <div className="flex-[30] flex flex-col gap-4 overflow-y-auto h-full pr-1 pb-8">
              <RecommendationPanel />
              <DecisionTree />
              <MetricsCard />
              <PlannerConfig />
            </div>
          </main>
        </div>
      </div>
    </SimulationProvider>
  );
}

export default App;
