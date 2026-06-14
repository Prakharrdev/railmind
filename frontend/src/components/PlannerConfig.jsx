import { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { RefreshCw, Info } from 'lucide-react';

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
      alert('Planner parameters successfully re-configured.');
    } catch (err) {
      alert('Failed to update config: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Parameters */}
      <div className="space-y-4 bg-[#0d0e12]/20 border border-[#222530] rounded p-3">
        {/* Depth selection */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-[9px] text-slate-500 font-bold uppercase">
            <span>Lookahead Search Depth</span>
            <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/25">
              {config.depth} steps ({config.depth * config.step_minutes}m lookahead)
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            Determines how far into the future the planner projects simulation steps to detect future conflicts.
          </p>
          <div className="flex gap-2">
            {[1, 2, 4].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, depth: val }))}
                className={`flex-1 py-1.5 border rounded font-mono font-bold transition-all cursor-pointer ${
                  config.depth === val
                    ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                    : 'bg-[#0d0e12] border-[#222530] text-slate-400 hover:border-slate-500'
                }`}
              >
                Depth {val}
              </button>
            ))}
          </div>
        </div>

        {/* Beam Width selection */}
        <div>
          <div className="flex justify-between items-center mb-1 font-mono text-[9px] text-slate-500 font-bold uppercase">
            <span>Beam Search Width</span>
            <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/25">
              W = {config.beam_width} nodes
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            Specifies how many parallel alternative dispatch scenarios are kept in memory at each search step.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 4, 8, 16].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, beam_width: val }))}
                className={`py-1.5 border rounded font-mono font-bold transition-all cursor-pointer ${
                  config.beam_width === val
                    ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                    : 'bg-[#0d0e12] border-[#222530] text-slate-400 hover:border-slate-500'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Projection Step interval */}
        <div>
          <label className="block mb-1 font-mono text-[9px] text-slate-500 font-bold uppercase">
            Step Interval (Minutes)
          </label>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            The simulated time advance represented by each step in the search tree.
          </p>
          <select
            value={config.step_minutes}
            onChange={e => setConfig(prev => ({ ...prev, step_minutes: parseInt(e.target.value) }))}
            className="w-full bg-[#0d0e12] border border-[#222530] rounded p-2 text-slate-300 font-mono focus:outline-none"
          >
            <option value="2">2 Minutes per step</option>
            <option value="5">5 Minutes per step</option>
            <option value="10">10 Minutes per step</option>
          </select>
        </div>
      </div>

      {/* Info & Apply */}
      <div className="space-y-3">
        <div className="bg-[#7c3aed]/5 border border-[#7c3aed]/15 rounded p-2.5 text-[9px] text-slate-400 flex items-start gap-1.5 leading-normal font-mono">
          <Info className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
          <span>Adjusting parameters will clear the live beam search caches and reset the planner search state.</span>
        </div>

        <button
          onClick={handleApply}
          disabled={isUpdating}
          className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>Apply Configuration</span>
        </button>
      </div>
    </div>
  );
}
