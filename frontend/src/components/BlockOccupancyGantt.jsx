import { useMemo } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';

export default function BlockOccupancyGantt({ activeSectionIds = [] }) {
  const { 
    network, 
    trains = [], 
    simTime = 840, 
    activeRecommendation,
    selectedConflict,
    setSelectedTrainId 
  } = useSimulatorState();

  const sections = useMemo(() => network?.sections || [], [network?.sections]);

  // 1. Projection algorithm for all trains
  const projectedOccupancies = useMemo(() => {
    const allOccupancies = [];

    // Order of sections by direction
    const upSectionOrder = [
      "NDLS_GZB", "GZB_ALJN", "ALJN_HRS", "HRS_TDL", "TDL_FZD", "FZD_SKB", "SKB_ETW", "ETW_PHD", "PHD_CNB"
    ];
    const downSectionOrder = [
      "PHD_CNB", "ETW_PHD", "SKB_ETW", "FZD_SKB", "TDL_FZD", "HRS_TDL", "ALJN_HRS", "GZB_ALJN", "NDLS_GZB"
    ];

    trains.forEach(train => {
      const dir = train.direction || 'UP';
      const order = dir === 'UP' ? upSectionOrder : downSectionOrder;

      let currentSecId = train.section_id;

      if (!currentSecId) {
        // Stopped at station
        const matchedSec = sections.find(s => 
          dir === 'UP' ? s.from === train.last_station : s.to === train.last_station
        );
        currentSecId = matchedSec ? matchedSec.id : null;
      }

      if (!currentSecId) return;

      const secIdx = order.indexOf(currentSecId);
      if (secIdx === -1) return;

      let tempTime = simTime;

      // Project along sections route
      for (let i = secIdx; i < order.length; i++) {
        const secId = order[i];
        const sec = sections.find(s => s.id === secId);
        if (!sec) continue;

        // Traversal duration estimation
        let duration = sec.typical_traversal_min || 15;
        const speed = train.speed_kmph || 0;

        if (i === secIdx) {
          // Current section remaining progress
          const progress = train.progress || 0;
          if (speed > 5) {
            const remainingKm = sec.distance_km * (1 - progress);
            duration = (remainingKm / speed) * 60;
          } else {
            duration = duration * (1 - progress);
          }
        } else {
          // Future section full traversal
          if (speed > 5) {
            duration = (sec.distance_km / speed) * 60;
          }
        }

        // Clamp duration to make sure it doesn't break
        duration = Math.max(1, Math.min(120, duration));

        const start = tempTime;
        const end = tempTime + duration;

        allOccupancies.push({
          sectionId: secId,
          trainId: train.train_id,
          trainClass: train.train_class,
          trainName: train.name,
          delay: train.delay_minutes,
          start,
          end
        });

        tempTime = end;
        if (start - simTime > 60) break;
      }
    });

    return allOccupancies;
  }, [trains, sections, simTime]);

  // 2. Identify Overlap Conflicts
  const overlaps = useMemo(() => {
    const list = [];
    const grouped = {};

    // Group occupancies by sectionId
    projectedOccupancies.forEach(occ => {
      if (!grouped[occ.sectionId]) grouped[occ.sectionId] = [];
      grouped[occ.sectionId].push(occ);
    });

    // Detect overlap intervals per section
    Object.entries(grouped).forEach(([sectionId, occs]) => {
      if (occs.length < 2) return;

      for (let i = 0; i < occs.length; i++) {
        for (let j = i + 1; j < occs.length; j++) {
          const o1 = occs[i];
          const o2 = occs[j];

          // Check if overlap exists
          const start = Math.max(o1.start, o2.start);
          const end = Math.min(o1.end, o2.end);

          if (start < end) {
            list.push({
              sectionId,
              start,
              end,
              trainA: o1.trainId,
              trainB: o2.trainId
            });
          }
        }
      }
    });

    return list;
  }, [projectedOccupancies]);

  // Determine which sections to show (Filter to sections with conflicts, or show all sections)
  const visibleSections = useMemo(() => {
    if (activeSectionIds.length > 0) {
      return sections.filter(s => activeSectionIds.includes(s.id));
    }
    // Default: show sections that have any overlap conflicts or active trains
    const sectionsWithConflictsOrTrains = sections.filter(s => {
      const hasConflict = overlaps.some(o => o.sectionId === s.id);
      const hasTrain = trains.some(t => t.section_id === s.id);
      return hasConflict || hasTrain;
    });

    // If none, show all sections
    return sectionsWithConflictsOrTrains.length > 0 ? sectionsWithConflictsOrTrains : sections;
  }, [sections, overlaps, trains, activeSectionIds]);

  // Aspect color mapping
  const getSeverityColor = (delay) => {
    if (delay <= 0.1) return 'bg-signal-green';
    if (delay <= 15) return 'bg-signal-yellow';
    if (delay <= 30) return 'bg-signal-orange';
    return 'bg-signal-red';
  };

  // Convert time to percentage from start (simTime)
  const getPercent = (time) => {
    const elapsed = time - simTime;
    return Math.max(0, Math.min(100, (elapsed / 60) * 100));
  };

  // 10-minute grid increments
  const gridIntervals = [0, 10, 20, 30, 40, 50, 60];

  // Helper to format sim clock minute labels
  const formatTimeLabel = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Find first action timestamp if recommendation exists
  const recActionTime = useMemo(() => {
    if (activeRecommendation?.sim_time) {
      // First action usually takes place at sim_time + lookup
      return activeRecommendation.sim_time;
    }
    return null;
  }, [activeRecommendation]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none bg-surface-1 text-text-primary p-4">
      {/* Time Header Grid labels */}
      <div className="flex shrink-0 mb-2.5">
        <div className="w-28 shrink-0"></div>
        <div className="flex-grow h-6 relative font-mono text-[10px] text-text-tertiary">
          {gridIntervals.map(min => {
            const timeVal = simTime + min;
            return (
              <div 
                key={min} 
                style={{ left: `${(min / 60) * 100}%` }}
                className="absolute -translate-x-1/2 flex flex-col items-center"
              >
                <span>+{min}m</span>
                <span className="text-[9px] text-text-tertiary/60 font-normal mt-0.5">{formatTimeLabel(timeVal)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gantt Rows */}
      <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
        {visibleSections.map(sec => {
          // Find occupancies for this section
          const secOccs = projectedOccupancies.filter(o => o.sectionId === sec.id);
          // Find overlaps for this section
          const secOverlaps = overlaps.filter(o => o.sectionId === sec.id);

          const isConflictRow = selectedConflict && (
            selectedConflict.block_id.startsWith(sec.id)
          );

          return (
            <div 
              key={sec.id} 
              className={`flex items-center h-8 rounded-sm transition-all ${
                isConflictRow ? 'bg-surface-3/50' : 'bg-surface-1/40 hover:bg-surface-3/20'
              }`}
            >
              {/* Row title */}
              <div className="w-28 shrink-0 style-data-sm text-text-secondary pl-2 flex flex-col truncate">
                <span className="font-semibold text-text-primary">{sec.id.replace('_', '–')}</span>
                <span className="text-[9px] text-text-tertiary leading-none mt-0.5">
                  {sec.tracks} Track{sec.tracks > 1 ? 's' : ''}
                </span>
              </div>

              {/* Gantt timeline track */}
              <div className="flex-grow h-6 bg-canvas border border-border/50 rounded-sm relative overflow-hidden">
                {/* 10-minute vertical gridlines */}
                {gridIntervals.map(min => (
                  <div
                    key={min}
                    style={{ left: `${(min / 60) * 100}%` }}
                    className="absolute top-0 bottom-0 border-l border-border/30 pointer-events-none"
                  />
                ))}

                {/* Draw Occupancy Blocks */}
                {secOccs.map((occ, idx) => {
                  const left = getPercent(occ.start);
                  const right = getPercent(occ.end);
                  const width = right - left;

                  if (width <= 0.1) return null;

                  const colorClass = getSeverityColor(occ.delay);
                  const isTrainSelected = selectedConflict && (
                    selectedConflict.train_a_id === occ.trainId || 
                    selectedConflict.train_b_id === occ.trainId
                  );

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedTrainId(occ.trainId)}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center cursor-pointer px-1.5 transition-all shadow-sm ${colorClass} ${
                        isTrainSelected ? 'ring-1 ring-white/50 scale-[1.02] z-10' : 'hover:brightness-105'
                      }`}
                    >
                      {width > 8 && (
                        <span className="style-data-sm text-canvas font-bold truncate">
                          {occ.trainId.slice(-5)}
                        </span>
                      )}
                      <title>{`Train ${occ.trainId} (${occ.trainName})\nDelay: ${occ.delay} min\nTime: ${formatTimeLabel(occ.start)} - ${formatTimeLabel(occ.end)}`}</title>
                    </div>
                  );
                })}

                {/* Draw Overlap hatched overlay */}
                {secOverlaps.map((overlap, idx) => {
                  const left = getPercent(overlap.start);
                  const right = getPercent(overlap.end);
                  const width = right - left;

                  if (width <= 0.1) return null;

                  return (
                    <div
                      key={`overlap-${idx}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className="absolute top-0 bottom-0 pointer-events-none red-hatch-pattern z-10 border-x border-signal-red/35"
                    >
                      <title>{`Overlap conflict between ${overlap.trainA} and ${overlap.trainB}\nTime: ${formatTimeLabel(overlap.start)} - ${formatTimeLabel(overlap.end)}`}</title>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {visibleSections.length === 0 && (
          <div className="text-center py-8 text-xs text-text-tertiary italic font-mono">
            No occupied block sections projecting.
          </div>
        )}
      </div>

      {/* Pinned Vertical Time Indicator Lines */}
      <div className="absolute top-0 bottom-0 left-[128px] right-4 pointer-events-none">
        {/* SimTime "NOW" line */}
        <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-border-strong left-0 z-20">
          <div className="bg-border-strong text-text-primary px-1 py-0.5 style-label rounded-b absolute top-0 -left-[14px]">
            NOW
          </div>
        </div>

        {/* First action effect execution line */}
        {recActionTime && getPercent(recActionTime) > 0 && getPercent(recActionTime) <= 100 && (
          <div 
            style={{ left: `${getPercent(recActionTime)}%` }}
            className="absolute top-0 bottom-0 border-l border-dotted border-signal-green z-20"
          >
            <div className="bg-signal-green/20 text-signal-green px-1 py-0.5 style-label rounded-b absolute top-0 -translate-x-1/2">
              REC EFF
            </div>
          </div>
        )}
      </div>

      {/* Gantt Footer captions */}
      <div className="shrink-0 mt-2.5 pt-2 border-t border-border/50 text-[10px] text-text-tertiary flex items-center justify-between">
        <span>* Projected schedules based on current speeds and remaining progress.</span>
        <span className="flex items-center gap-2 font-mono">
          <span className="inline-block h-2.5 w-6 red-hatch-pattern border border-signal-red/35 rounded-sm" /> Block Conflict (Overlap Zone)
        </span>
      </div>
    </div>
  );
}
