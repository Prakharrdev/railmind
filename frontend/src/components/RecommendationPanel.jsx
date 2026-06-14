import React, { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Check, ShieldAlert, Settings, Zap, Activity, Clock, MapPin, Award } from 'lucide-react';

export default function RecommendationPanel() {
  const { 
    selectedRecommendationDetails,
    activeRecommendation, 
    recommendations, 
    selectedRecommendationId, 
    setSelectedRecommendationId,
    applyAction,
    trains = []
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
      alert('AI Dispatch recommendation successfully applied to active coordinator.');
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
      alert('Manual override action successfully logged.');
    } catch (err) {
      alert('Failed to apply override action: ' + err.message);
    }
  };

  // Helper to derive current location of a train from live state
  const getTrainLocation = (trainId) => {
    const train = trains.find(t => t.train_id === trainId);
    if (!train) return 'En Route';
    if (train.section_id) {
      return `Section ${train.section_id}`;
    }
    return train.last_station || 'Terminal';
  };

  const getTrainName = (trainId) => {
    const train = trains.find(t => t.train_id === trainId);
    return train ? train.name : trainId;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#15171e] text-slate-200 p-4 select-none justify-between">
      <div>
        {/* Dropdown Selector */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222530] mb-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Select Advisory</span>
          <select
            value={selectedRecommendationId || ''}
            onChange={(e) => setSelectedRecommendationId(e.target.value || null)}
            className="bg-[#0d0e12] border border-[#222530] rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-purple-500 font-mono"
          >
            <option value="">-- Active Advisory --</option>
            {Object.keys(recommendations).map((id) => (
              <option key={id} value={id}>
                {id} (sim min: {Math.round(recommendations[id].sim_time)})
              </option>
            ))}
          </select>
        </div>

        {activeRec ? (
          <div className="space-y-4">
            {/* 3. Recommendation Hero Card */}
            {activeRec.actions && activeRec.actions.length > 0 ? (
              (() => {
                const primaryAction = activeRec.actions[0];
                const trainName = getTrainName(primaryAction.train_id);
                const trainLoc = getTrainLocation(primaryAction.train_id);
                const projectedImpr = activeRec.improvement_pct || 0;
                const paxMinutesSaved = Math.round(projectedImpr * 1850);

                return (
                  <div className="bg-[#7c3aed]/10 border-2 border-[#7c3aed] rounded-lg p-5 relative overflow-hidden shadow-xl shadow-purple-950/10">
                    {/* Background subtle badge logo */}
                    <div className="absolute right-[-10px] bottom-[-10px] text-purple-500/10 opacity-30 select-none pointer-events-none">
                      <Zap className="h-32 w-32" />
                    </div>

                    <span className="block text-[10px] font-bold tracking-widest text-purple-400 uppercase font-mono mb-1.5">
                      RECOMMENDED ACTION
                    </span>

                    <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-purple-400 fill-purple-400/20 animate-pulse" />
                      <span>Hold {trainName}</span>
                    </h3>

                    {/* Telemetry Grid */}
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-t border-[#7c3aed]/20 pt-3 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-purple-400" />
                        <span>Location:</span>
                        <span className="text-slate-100 font-semibold truncate max-w-[90px]">{trainLoc}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5 text-purple-400" />
                        <span>Duration:</span>
                        <span className="text-slate-100 font-bold">{primaryAction.hold_minutes} min</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Award className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Gain:</span>
                        <span className="text-emerald-400 font-bold">+{projectedImpr.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Activity className="h-3.5 w-3.5 text-purple-400" />
                        <span>Pax-Min Saved:</span>
                        <span className="text-purple-300 font-semibold">{paxMinutesSaved.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="bg-[#10b981]/5 border border-[#10b981]/30 rounded-lg p-5 text-center text-xs font-mono">
                <Check className="h-6 w-6 text-emerald-500 mx-auto mb-2 animate-bounce" />
                <div className="font-bold text-emerald-400 uppercase tracking-widest text-[10px] mb-1">FCFS Optimal</div>
                <div className="text-slate-400">No dispatch action required. Default schedule flow is clear.</div>
              </div>
            )}

            {/* Other actions list if more than 1 */}
            {activeRec.actions && activeRec.actions.length > 1 && (
              <div className="space-y-2 mt-2">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Secondary Actions</span>
                {activeRec.actions.slice(1).map((act, i) => (
                  <div key={i} className="bg-[#0d0e12] border border-[#222530] rounded p-2 text-xs font-mono flex items-center justify-between">
                    <span className="text-slate-300">Hold {getTrainName(act.train_id)}</span>
                    <span className="text-purple-400 font-bold">{act.hold_minutes} mins</span>
                  </div>
                ))}
              </div>
            )}

            {/* Performance Stats */}
            {activeRec.stats && (
              <div className="grid grid-cols-3 gap-2 border-t border-[#222530] pt-4 text-[10px] font-mono text-slate-500">
                <div>
                  <span className="block uppercase text-[8px] tracking-wider text-slate-500">PLAN TIME</span>
                  <span className="text-slate-300 font-bold">{activeRec.stats.latency_ms?.toFixed(1) || '0'} ms</span>
                </div>
                <div>
                  <span className="block uppercase text-[8px] tracking-wider text-slate-500">DEPTH/WIDTH</span>
                  <span className="text-slate-300 font-bold">{activeRec.stats.depth || '4'} / {activeRec.stats.beam_width || '8'}</span>
                </div>
                <div>
                  <span className="block uppercase text-[8px] tracking-wider text-slate-500">EVALUATED</span>
                  <span className="text-slate-300 font-bold">{activeRec.stats.nodes_generated || activeRec.stats.alternatives_evaluated || '0'}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs">
            <Activity className="h-10 w-10 text-slate-600 animate-pulse mb-3" />
            <span className="font-semibold text-slate-400">Standing By</span>
            <span className="text-[9px] text-slate-600 font-mono mt-1 uppercase tracking-widest">Timetable flow stable</span>
          </div>
        )}
      </div>

      {/* Buttons */}
      {activeRec && (
        <div className="flex items-center gap-2 border-t border-[#222530] pt-4 mt-6">
          <button
            onClick={() => handleAccept(activeRec.actions)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>Apply Advisory</span>
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
            className="bg-[#0d0e12] hover:bg-[#1a1d26] border border-[#222530] text-slate-300 font-bold py-2 px-3.5 rounded text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4 text-slate-400" />
            <span>Override</span>
          </button>
        </div>
      )}

      {/* Custom Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#15171e] border border-[#222530] rounded-lg w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2 font-mono">
              <Settings className="h-4.5 w-4.5 text-purple-400" />
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
                  className="w-full bg-[#0d0e12] border border-[#222530] rounded p-2.5 text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">ACTION TYPE</label>
                  <select
                    value={overrideForm.action_type}
                    onChange={e => setOverrideForm(prev => ({ ...prev, action_type: e.target.value }))}
                    className="w-full bg-[#0d0e12] border border-[#222530] rounded p-2.5 text-slate-100 focus:outline-none"
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
                    className="w-full bg-[#0d0e12] border border-[#222530] rounded p-2.5 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222530] mt-6">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="bg-[#0d0e12] hover:bg-[#1a1d26] border border-[#222530] text-slate-400 hover:text-slate-200 px-4 py-2 rounded text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-xs transition-colors font-bold cursor-pointer"
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
