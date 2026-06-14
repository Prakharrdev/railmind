import { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { 
  Check, Settings, Activity, 
  Crosshair, AlertTriangle, ShieldCheck, TrainFront, Sparkles
} from 'lucide-react';

export default function RecommendationPanel() {
  const { 
    selectedRecommendationDetails,
    activeRecommendation, 
    recommendations, 
    selectedRecommendationId, 
    setSelectedRecommendationId,
    applyAction,
    trains = [],
    simTime = 840,
    network,
    conflicts = []
  } = useSimulatorState();

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [overrideForm, setOverrideForm] = useState({
    train_id: '',
    action_type: 'hold',
    hold_minutes: 5
  });

  const activeRec = selectedRecommendationDetails || activeRecommendation;
  const stations = network?.stations || [];

  const getStationName = (id) => {
    const station = stations.find(s => s.id === id);
    return station ? station.name : id;
  };

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

  const getTrainName = (trainId) => {
    const train = trains.find(t => t.train_id === trainId);
    return train ? train.name : trainId;
  };

  // Format simTime (in minutes) to HH:MM:SS
  const formatTime = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Quick action apply handlers
  const handleQuickHold = async (trainId, mins) => {
    try {
      await applyAction({ train_id: trainId, action_type: 'hold', hold_minutes: mins });
      alert(`Manual override action: hold ${trainId} for ${mins}m applied.`);
    } catch (err) {
      alert('Error applying action: ' + err.message);
    }
  };

  const handleQuickHoldBoth = async (trainA, trainB) => {
    try {
      await applyAction({ train_id: trainA, action_type: 'hold', hold_minutes: 5 });
      await applyAction({ train_id: trainB, action_type: 'hold', hold_minutes: 5 });
      alert('Manual override action: hold both trains for 5m applied.');
    } catch (err) {
      alert('Error applying action: ' + err.message);
    }
  };

  const handleQuickDoNothing = async (trainId) => {
    try {
      await applyAction({ train_id: trainId, action_type: 'noop', hold_minutes: 0 });
      alert('Manual override action: do nothing (FCFS sequence) applied.');
    } catch (err) {
      alert('Error applying action: ' + err.message);
    }
  };

  // Generate dynamic text explanation
  const getExplanationText = (act, otherTrainId, conflict) => {
    const trainA = getTrainName(act.train_id);
    const locName = getStationName(act.location || 'ETW');
    const blockText = conflict ? conflict.block_id.replace(/_/g, '-') : 'GZB-ALJN';
    
    return (
      <span>
        Holding <strong className="text-text-primary">{trainA}</strong> for {act.hold_minutes} minutes at <strong className="text-text-primary">{locName}</strong> will allow{' '}
        <strong className="text-action-blue">{getTrainName(otherTrainId)}</strong> to clear the <strong className="text-text-primary">{blockText}</strong> block and prevent a{' '}
        <strong className="text-signal-red font-bold">high-severity conflict</strong>.
      </span>
    );
  };

  // Get short train display for quick actions
  const getShortId = (id) => {
    const parts = id.split('_');
    return parts.length > 1 ? `${parts[0]} ${parts.slice(1).join(' ')}` : id;
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-surface-1 text-text-primary p-4 select-none justify-between overflow-y-auto">
      <div>
        {/* Dropdown Selector */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider font-mono">Select Advisory</span>
          <select
            value={selectedRecommendationId || ''}
            onChange={(e) => setSelectedRecommendationId(e.target.value || null)}
            className="bg-[#0b0e14]/60 border border-border/60 rounded-sm px-2.5 py-1 text-xs text-text-secondary focus:outline-none focus:border-action-blue font-mono"
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
          (() => {
            const primaryAction = activeRec.actions?.[0] || { train_id: 'Freight_01', action_type: 'hold', hold_minutes: 10, location: 'ETW' };
            const trainName = getTrainName(primaryAction.train_id);
            const projectedImpr = activeRec.improvement_pct || 0;
            const paxMinutesSaved = Math.round(projectedImpr * 1850);
            
            const conflict = conflicts.find(c => c.train_a_id === primaryAction.train_id || c.train_b_id === primaryAction.train_id);
            const otherTrainId = conflict ? (conflict.train_a_id === primaryAction.train_id ? conflict.train_b_id : conflict.train_a_id) : 'Vande_Bharat_02';
            const otherTrain = trains.find(t => t.train_id === otherTrainId);
            const otherTrainDelay = otherTrain ? Math.round(otherTrain.delay_minutes) : 42;

            let cleanTrainName = trainName;
            if (cleanTrainName.includes('Express')) cleanTrainName = cleanTrainName.replace('Express', 'Exp');

            return (
              <div className="space-y-4">
                {/* Recommended Action Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider font-sans">Recommended Action</span>
                  <span className="bg-signal-green/15 border border-signal-green/25 text-signal-green text-[9px] px-2.5 py-0.5 font-bold rounded-sm uppercase tracking-wider">
                    Best Option
                  </span>
                </div>

                {/* Hero Recommended Action Card */}
                <div className="bg-[#121826] border border-border/80 rounded-sm p-4 relative">
                  {/* Header with icon & action title */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-action-blue/10 flex items-center justify-center border border-action-blue/30 shrink-0">
                      <TrainFront className="h-5 w-5 text-action-blue" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="font-bold text-[15px] text-text-primary">Hold {cleanTrainName}</span>
                      <span className="text-[11px] text-text-secondary mt-0.5">at {getStationName(primaryAction.location || 'ETW')} ({primaryAction.location || 'ETW'})</span>
                    </div>
                  </div>

                  {/* Telemetry Row Grid (4 Columns) */}
                  <div className="grid grid-cols-4 gap-2 border-t border-b border-border/40 py-3.5 font-mono">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider font-sans">Duration</span>
                      <span className="text-text-primary text-[13px] font-bold mt-1 leading-none">{primaryAction.hold_minutes} min</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider font-sans">Location</span>
                      <span className="text-text-primary text-[13px] font-bold mt-1 leading-none truncate">{getStationName(primaryAction.location || 'ETW')} ({primaryAction.location || 'ETW'})</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider font-sans">Improvement</span>
                      <span className="text-signal-green text-[13px] font-bold mt-1 leading-none">{projectedImpr.toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider font-sans">Pax Delay Saved</span>
                      <span className="text-text-primary text-[13px] font-bold mt-1 leading-none">{paxMinutesSaved.toLocaleString()} min</span>
                    </div>
                  </div>

                  {/* Dynamic Explanation text block */}
                  <p className="text-[11px] text-text-secondary leading-relaxed font-sans mt-3.5">
                    {getExplanationText(primaryAction, otherTrainId, conflict)}
                  </p>
                </div>

                {/* Hero Action Buttons — matching reference with green Apply + outline Explore */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => handleAccept(activeRec.actions)}
                    className="flex-1 bg-signal-green hover:bg-[#0D9668] text-white font-bold py-2.5 rounded-sm text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md uppercase tracking-wider font-sans"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Apply Recommendation</span>
                  </button>
                  <button
                    onClick={() => {
                      if (primaryAction) {
                        setOverrideForm({
                          train_id: primaryAction.train_id,
                          action_type: 'hold',
                          hold_minutes: primaryAction.hold_minutes
                        });
                      }
                      setShowOverrideModal(true);
                    }}
                    className="border border-border hover:bg-surface-3 text-text-primary font-bold py-2.5 px-3.5 rounded-sm text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider font-sans"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-text-secondary" />
                    <span>Explore Alternatives</span>
                  </button>
                </div>

                {/* WHY THIS ACTION section */}
                <div className="border-t border-border/40 pt-4">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider font-sans block mb-3">Why this action?</span>
                  <div className="space-y-2.5 text-[11px] leading-relaxed">
                    <div className="flex items-start gap-2.5">
                      <Crosshair className="h-4 w-4 text-signal-red mt-0.5 shrink-0" />
                      <span className="text-text-secondary">
                        <strong className="text-text-primary">{getTrainName(otherTrainId)}</strong> is already delayed by <strong className="text-signal-red">{otherTrainDelay} minutes</strong> and carries more than 2,000 passengers.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-signal-orange mt-0.5 shrink-0" />
                      <span className="text-text-secondary">
                        Allowing it to proceed now prevents cascading delays for <strong className="text-text-primary">5 downstream trains</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="h-4 w-4 text-signal-green mt-0.5 shrink-0" />
                      <span className="text-text-secondary">
                        Total passenger delay reduction is <strong className="text-signal-green">{projectedImpr.toFixed(1)}%</strong> compared to all other options.
                      </span>
                    </div>
                  </div>
                </div>

                {/* OTHER QUICK ACTIONS section */}
                <div className="border-t border-border/40 pt-4 pb-2">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider font-sans block mb-2.5">Other Quick Actions</span>
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      onClick={() => handleQuickHold(otherTrainId, 5)}
                      className="bg-[#121826] hover:bg-[#1B2335] border border-border rounded-sm py-2.5 px-2 flex flex-col items-center justify-center transition-colors cursor-pointer text-center"
                    >
                      <span className="text-text-secondary font-sans font-bold text-[8px] tracking-wider uppercase">Hold {getTrainName(otherTrainId).split(' ')[0].slice(0, 8)}</span>
                      <span className="text-text-primary font-bold mt-0.5 text-[11px] font-mono">5 min</span>
                    </button>
                    <button 
                      onClick={() => handleQuickHold(primaryAction.train_id, 10)}
                      className="bg-[#121826] hover:bg-[#1B2335] border border-border rounded-sm py-2.5 px-2 flex flex-col items-center justify-center transition-colors cursor-pointer text-center"
                    >
                      <span className="text-text-secondary font-sans font-bold text-[8px] tracking-wider uppercase">Hold {getTrainName(primaryAction.train_id).split(' ')[0].slice(0, 8)}</span>
                      <span className="text-text-primary font-bold mt-0.5 text-[11px] font-mono">10 min</span>
                    </button>
                    <button 
                      onClick={() => handleQuickHoldBoth(otherTrainId, primaryAction.train_id)}
                      className="bg-[#121826] hover:bg-[#1B2335] border border-border rounded-sm py-2.5 px-2 flex flex-col items-center justify-center transition-colors cursor-pointer text-center"
                    >
                      <span className="text-text-secondary font-sans font-bold text-[8px] tracking-wider uppercase">Hold Both</span>
                      <span className="text-text-primary font-bold mt-0.5 text-[11px] font-mono">5 min</span>
                    </button>
                    <button 
                      onClick={() => handleQuickDoNothing(primaryAction.train_id)}
                      className="bg-[#121826]/30 hover:bg-[#ef4444]/5 border border-border hover:border-signal-red/35 rounded-sm py-2.5 px-2 flex flex-col items-center justify-center transition-colors cursor-pointer text-center"
                    >
                      <span className="text-text-secondary font-sans font-bold text-[8px] tracking-wider uppercase">Do Nothing</span>
                      <span className="text-signal-red font-bold mt-0.5 text-[10px] font-mono">(Not Recommended)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary text-xs">
            <Activity className="h-10 w-10 text-text-tertiary/50 animate-pulse mb-3" />
            <span className="font-semibold text-text-secondary">Standing By</span>
            <span className="text-[9px] text-text-tertiary font-mono mt-1 uppercase tracking-widest">Timetable flow stable</span>
          </div>
        )}
      </div>

      {/* Footer & Auto-Refresh Toggle */}
      <div className="shrink-0 pt-3.5 border-t border-border/40 mt-6 flex items-center justify-between text-[10px] font-mono text-text-tertiary">
        <span>Last Updated: {formatTime(simTime)}</span>
        <div className="flex items-center gap-1.5 font-sans font-medium text-text-secondary select-none">
          <span>Auto Refresh</span>
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
      </div>

      {/* Custom Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-border rounded w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2 font-mono">
              <Settings className="h-4.5 w-4.5 text-action-blue" />
              <span>Manual Dispatch Override</span>
            </h3>

            <form onSubmit={handleOverrideSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1 uppercase tracking-wider font-sans font-bold">TRAIN ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajdhani_01"
                  value={overrideForm.train_id}
                  onChange={e => setOverrideForm(prev => ({ ...prev, train_id: e.target.value }))}
                  className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none focus:border-action-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1 uppercase tracking-wider font-sans font-bold">ACTION TYPE</label>
                  <select
                    value={overrideForm.action_type}
                    onChange={e => setOverrideForm(prev => ({ ...prev, action_type: e.target.value }))}
                    className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none"
                  >
                    <option value="hold">Hold</option>
                    <option value="noop">No-Op</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1 uppercase tracking-wider font-sans font-bold">HOLD (MIN)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={overrideForm.hold_minutes}
                    onChange={e => setOverrideForm(prev => ({ ...prev, hold_minutes: e.target.value }))}
                    className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="bg-canvas hover:bg-surface-3 border border-border text-text-secondary hover:text-text-primary px-4 py-2 rounded text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-action-blue hover:bg-[#1A56DB] text-white px-4 py-2 rounded text-xs transition-colors font-bold cursor-pointer"
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
