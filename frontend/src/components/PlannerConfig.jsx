import React, { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Settings, RefreshCw, Sliders, Info } from 'lucide-react';

export default function PlannerConfig() {
  const { plannerConfig, updatePlannerConfig } = useSimulatorState();
  const [config, setConfig] = useState({
    depth: plannerConfig.depth || 4,
    beam_width: plannerConfig.beam_width || 8,
    step_minutes: plannerConfig.step_minutes || 5
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleApply = async () => {
    setIsUpdating(true);
    try {
      await updatePlannerConfig({
        depth: parseInt(config.depth),
        beam_width: parseInt(config.beam_width),
        step_minutes: parseInt(config.step_minutes)
      });
      alert('Planner configuration successfully adjusted.');
    } catch (err) {
      alert('Failed to update config: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-[#12131a] border border-[#2e303a] rounded-lg overflow-hidden flex flex-col h-[320px] select-none text-slate-200">
      {/* Header */}
      <div className="bg-[#161720] px-4 py-3 border-b border-[#2e303a] flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sliders className="h-4 w-4 text-purple-400" />
          <span>Planner Configuration Controls</span>
        </h2>
      </div>

      {/* Configuration sliders/inputs */}
      <div className="flex-1 p-4 space-y-4 flex flex-col justify-between">
        <div className="space-y-3.5 text-xs">
          {/* Depth selection */}
          <div>
            <div className="flex justify-between items-center mb-1 font-mono text-[10px] text-slate-500 font-bold uppercase">
              <span>Search Lookahead Depth</span>
              <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/25">
                {config.depth} steps
              </span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 4].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, depth: val }))}
                  className={`flex-1 py-1.5 border rounded font-mono font-semibold transition-all duration-150 ${
                    config.depth === val
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : 'bg-[#1a1c23] border-[#2e303a] text-slate-400 hover:border-slate-600'
                  }`}
                >
                  Depth {val}
                </button>
              ))}
            </div>
          </div>

          {/* Beam Width selection */}
          <div>
            <div className="flex justify-between items-center mb-1 font-mono text-[10px] text-slate-500 font-bold uppercase">
              <span>Beam Search Width</span>
              <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/25">
                W = {config.beam_width} nodes
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 4, 8, 16].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, beam_width: val }))}
                  className={`py-1.5 border rounded font-mono font-semibold transition-all duration-150 ${
                    config.beam_width === val
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : 'bg-[#1a1c23] border-[#2e303a] text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Projection Step interval */}
          <div>
            <label className="block mb-1 font-mono text-[10px] text-slate-500 font-bold uppercase">
              Projection Interval (Step Minutes)
            </label>
            <select
              value={config.step_minutes}
              onChange={e => setConfig(prev => ({ ...prev, step_minutes: parseInt(e.target.value) }))}
              className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-300 font-mono focus:outline-none"
            >
              <option value="2">2 Minutes</option>
              <option value="5">5 Minutes</option>
              <option value="10">10 Minutes</option>
            </select>
          </div>
        </div>

        {/* Info & Apply */}
        <div className="space-y-3">
          <div className="bg-[#1a1c23]/50 border border-[#2e303a]/50 rounded p-2 text-[10px] text-slate-500 flex items-start gap-1.5 leading-normal">
            <Info className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
            <span>Changing parameters resets the active beam state search. Recommended setup: Depth 4, Width 8.</span>
          </div>

          <button
            onClick={handleApply}
            disabled={isUpdating}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded text-xs flex items-center justify-center gap-1.5 transition-all duration-150 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>Apply Planner Parameters</span>
          </button>
        </div>
      </div>
    </div>
  );
}
