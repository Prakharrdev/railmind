import { useState, useEffect } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Search, SlidersHorizontal, ArrowRight, Locate } from 'lucide-react';
import timetableData from '../utils/timetable.json';

export default function Sidebar() {
  const { 
    trains = [], 
    network,
    selectedTrainId, 
    setSelectedTrainId,
    setSelectedConflict
  } = useSimulatorState();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [statusFilters, setStatusFilters] = useState({
    onTime: true,
    delayed: true
  });
  const [classFilters, setClassFilters] = useState({
    rajdhani: true,
    mailExpress: true,
    passenger: true,
    freight: true
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const stations = network?.stations || [];
  
  // Helper to map station ID to full name
  const getStationName = (id) => {
    const station = stations.find(s => s.id === id);
    return station ? station.name : id;
  };

  // Helper to count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (!statusFilters.onTime || !statusFilters.delayed) count++;
    if (!classFilters.rajdhani || !classFilters.mailExpress || !classFilters.passenger || !classFilters.freight) count++;
    return count;
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilters({ onTime: true, delayed: true });
    setClassFilters({ rajdhani: true, mailExpress: true, passenger: true, freight: true });
  };

  // Map backend classes to simplified filters
  const getSimplifiedClass = (trainClass) => {
    const cls = (trainClass || '').toLowerCase();
    if (cls.includes('rajdhani') || cls.includes('shatabdi') || cls.includes('vande')) {
      return 'rajdhani';
    }
    if (cls.includes('mail') || cls.includes('express') || cls.includes('superfast')) {
      return 'mailExpress';
    }
    if (cls.includes('passenger') || cls.includes('memu')) {
      return 'passenger';
    }
    if (cls.includes('freight') || cls.includes('goods')) {
      return 'freight';
    }
    return 'passenger';
  };

  // Get Aspect color based on delay band
  const getDelayAspect = (delay) => {
    if (delay <= 0.1) return { color: 'text-signal-green', dot: 'bg-signal-green', label: 'ON TIME' };
    if (delay <= 15) return { color: 'text-signal-yellow', dot: 'bg-signal-yellow', label: `+${Math.round(delay)} MIN` };
    if (delay <= 30) return { color: 'text-signal-orange', dot: 'bg-signal-orange', label: `+${Math.round(delay)} MIN` };
    return { color: 'text-signal-red', dot: 'bg-signal-red', label: `+${Math.round(delay)} MIN` };
  };

  // Filter trains
  const filteredTrains = trains.filter(train => {
    // 1. Search term match (case-insensitive substring)
    const matchesSearch = 
      train.train_id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      train.name.toLowerCase().includes(debouncedSearch.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Status match
    const isDelayed = train.delay_minutes > 0.1;
    if (isDelayed && !statusFilters.delayed) return false;
    if (!isDelayed && !statusFilters.onTime) return false;

    // 3. Class match
    const simplifiedClass = getSimplifiedClass(train.train_class);
    if (!classFilters[simplifiedClass]) return false;

    return true;
  });

  return (
    <aside className="w-full bg-surface-1 border-r border-border flex flex-col h-full overflow-hidden select-none shrink-0 relative z-30">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="style-panel-title text-text-secondary">
          Active Trains ({filteredTrains.length})
        </h2>
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={`p-1.5 rounded hover:bg-surface-3 transition-colors cursor-pointer relative ${
              getActiveFilterCount() > 0 ? 'text-action-blue' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {getActiveFilterCount() > 0 && (
              <span className="absolute top-0 right-0 h-1.5 w-1.5 bg-action-blue rounded-full" />
            )}
          </button>

          {/* Filter Dropdown */}
          {showFilterMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-surface-3 border border-border rounded shadow-xl z-50 p-3">
              <div className="flex items-center justify-between border-b border-border pb-1.5 mb-2.5">
                <span className="style-label text-text-secondary">Filters</span>
                <button 
                  onClick={() => resetFilters()}
                  className="text-[10px] text-action-blue hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>

              {/* Status Section */}
              <div className="mb-3">
                <span className="style-label text-text-tertiary block mb-1">Status</span>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                    <input 
                      type="checkbox" 
                      checked={statusFilters.onTime}
                      onChange={e => setStatusFilters(prev => ({ ...prev, onTime: e.target.checked }))}
                      className="rounded border-border text-action-blue focus:ring-0 h-3 w-3 bg-canvas"
                    />
                    <span>On Time</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                    <input 
                      type="checkbox" 
                      checked={statusFilters.delayed}
                      onChange={e => setStatusFilters(prev => ({ ...prev, delayed: e.target.checked }))}
                      className="rounded border-border text-action-blue focus:ring-0 h-3 w-3 bg-canvas"
                    />
                    <span>Delayed</span>
                  </label>
                </div>
              </div>

              {/* Class Section */}
              <div>
                <span className="style-label text-text-tertiary block mb-1">Class</span>
                <div className="space-y-1">
                  {Object.entries({
                    rajdhani: 'Rajdhani',
                    mailExpress: 'Mail / Express',
                    passenger: 'Passenger',
                    freight: 'Freight'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer hover:text-text-primary">
                      <input 
                        type="checkbox" 
                        checked={classFilters[key]}
                        onChange={e => setClassFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-border text-action-blue focus:ring-0 h-3 w-3 bg-canvas"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2 border-b border-border shrink-0 bg-surface-1">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search train or ID…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded pl-8 pr-3 py-1 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-border-strong font-sans h-8"
          />
        </div>
      </div>

      {/* Roster Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-surface-1">
        {filteredTrains.map((train) => {
          const isSelected = selectedTrainId === train.train_id;
          const aspect = getDelayAspect(train.delay_minutes);

          // Find matching static timetable endpoints
          const timetableTrain = timetableData.trains.find(t => 
            t.id === train.train_id || 
            train.train_id.startsWith(t.id) ||
            train.train_id.toLowerCase().includes(t.name.toLowerCase())
          );

          const stops = timetableTrain?.stops || [];
          const originCode = stops[0]?.station_id || 'NDLS';
          const destCode = stops[stops.length - 1]?.station_id || 'CNB';
          
          return (
            <div
              key={train.train_id}
              className={`bg-surface-2 border rounded-sm transition-all duration-150 relative cursor-pointer ${
                isSelected 
                  ? 'border-action-blue bg-action-blue-muted' 
                  : 'border-border hover:bg-surface-3'
              }`}
              onClick={() => {
                if (isSelected) {
                  setSelectedTrainId(null);
                } else {
                  setSelectedTrainId(train.train_id);
                  // Clear conflict highlight to avoid interference
                  setSelectedConflict(null);
                }
              }}
            >
              {/* Card Summary Layout */}
              <div className="p-3.5">
                {/* Row 1: Status Dot + Train Id/Name + Status Label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${aspect.dot}`} />
                    <span className="style-data-md text-text-primary shrink-0">{train.train_id}</span>
                    <span className="style-body text-text-primary truncate font-medium ml-1">{train.name}</span>
                  </div>
                  <span className={`style-label font-bold ${aspect.color} shrink-0`}>
                    {aspect.label}
                  </span>
                </div>

                {/* Row 2: Route display */}
                <div className="flex items-center gap-1 mt-1 text-text-secondary style-body">
                  <span>{getStationName(originCode)}</span>
                  <span className="style-data-sm text-text-tertiary">({originCode})</span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-tertiary shrink-0 mx-0.5" />
                  <span>{getStationName(destCode)}</span>
                  <span className="style-data-sm text-text-tertiary">({destCode})</span>
                </div>

                {/* Row 3: Speed & Delay */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
                  <div className="style-data-sm text-text-secondary">
                    Speed: <span className="style-data-md text-text-primary">{Math.round(train.speed_kmph)}</span> km/h
                  </div>
                  <div className="style-data-sm text-text-secondary">
                    Delay: <span className={`style-data-md ${aspect.color}`}>{aspect.label}</span>
                  </div>
                </div>
              </div>

              {/* Card Expanded Detail Stops View */}
              {isSelected && stops.length > 0 && (
                <div 
                  className="px-3 pb-3.5 pt-1 border-t border-border/50 bg-[#0A0A0C]/30 text-xs font-mono"
                  onClick={e => e.stopPropagation()} // prevent collapsing card
                >
                  <div className="style-label text-text-tertiary border-b border-border pb-1 mb-2 tracking-widest uppercase">
                    Timetable & Schedule
                  </div>
                  
                  {/* Stops list */}
                  <div className="relative border-l border-border ml-1.5 pl-3.5 space-y-2 mt-1 py-1">
                    {stops.map((stop, idx) => {
                      const isCurrentStop = train.last_station === stop.station_id || train.next_station === stop.station_id;
                      
                      // Calculate projected arrival/departure
                      const delayVal = train.delay_minutes || 0;
                      const offsetTime = (timeStr, delayMins) => {
                        if (!timeStr) return '';
                        const [h, m] = timeStr.split(':').map(Number);
                        const totalMins = h * 60 + m + delayMins;
                        const newH = Math.floor(totalMins / 60) % 24;
                        const newM = Math.floor(totalMins % 60);
                        return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
                      };

                      const schedArr = stop.scheduled_arrival || 'Origin';
                      const schedDep = stop.scheduled_departure || 'Terminus';
                      const projArr = stop.scheduled_arrival ? offsetTime(stop.scheduled_arrival, delayVal) : '';
                      const projDep = stop.scheduled_departure ? offsetTime(stop.scheduled_departure, delayVal) : '';

                      return (
                        <div 
                          key={idx} 
                          className={`relative leading-tight ${isCurrentStop ? 'text-action-blue font-semibold' : 'text-text-secondary'}`}
                        >
                          {/* Dot indicator */}
                          <div className={`absolute -left-[20.5px] top-1 h-2 w-2 rounded-full border ${
                            isCurrentStop 
                              ? 'bg-action-blue border-action-blue' 
                              : 'bg-canvas border-border'
                          }`} />

                          {/* Stop Info */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-sans text-text-primary font-medium">{getStationName(stop.station_id)} ({stop.station_id})</span>
                          </div>

                          <div className="grid grid-cols-2 text-[10px] text-text-tertiary mt-0.5">
                            <div>
                              Arr: <span className="style-data-sm text-text-secondary">{schedArr}</span>
                              {projArr && projArr !== schedArr && (
                                <span className={`ml-1 style-data-sm ${aspect.color}`}>({projArr})</span>
                              )}
                            </div>
                            <div>
                              Dep: <span className="style-data-sm text-text-secondary">{schedDep}</span>
                              {projDep && projDep !== schedDep && (
                                <span className={`ml-1 style-data-sm ${aspect.color}`}>({projDep})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Locate link */}
                  <div className="mt-3.5 pt-2 border-t border-border/50 flex items-center justify-between">
                    <button
                      onClick={() => {
                        // The select state highlights on maps. We trigger center in maps if needed.
                        // We also set the selected train state.
                        setSelectedTrainId(train.train_id);
                        // Trigger custom highlight event or allow maps to fly to position
                      }}
                      className="style-label text-action-blue hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Locate className="h-3 w-3" />
                      <span>Locate Train</span>
                    </button>
                    {train.is_held && (
                      <span className="px-1.5 py-0.5 bg-signal-yellow/10 border border-signal-yellow/20 text-signal-yellow font-mono text-[9px] font-bold">
                        HELD BY PLANNER
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredTrains.length === 0 && (
          <div className="text-center py-12 text-xs text-text-tertiary italic font-mono">
            No active trains found.
          </div>
        )}
      </div>

      {/* Footer view all button */}
      <div className="p-3 border-t border-border bg-surface-1 shrink-0">
        <button
          onClick={() => resetFilters()}
          className="w-full bg-surface-2 hover:bg-surface-3 border border-border text-text-secondary hover:text-text-primary py-2 rounded-sm style-label text-center transition-colors cursor-pointer"
        >
          View All Trains
        </button>
      </div>
    </aside>
  );
}
