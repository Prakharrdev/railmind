import { useState, useEffect, useMemo } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { ShieldAlert, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import BlockOccupancyGantt from './BlockOccupancyGantt';

export default function ConflictTimeline() {
  const { 
    conflicts = [], 
    selectedConflict, 
    setSelectedConflict, 
    setSelectedTrainId,
    recommendations = {},
    setSelectedRecommendationId,
    trains = []
  } = useSimulatorState();

  const [showResolved, setShowResolved] = useState(false);
  const [conflictHistory, setConflictHistory] = useState([]);

  // Sync conflicts into local state to keep track of resolved ones
  useEffect(() => {
    const timer = setTimeout(() => {
      setConflictHistory(prev => {
        const updated = prev.map(h => ({ ...h }));

        conflicts.forEach(c => {
          const key = `${c.train_a_id}_${c.train_b_id}_${c.block_id}`;
          const matchIdx = updated.findIndex(h => `${h.train_a_id}_${h.train_b_id}_${h.block_id}` === key);
          if (matchIdx !== -1) {
            updated[matchIdx] = { ...c, active: true };
          } else {
            updated.push({ ...c, active: true });
          }
        });

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

  // Get train name from ID
  const getTrainName = (trainId) => {
    const train = trains.find(t => t.train_id === trainId);
    return train ? train.name : trainId;
  };

  // Get short name for display
  const getShortName = (trainId) => {
    const train = trains.find(t => t.train_id === trainId);
    if (!train) return trainId.slice(-5);
    // e.g. "Rajdhani 12302"
    const firstName = train.name.split(' ')[0];
    const idShort = trainId.replace(/_/g, ' ');
    return `${firstName} ${idShort.slice(-5)}`;
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
      <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 bg-surface-1">
        <div className="flex items-center gap-2.5">
          <h2 className="style-panel-title text-text-secondary leading-none">
            Active Conflicts & Timeline
          </h2>
          <span className="bg-signal-red/20 border border-signal-red/30 text-signal-red font-mono px-2.5 py-0.5 rounded-full text-[10px] font-bold leading-none">
            {conflicts.length}
          </span>
        </div>

        {/* Show Resolved Toggle */}
        <div className="flex items-center gap-2">
          <span className="style-label text-text-secondary">Show Resolved</span>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`w-8 h-[18px] flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 ${
              showResolved ? 'bg-signal-green' : 'bg-surface-3'
            }`}
          >
            <div
              className={`bg-canvas w-3.5 h-3.5 rounded-full shadow transform transition-transform duration-200 ${
                showResolved ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main split grid panel content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Conflict List Panel (35%) */}
        <div className="w-[35%] border-r border-border flex flex-col h-full overflow-hidden bg-surface-1">
          {/* Column Headers */}
          <div className="grid grid-cols-[1.8fr_1fr_1.2fr] gap-2 px-3 py-2.5 border-b border-border/50 bg-[#0d0e12]/30 text-[9px] font-bold text-text-tertiary uppercase tracking-wider shrink-0">
            <span>Conflict</span>
            <span>Severity</span>
            <span className="text-right">Status</span>
          </div>

          <div className="flex-grow overflow-y-auto divide-y divide-border/40">
            {displayedConflicts.map((c, index) => {
              const isSelected = selectedConflict && 
                selectedConflict.train_a_id === c.train_a_id && 
                selectedConflict.train_b_id === c.train_b_id &&
                selectedConflict.block_id === c.block_id;

              const level = getSeverityLevel(c.urgency_score);
              const isMonitoring = c.urgency_score < (c.urgency_score > 1.0 ? 15 : 0.33);

              // Format section name like "GZB – ALJN"
              const sectionLabel = c.block_id.split('_').slice(0, 2).join(' – ');

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
                  <div className="grid grid-cols-[1.8fr_1fr_1.2fr] items-center gap-2">
                    {/* Column 1: Conflict details */}
                    <div className="min-w-0">
                      <span className="text-[11px] text-text-primary font-bold block leading-tight font-mono">
                        {sectionLabel}
                      </span>
                      <span className="text-[9px] text-text-secondary mt-0.5 block leading-tight truncate font-sans">
                        {getShortName(c.train_a_id)} vs {getShortName(c.train_b_id)}
                      </span>
                    </div>

                    {/* Column 2: Severity Badge */}
                    <div>
                      {c.active ? (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider block text-center w-fit ${
                          level === 'HIGH' ? 'bg-signal-red text-white' :
                          level === 'MEDIUM' ? 'bg-signal-orange text-white' :
                          'bg-signal-yellow text-canvas'
                        }`}>
                          {level}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-signal-green/20 text-signal-green px-1.5 py-0.5 rounded-sm uppercase tracking-wider block text-center w-fit">
                          RESOLVED
                        </span>
                      )}
                    </div>

                    {/* Column 3: Status */}
                    <div className="flex items-center gap-1.5 justify-end font-mono text-[9px]">
                      {c.active ? (
                        <>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            isMonitoring ? 'bg-signal-yellow' : 'bg-signal-red pulse-indicator'
                          }`} />
                          <span className={`font-bold ${isMonitoring ? 'text-signal-yellow' : 'text-signal-red'}`}>
                            {isMonitoring ? 'MONITORING' : 'ACTIVE'}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-signal-green" />
                          <span className="font-bold text-signal-green">RESOLVED</span>
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

          {/* View All Conflicts link */}
          <div className="p-3 border-t border-border shrink-0 bg-surface-1">
            <button className="w-full flex items-center justify-center gap-1 text-action-blue style-label hover:text-white transition-colors cursor-pointer py-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>View All Conflicts</span>
              <ChevronRight className="h-3 w-3" />
            </button>
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
