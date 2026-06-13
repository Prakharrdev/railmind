import React, { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Check, ShieldAlert, X, Eye, Zap, Settings, Activity } from 'lucide-react';

export default function RecommendationPanel() {
  const { 
    selectedRecommendationDetails,
    activeRecommendation, 
    recommendations, 
    selectedRecommendationId, 
    setSelectedRecommendationId,
    applyAction 
  } = useSimulatorState();

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    train_id: '',
    action_type: 'hold',
    hold_minutes: 5
  });

  const activeRec = selectedRecommendationDetails || activeRecommendation;

  const handleAccept = async (actions) => {
    if (!actions || actions.length === 0) return;
    try {
      for (const action of actions) {
        await applyAction(action);
      }
      alert('Recommendation actions applied successfully.');
    } catch (err) {
      alert('Error applying action: ' + err.message);
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    try {
      await applyAction({
        train_id: overrideForm.train_id,
        action_type: overrideForm.action_type,
        hold_minutes: parseFloat(overrideForm.hold_minutes)
      });
      setShowOverrideModal(false);
      alert('Override action successfully executed.');
    } catch (err) {
      alert('Failed to apply override action: ' + err.message);
    }
  };

  const formatCost = (cost) => {
    if (cost === undefined || cost === null) return 'N/A';
    return cost.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  return (
    <div className="bg-[#12131a] border border-[#2e303a] rounded-lg overflow-hidden flex flex-col h-[320px] select-none text-slate-200">
      {/* Header */}
      <div className="bg-[#161720] px-4 py-3 border-b border-[#2e303a] flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-purple-400 animate-pulse" />
          <span>Dispatch Advisory Panel</span>
        </h2>

        {/* History dropdown */}
        <select
          value={selectedRecommendationId || ''}
          onChange={(e) => setSelectedRecommendationId(e.target.value || null)}
          className="bg-[#1a1c23] border border-[#2e303a] rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none"
        >
          <option value="">-- Active Advisory --</option>
          {Object.keys(recommendations).map((id) => (
            <option key={id} value={id}>
              {id} (sim min: {Math.round(recommendations[id].sim_time)})
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
        {activeRec ? (
          <div>
            {/* Title & Actions */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Advisory {activeRec.recommendation_id}</h3>
                <span className="text-[10px] text-purple-400 font-mono">RESOLVING CONFLICT</span>
              </div>
              <div className="text-right">
                <span className="block font-bold text-emerald-400 text-sm">+{Math.round(activeRec.improvement_pct || activeRec.improvement_pct)}%</span>
                <span className="block text-[9px] text-slate-500 font-mono">PROJECTED GAIN</span>
              </div>
            </div>

            {/* Recommended actions list */}
            <div className="space-y-2 mb-4">
              {activeRec.actions && activeRec.actions.map((act, i) => (
                <div key={i} className="bg-[#1a1c23] border border-[#2e303a]/65 rounded p-2 text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-ping" />
                    <span>Hold <strong className="text-purple-400">{act.train_id}</strong></span>
                  </div>
                  <span className="text-slate-300 font-bold">{Math.round(act.hold_minutes)} mins</span>
                </div>
              ))}
              {(!activeRec.actions || activeRec.actions.length === 0) && (
                <div className="text-xs text-slate-500 italic">No holding action necessary (FCFS optimal).</div>
              )}
            </div>

            {/* Performance Stats */}
            {activeRec.stats && (
              <div className="grid grid-cols-3 gap-2 border-t border-[#2e303a] pt-3 text-[10px] font-mono text-slate-400 mb-4">
                <div>
                  <span className="block text-slate-500">PLANNING TIME</span>
                  <span className="text-slate-200 font-semibold">{activeRec.stats.latency_ms?.toFixed(1) || '0'} ms</span>
                </div>
                <div>
                  <span className="block text-slate-500">DEPTH / WIDTH</span>
                  <span className="text-slate-200 font-semibold">{activeRec.stats.depth || '4'} / {activeRec.stats.beam_width || '8'}</span>
                </div>
                <div>
                  <span className="block text-slate-500">ALTS EVALUATED</span>
                  <span className="text-slate-200 font-semibold">{activeRec.stats.nodes_generated || activeRec.stats.alternatives_evaluated || '0'}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
            <Activity className="h-8 w-8 text-slate-600 animate-pulse mb-2" />
            <span>Standing by. No dispatch advisories generated.</span>
            <span className="text-[9px] text-slate-600 font-mono mt-0.5">TIMETABLE FCFS STATUS: STABLE</span>
          </div>
        )}

        {/* Buttons */}
        {activeRec && (
          <div className="flex items-center gap-2 border-t border-[#2e303a] pt-3">
            <button
              onClick={() => handleAccept(activeRec.actions)}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 rounded text-xs flex items-center justify-center gap-1 transition-colors duration-150"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept Recommendation</span>
            </button>
            <button
              onClick={() => {
                if (activeRec.actions && activeRec.actions.length > 0) {
                  setOverrideForm({
                    train_id: activeRec.actions[0].train_id,
                    action_type: 'hold',
                    hold_minutes: activeRec.actions[0].hold_minutes
                  });
                }
                setShowOverrideModal(true);
              }}
              className="bg-[#1a1c23] hover:bg-[#2e303a] border border-[#2e303a] text-slate-300 font-semibold py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1 transition-colors duration-150"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Override</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12131a] border border-[#2e303a] rounded-lg w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-md font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-400" />
              <span>Manual Dispatch Override</span>
            </h3>

            <form onSubmit={handleOverrideSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">TRAIN ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajdhani_01"
                  value={overrideForm.train_id}
                  onChange={e => setOverrideForm(prev => ({ ...prev, train_id: e.target.value }))}
                  className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">ACTION TYPE</label>
                  <select
                    value={overrideForm.action_type}
                    onChange={e => setOverrideForm(prev => ({ ...prev, action_type: e.target.value }))}
                    className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none"
                  >
                    <option value="hold">Hold</option>
                    <option value="noop">No-Op</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">HOLD (MIN)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={overrideForm.hold_minutes}
                    onChange={e => setOverrideForm(prev => ({ ...prev, hold_minutes: e.target.value }))}
                    className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="bg-[#1a1c23] hover:bg-[#2e303a] border border-[#2e303a] text-slate-300 px-4 py-2 rounded text-xs transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-xs transition-colors duration-150"
                >
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
