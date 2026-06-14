import React, { useState } from 'react';
import RecommendationPanel from './RecommendationPanel';
import DecisionTree from './DecisionTree';
import MetricsCard from './MetricsCard';
import PlannerConfig from './PlannerConfig';
import { Zap, Eye, BarChart3, RotateCcw, AlertTriangle } from 'lucide-react';
import { useSimulatorState } from '../hooks/useSimulatorState';

export default function ConsoleTabs() {
  const [activeTab, setActiveTab] = useState('advisories'); // 'advisories', 'reasoning', 'analytics'
  const { activeRecommendation, selectedRecommendationId, replayHistory = [], activeReplay, setActiveReplay } = useSimulatorState();

  const tabs = [
    {
      id: 'advisories',
      name: 'Advisories',
      icon: Zap,
      badge: activeRecommendation ? 'New' : null,
    },
    {
      id: 'reasoning',
      name: 'Reasoning Tree',
      icon: Eye,
      badge: selectedRecommendationId ? 'Active' : null,
    },
    {
      id: 'analytics',
      name: 'Analytics & Config',
      icon: BarChart3,
      badge: activeReplay ? 'Replay' : null,
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#15171e] border border-[#222530] rounded-lg overflow-hidden select-none">
      {/* Historical Replay Mode Alert Banner */}
      {activeReplay && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-[10px] font-mono text-amber-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Replay Snapshot: {activeReplay.id} ({activeReplay.type})</span>
          </div>
          <button 
            onClick={() => setActiveReplay(null)}
            className="bg-amber-500 hover:bg-amber-400 text-[#0d0e12] font-bold px-2 py-0.5 rounded text-[9px] cursor-pointer flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Resume Live</span>
          </button>
        </div>
      )}

      {/* Tabs Selector Header */}
      <div className="flex border-b border-[#222530] bg-[#0d0e12]/30 text-xs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 font-bold transition-all relative outline-none cursor-pointer ${
                isActive 
                  ? 'text-purple-400 bg-[#15171e]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#15171e]/50'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-purple-400' : 'text-slate-500'}`} />
              <span>{tab.name}</span>
              {tab.badge && (
                <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold uppercase animate-pulse ${
                  tab.id === 'analytics' ? 'bg-amber-500 text-slate-950' : 'bg-purple-500 text-white'
                }`}>
                  {tab.badge}
                </span>
              )}
              {isActive && <div className="active-tab-indicator" />}
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
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Live & Benchmark Analytics</div>
              <MetricsCard />
            </div>

            {/* 2. Scenario / Incident Replay History */}
            <div className="border-t border-[#222530] pt-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Scenario Replay Index</div>
              <p className="text-[10px] text-slate-400 mb-3 leading-relaxed font-mono">
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
                        // Redirect to advisories tab to inspect loaded recommendation immediately
                        if (!isSelected) {
                          setActiveTab('advisories');
                        }
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all duration-150 relative ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-500/5 shadow-md' 
                          : 'border-[#222530] bg-[#0d0e12]/40 hover:bg-[#1a1d26]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between font-mono text-[11px] mb-1">
                        <span className="font-bold text-slate-200">{scenario.id} ({scenario.type})</span>
                        <span className="text-emerald-400 font-bold">+{scenario.improvement_pct.toFixed(1)}% Gain</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between">
                        <span>{isSelected ? 'Click to Exit Replay' : 'Load Simulation Snapshots'}</span>
                        {isSelected && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-1.5 py-0.2 rounded font-bold animate-pulse text-[8px]">
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
            <div className="border-t border-[#222530] pt-4 pb-6">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">Planner Parameter Controls</div>
              <PlannerConfig />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
