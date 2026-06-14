import { useState, useEffect, useMemo } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { ShieldAlert, CheckCircle2, Clock, Check } from 'lucide-react';
import BlockOccupancyGantt from './BlockOccupancyGantt';

export default function ConflictTimeline() {
  const { 
    conflicts = [], 
    selectedConflict, 
    setSelectedConflict, 
    setSelectedTrainId,
    recommendations = {},
    setSelectedRecommendationId
  } = useSimulatorState();

  const [showResolved, setShowResolved] = useState(false);
  const [conflictHistory, setConflictHistory] = useState([]);

  // Sync conflicts into local state to keep track of resolved ones
  useEffect(() => {
    const timer = setTimeout(() => {
      setConflictHistory(prev => {
        // Start with a clone of current history
        const updated = prev.map(h => ({ ...h }));

        // Update or add current active conflicts
        conflicts.forEach(c => {
          const key = `${c.train_a_id}_${c.train_b_id}_${c.block_id}`;
          const matchIdx = updated.findIndex(h => `${h.train_a_id}_${h.train_b_id}_${h.block_id}` === key);
          if (matchIdx !== -1) {
            updated[matchIdx] = { ...c, active: true };
          } else {
            updated.push({ ...c, active: true });
          }
        });

        // Mark disappeared ones as inactive (resolved)
        updated.forEach(h => {
          const isActive = conflicts.some(c => `${c.train_a_id}_${c.train_b_id}_${c.block_id}` === `${h.train_a_id}_${h.train_b_id}_${h.block_id}`);
          if (!isActive) {
            h.active = false;
          }
        });

        return updated;
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [conflicts]);

  // Filter list based on ShowResolved toggle
  const displayedConflicts = useMemo(() => {
    const list = conflictHistory.filter(c => c.active || showResolved);
    // Sort active ones by urgency descending, then inactive ones
    return list.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return (b.urgency_score || 0) - (a.urgency_score || 0);
    });
  }, [conflictHistory, showResolved]);

  const getSeverityLevel = (score) => {
    const isScale100 = score > 1.0;
    const lowThresh = isScale100 ? 15 : 0.33;
    const medThresh = isScale100 ? 25 : 0.66;
    if (score < lowThresh) return 'LOW';
    if (score < medThresh) return 'MEDIUM';
    return 'HIGH';
  };

  const getSeverityColors = (level) => {
    switch (level) {
      case 'LOW':
        return { text: 'text-signal-yellow border-signal-yellow/30 bg-signal-yellow/5', colorHex: '#E8B339' };
      case 'MEDIUM':
        return { text: 'text-signal-orange border-signal-orange/30 bg-signal-orange/5', colorHex: '#E8772E' };
      default:
        return { text: 'text-signal-red border-signal-red/30 bg-signal-red/5', colorHex: '#E14B4B' };
    }
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
      setSelectedTrainId(conflict.train_a_id);

      // Locate corresponding recommendation automatically
      const matchingRec = Object.values(recommendations).find(rec => 
        rec.actions?.some(act => act.train_id === conflict.train_a_id || act.train_id === conflict.train_b_id)
      );
      if (matchingRec) {
        setSelectedRecommendationId(matchingRec.recommendation_id);
      }
    }
  };

  const formatSimTime = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Sections that are involved in any currently displayed conflict
  const activeSectionIds = useMemo(() => {
    const ids = [];
    displayedConflicts.forEach(c => {
      // block_id is e.g. "GZB_ALJN_01" -> section is "GZB_ALJN"
      const secId = c.block_id.split('_').slice(0, 2).join('_');
      if (secId && !ids.includes(secId)) {
        ids.push(secId);
      }
    });
    return ids;
  }, [displayedConflicts]);

  return (
    <div className="flex flex-col h-full bg-surface-1 select-none">
      {/* Header bar */}
      <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 bg-surface-1 bg-opacity-30">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-signal-red" />
          <h2 className="style-panel-title text-text-secondary leading-none">
            Active Conflicts & Timeline
          </h2>
          <span className="bg-signal-red/25 border border-signal-red/30 text-signal-red font-mono px-2 py-0.5 rounded-full text-[9px] font-bold leading-none ml-1.5">
            {conflicts.length}
          </span>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer style-label text-text-secondary hover:text-text-primary">
            <input 
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              className="rounded border-border text-action-blue focus:ring-0 h-3 w-3 bg-canvas"
            />
            <span>Show Resolved</span>
          </label>
        </div>
      </div>

      {/* Main split grid panel content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Conflict List Panel (35%) */}
        <div className="w-[35%] border-r border-border flex flex-col h-full overflow-hidden bg-surface-1">
          <div className="flex-grow overflow-y-auto divide-y divide-border/60">
            {displayedConflicts.map((c, index) => {
              const isSelected = selectedConflict && 
                selectedConflict.train_a_id === c.train_a_id && 
                selectedConflict.train_b_id === c.train_b_id &&
                selectedConflict.block_id === c.block_id;

              const level = getSeverityLevel(c.urgency_score);
              const colors = getSeverityColors(level);
              const isMonitoring = c.urgency_score < (c.urgency_score > 1.0 ? 15 : 0.33);

              return (
                <div
                  key={index}
                  onClick={() => handleConflictClick(c)}
                  className={`p-3 cursor-pointer transition-all ${
                    !c.active ? 'opacity-40' : ''
                  } ${
                    isSelected 
                      ? 'bg-action-blue-muted border-l-2 border-action-blue' 
                      : 'hover:bg-surface-2 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {/* block name */}
                      <span className="style-data-md text-text-primary block font-semibold leading-tight">
                        {c.block_id.replace(/_/g, '–')}
                      </span>
                      <span className="style-body text-text-secondary mt-0.5 block leading-tight">
                        {c.train_a_id.slice(-5)} vs {c.train_b_id.slice(-5)}
                      </span>
                    </div>

                    {/* Urgency/Severity Badge */}
                    {c.active ? (
                      <span className={`style-label font-bold border px-1.5 py-0.5 rounded-sm ${colors.text}`}>
                        {level}
                      </span>
                    ) : (
                      <span className="style-label font-bold border border-signal-green/20 bg-signal-green/10 text-signal-green px-1.5 py-0.5 rounded-sm flex items-center gap-1 shrink-0">
                        <Check className="h-2.5 w-2.5" />
                        <span>RESOLVED</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-text-tertiary">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Start: {formatSimTime(c.conflict_start_sim_time)}</span>
                    </span>

                    {/* Status marker */}
                    <div className="flex items-center gap-1.5">
                      {c.active ? (
                        <>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            isMonitoring ? 'bg-signal-yellow' : 'bg-signal-red pulse-indicator'
                          }`} />
                          <span className="style-label">
                            {isMonitoring ? 'MONITORING' : 'ACTIVE'}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-signal-green" />
                          <span className="style-label text-signal-green">RESOLVED</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {displayedConflicts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-text-tertiary text-center">
                <CheckCircle2 className="h-8 w-8 text-signal-green/30 mb-2" />
                <span className="style-card-title text-text-secondary leading-none">Timeline Stable</span>
                <span className="style-label text-text-tertiary mt-1">No conflicts detected</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Block Occupancy Gantt Chart (65%) */}
        <div className="w-[65%] h-full flex flex-col overflow-hidden bg-canvas">
          <BlockOccupancyGantt activeSectionIds={activeSectionIds} />
        </div>
      </div>
    </div>
  );
}
