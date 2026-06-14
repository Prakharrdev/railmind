import React from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { ShieldAlert, AlertTriangle, Clock, Link2, ArrowRight } from 'lucide-react';

export default function ConflictTimeline() {
  const { 
    conflicts = [], 
    selectedConflict, 
    setSelectedConflict, 
    setSelectedTrainId,
    recommendations = {},
    setSelectedRecommendationId
  } = useSimulatorState();

  const formatSimTime = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (score) => {
    if (score < 10) return { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400', badge: 'border-amber-500/35 bg-amber-500/10' };
    if (score < 25) return { border: 'border-orange-500/40', bg: 'bg-orange-500/5', text: 'text-orange-400', badge: 'border-orange-500/35 bg-orange-500/10' };
    return { border: 'border-rose-500/50', bg: 'bg-rose-500/5', text: 'text-rose-400 font-bold', badge: 'border-rose-500/35 bg-rose-500/10 animate-pulse' };
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

      // Workflow: Automatically locate and highlight matching AI recommendation & decision tree trace
      const matchingRec = Object.values(recommendations).find(rec => 
        rec.actions?.some(act => act.train_id === conflict.train_a_id || act.train_id === conflict.train_b_id)
      );
      if (matchingRec) {
        setSelectedRecommendationId(matchingRec.recommendation_id);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#15171e] border border-[#222530] rounded-lg overflow-hidden select-none">
      {/* Header */}
      <div className="bg-[#0d0e12]/30 px-4 py-3 border-b border-[#222530] flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
          <ShieldAlert className={`h-4 w-4 ${conflicts.length > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
          <span>Active Grid Conflicts ({conflicts.length})</span>
        </h2>
        <span className="text-[10px] text-slate-500 font-mono">RESOLVING CONFLICT → UPDATE VIEWS</span>
      </div>

      {/* Conflicts Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conflicts.map((c, index) => {
          const isSelected = selectedConflict && 
            selectedConflict.train_a_id === c.train_a_id && 
            selectedConflict.train_b_id === c.train_b_id &&
            selectedConflict.block_id === c.block_id;

          const colors = getSeverityColor(c.urgency_score);

          return (
            <div
              key={index}
              onClick={() => handleConflictClick(c)}
              className={`border rounded-lg p-3.5 cursor-pointer transition-all duration-150 relative ${
                isSelected 
                  ? 'border-purple-500 bg-purple-950/10 shadow-lg' 
                  : `${colors.border} ${colors.bg} hover:bg-[#1a1d26]/60`
              }`}
            >
              {/* Top Details */}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="bg-rose-500/10 p-1 rounded-md border border-rose-500/25">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-400 animate-pulse" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 text-xs font-mono">Block: {c.block_id}</span>
                    <span className="block text-[8px] text-slate-500 font-mono uppercase tracking-wide">Block Occupancy Conflict</span>
                  </div>
                </div>
                
                <span className={`text-[9px] font-mono px-2 py-0.5 border rounded uppercase ${colors.text} ${colors.badge}`}>
                  Urgency: {Math.round(c.urgency_score)}
                </span>
              </div>

              {/* Train pairs visualization */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d0e12] rounded border border-[#222530] text-xs font-mono mb-2.5">
                <span 
                  onClick={(e) => { e.stopPropagation(); setSelectedTrainId(c.train_a_id); }}
                  className="text-purple-400 hover:underline cursor-pointer font-bold"
                >
                  {c.train_a_id}
                </span>
                <Link2 className="h-3 w-3 text-slate-600" />
                <span 
                  onClick={(e) => { e.stopPropagation(); setSelectedTrainId(c.train_b_id); }}
                  className="text-purple-400 hover:underline cursor-pointer font-bold"
                >
                  {c.train_b_id}
                </span>
              </div>

              {/* Start & Overlap Details */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>Start:</span>
                  <span className="text-slate-200 font-semibold">{formatSimTime(c.conflict_start_sim_time)}</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <span>Overlap:</span>
                  <span className="text-rose-400 font-bold">{Math.round(c.overlap_minutes)} mins</span>
                </div>
              </div>

              {/* Occupancy timeline display indicator (simplified) */}
              <div className="mt-2.5 h-1.5 w-full bg-[#0d0e12] rounded-full overflow-hidden relative">
                <div 
                  className="absolute h-full bg-rose-500 rounded-full" 
                  style={{ 
                    left: '30%', 
                    width: `${Math.min(70, c.overlap_minutes * 6)}%` 
                  }} 
                />
              </div>
            </div>
          );
        })}

        {conflicts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs">
            <ShieldAlert className="h-8 w-8 text-emerald-500/30 mb-2" />
            <span className="font-semibold text-slate-400">Operations Timeline Stable</span>
            <span className="text-[9px] text-slate-600 font-mono mt-0.5 uppercase tracking-widest">No Active Conflicts</span>
          </div>
        )}
      </div>
    </div>
  );
}
