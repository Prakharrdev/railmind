import { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { CircleDot, Radio, Cpu, Settings, X } from 'lucide-react';
import PlannerConfig from './PlannerConfig';

export default function FooterBar() {
  const { wsStatus, activeRecommendation, recommendations, simTime = 840 } = useSimulatorState();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isLive = wsStatus === 'Connected';
  const hasRecommendations = activeRecommendation || Object.keys(recommendations).length > 0;

  // Format simTime (in minutes) to HH:MM:SS
  const formatTime = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <footer className="h-10 bg-surface-1 border-t border-border px-4 flex items-center justify-between select-none shrink-0 text-text-secondary style-label z-40">
      {/* Left items */}
      <div className="flex items-center gap-5">
        {/* System Operational */}
        <div className="flex items-center gap-1.5">
          <CircleDot className={`h-3.5 w-3.5 ${isLive ? 'text-signal-green pulse-indicator' : 'text-signal-red'}`} />
          <span>System {isLive ? 'Operational' : 'Offline'}</span>
        </div>

        {/* Data Sync */}
        <div className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          <span>Data Sync: <span className={isLive ? 'text-signal-green font-bold' : 'text-signal-red font-bold'}>{isLive ? 'Live' : 'Reconnecting…'}</span></span>
        </div>

        {/* Planner Engine */}
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          <span>Planner Engine: <span className={hasRecommendations ? 'text-signal-green font-bold' : 'text-text-tertiary font-bold'}>{hasRecommendations ? 'Active' : 'Standby'}</span></span>
        </div>
      </div>

      {/* Build Info */}
      <div className="hidden md:block text-text-tertiary">
        RailMind v1.0.0 · Search-Based Planning Engine · Delhi–Kanpur Corridor
      </div>

      {/* Right items: Last Updated + Auto Refresh + Settings */}
      <div className="flex items-center gap-4">
        {/* Last Updated */}
        <span className="text-text-tertiary font-mono text-[10px]">Last Updated: {formatTime(simTime)}</span>

        {/* Auto Refresh Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-secondary">Auto Refresh</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`w-8 h-[18px] flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 ${
              autoRefresh ? 'bg-signal-green' : 'bg-surface-3'
            }`}
          >
            <div
              className={`bg-canvas w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 ${
                autoRefresh ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Settings */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-1 hover:bg-surface-3 hover:text-text-primary rounded transition-colors cursor-pointer flex items-center gap-1"
          title="Planner Settings"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Settings</span>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-sm">
          <div className="bg-surface-1 border border-border rounded w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowSettingsModal(false)}
              className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="style-card-title text-text-primary mb-4 flex items-center gap-2 font-mono border-b border-border pb-2">
              <Settings className="h-4.5 w-4.5 text-action-blue" />
              <span>Planner Engine Configuration</span>
            </h3>

            <div className="mt-2 text-text-primary">
              <PlannerConfig />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="bg-canvas hover:bg-surface-3 border border-border text-text-secondary hover:text-text-primary px-4 py-1.5 rounded transition-colors cursor-pointer text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
