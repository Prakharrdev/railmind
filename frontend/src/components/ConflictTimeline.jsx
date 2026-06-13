import React from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { AlertOctagon, Clock, Link2, MapPin, ShieldAlert } from 'lucide-react';

export default function ConflictTimeline() {
  const { 
    conflicts, 
    selectedConflict, 
    setSelectedConflict, 
    setSelectedTrainId 
  } = useSimulatorState();

  const formatSimTime = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyBadge = (score) => {
    if (score < 10) return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    if (score < 25) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    return 'bg-rose-500/15 border-rose-500/30 text-rose-400 font-bold';
  };

  const handleConflictClick = (conflict) => {
    const isSelected = selectedConflict && 
      selectedConflict.train_a_id === conflict.train_a_id && 
      selectedConflict.train_b_id === conflict.train_b_id &&
      selectedConflict.block_id === conflict.block_id;

    if (isSelected) {
      setSelectedConflict(null);
      setSelectedTrainId(null);
    } else {
      setSelectedConflict(conflict);
      // Highlight Train A on click on map
      setSelectedTrainId(conflict.train_a_id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12131a] border border-[#2e303a] rounded-lg overflow-hidden select-none">
      {/* Header */}
      <div className="bg-[#161720] px-4 py-3 border-b border-[#2e303a] flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-rose-500 animate-pulse" />
          <span>Active Operations Conflicts ({conflicts.length})</span>
        </h2>
      </div>

      {/* Conflicts Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conflicts.map((c, index) => {
          const isSelected = selectedConflict && 
            selectedConflict.train_a_id === c.train_a_id && 
            selectedConflict.train_b_id === c.train_b_id &&
            selectedConflict.block_id === c.block_id;

          return (
            <div
              key={index}
              onClick={() => handleConflictClick(c)}
              className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 relative ${
                isSelected 
                  ? 'border-rose-500 bg-rose-950/10 shadow-lg shadow-rose-950/5' 
                  : 'border-[#2e303a] bg-[#1a1c23]/60 hover:bg-[#1a1c23]'
              }`}
            >
              {/* Top Details */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-rose-500/10 p-1.5 rounded-md border border-rose-500/30">
                    <AlertOctagon className="h-4 w-4 text-rose-400" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 text-sm">Block: {c.block_id}</span>
                    <span className="block text-[10px] text-slate-500 font-mono">CONCURRENT OVERLAY DETECTED</span>
                  </div>
                </div>
                
                <span className={`text-[10px] font-mono px-2 py-0.5 border rounded uppercase ${getUrgencyBadge(c.urgency_score)}`}>
                  Urgency: {Math.round(c.urgency_score)}
                </span>
              </div>

              {/* Train pairs visualization */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#0f1015]/60 rounded-md border border-[#2e303a]/50 text-xs font-semibold mb-3">
                <span 
                  onClick={(e) => { e.stopPropagation(); setSelectedTrainId(c.train_a_id); }}
                  className="text-purple-400 hover:underline cursor-pointer flex items-center gap-1 font-mono"
                >
                  {c.train_a_id}
                </span>
                <Link2 className="h-3.5 w-3.5 text-slate-500" />
                <span 
                  onClick={(e) => { e.stopPropagation(); setSelectedTrainId(c.train_b_id); }}
                  className="text-purple-400 hover:underline cursor-pointer flex items-center gap-1 font-mono"
                >
                  {c.train_b_id}
                </span>
              </div>

              {/* Start & Overlap Details */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Start:</span>
                  <span className="text-slate-200 font-semibold">{formatSimTime(c.conflict_start_sim_time)}</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <span>Overlap:</span>
                  <span className="text-rose-400 font-bold">{Math.round(c.overlap_minutes)} mins</span>
                </div>
              </div>

              {/* Conflict Projection Visualization (Progress Bar style) */}
              <div className="mt-3.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                <div 
                  className="absolute h-full bg-rose-500 rounded-full animate-pulse" 
                  style={{ 
                    left: '25%', 
                    width: `${Math.min(100, c.overlap_minutes * 5)}%` 
                  }} 
                />
              </div>
            </div>
          );
        })}

        {conflicts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
            <ShieldAlert className="h-8 w-8 text-emerald-500/40 mb-2" />
            <span className="text-xs">No active operations conflicts detected.</span>
            <span className="text-[10px] text-slate-600 font-mono mt-0.5">TIMELINE CLEAR | NORMAL RUN</span>
          </div>
        )}
      </div>
    </div>
  );
}
