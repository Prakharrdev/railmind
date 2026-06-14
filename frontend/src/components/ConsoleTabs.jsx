import { useState } from 'react';
import RecommendationPanel from './RecommendationPanel';
import DecisionTree from './DecisionTree';
import MetricsCard from './MetricsCard';
import PlannerConfig from './PlannerConfig';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { useSimulatorState } from '../hooks/useSimulatorState';

export default function ConsoleTabs() {
  const [activeTab, setActiveTab] = useState('advisories');
  const { activeRecommendation, selectedRecommendationId, replayHistory = [], activeReplay, setActiveReplay } = useSimulatorState();

  const tabs = [
    {
      id: 'advisories',
      name: 'Advisories',
    },
    {
      id: 'reasoning',
      name: 'Planner Reasoning',
    },
    {
      id: 'analytics',
      name: 'Analytics & Controls',
    }
  ];

  return (
    <div className="flex flex-col h-full bg-surface-1 select-none">
      {/* Historical Replay Mode Alert Banner */}
      {activeReplay && (
        <div className="bg-signal-yellow/10 border-b border-signal-yellow/20 px-4 py-2 text-[10px] font-mono text-signal-yellow flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Replay Snapshot: {activeReplay.id} ({activeReplay.type})</span>
          </div>
          <button 
            onClick={() => setActiveReplay(null)}
            className="bg-signal-yellow hover:opacity-90 text-canvas font-bold px-2 py-0.5 rounded-sm text-[9px] cursor-pointer flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Resume Live</span>
          </button>
        </div>
      )}

      {/* Tabs Selector Header — matching reference: uppercase, active indicator bar */}
      <div className="flex border-b border-border bg-surface-1">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 font-bold transition-all relative outline-none cursor-pointer text-[11px] uppercase tracking-wider ${
                isActive 
                  ? 'text-action-blue' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/50'
              }`}
            >
              <span>{tab.name}</span>
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-action-blue" />}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'advisories' && (
          <div className="flex-1 h-full flex flex-col overflow-y-auto">
            <RecommendationPanel />
          </div>
        )}
        
        {activeTab === 'reasoning' && (
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            <DecisionTree />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex-1 h-full flex flex-col overflow-y-auto p-4 space-y-6">
            {/* 1. Live & Benchmark Metrics */}
            <div>
              <div className="style-label text-text-tertiary mb-2">Live & Benchmark Analytics</div>
              <MetricsCard />
            </div>

            {/* 2. Scenario / Incident Replay History */}
            <div className="border-t border-border pt-4">
              <div className="style-label text-text-tertiary mb-2">Scenario Replay Index</div>
              <p className="text-[10px] text-text-secondary mb-3 leading-relaxed font-mono">
                Click a scenario run below to load and inspect its recorded advisory decisions, search reasoning tree, and comparative metrics snapshots.
              </p>
              <div className="space-y-2">
                {replayHistory.map((scenario) => {
                  const isSelected = activeReplay && activeReplay.id === scenario.id;
                  return (
                    <div
                      key={scenario.id}
                      onClick={() => {
                        setActiveReplay(isSelected ? null : scenario);
                        if (!isSelected) {
                          setActiveTab('advisories');
                        }
                      }}
                      className={`p-3 border rounded-sm cursor-pointer transition-all duration-150 relative ${
                        isSelected 
                          ? 'border-signal-yellow bg-signal-yellow/5 shadow-md' 
                          : 'border-border bg-canvas/40 hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex items-start justify-between font-mono text-[11px] mb-1">
                        <span className="font-bold text-text-primary">{scenario.id} ({scenario.type})</span>
                        <span className="text-signal-green font-bold">+{scenario.improvement_pct.toFixed(1)}% Gain</span>
                      </div>
                      <div className="text-[9px] text-text-tertiary font-mono flex items-center justify-between">
                        <span>{isSelected ? 'Click to Exit Replay' : 'Load Simulation Snapshots'}</span>
                        {isSelected && (
                          <span className="bg-signal-yellow/10 text-signal-yellow border border-signal-yellow/25 px-1.5 py-0.2 rounded-sm font-bold animate-pulse text-[8px]">
                            REPLAY MOUNTED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Planner Controls */}
            <div className="border-t border-border pt-4 pb-6">
              <div className="style-label text-text-tertiary mb-2">Planner Parameter Controls</div>
              <PlannerConfig />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
