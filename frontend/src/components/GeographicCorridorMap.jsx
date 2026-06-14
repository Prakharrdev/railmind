import { useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Navigation, MapPin, Maximize2, Crosshair } from 'lucide-react';

// Realistic multi-point geographic path tracking the actual curves of the Indian Railways route
const SECTION_GEOMETRIES = {
  "NDLS_GZB": [
    [28.6435, 77.2227], // NDLS
    [28.6502, 77.3127], // Anand Vihar
    [28.6633, 77.3611], // Sahibabad
    [28.6505, 77.4318]  // GZB
  ],
  "GZB_ALJN": [
    [28.6505, 77.4318], // GZB
    [28.5639, 77.5539], // Dadri
    [28.2339, 77.8575], // Khurja
    [28.0244, 77.9622], // Somna
    [27.8888, 78.0747]  // ALJN
  ],
  "ALJN_HRS": [
    [27.8888, 78.0747], // ALJN
    [27.7083, 78.0825], // Sasni
    [27.6246, 78.1373]  // HRS
  ],
  "HRS_TDL": [
    [27.6246, 78.1373], // HRS
    [27.4255, 78.1888], // Jalesar Road
    [27.2081, 78.233]   // TDL
  ],
  "TDL_FZD": [
    [27.2081, 78.233],  // TDL
    [27.1479, 78.3864]  // FZD
  ],
  "FZD_SKB": [
    [27.1479, 78.3864], // FZD
    [27.0863, 78.5754]  // SKB
  ],
  "SKB_ETW": [
    [27.0863, 78.5754], // SKB
    [26.8845, 78.8950], // Jaswantnagar
    [26.7855, 79.022]   // ETW
  ],
  "ETW_PHD": [
    [26.7855, 79.022],  // ETW
    [26.7570, 79.1678], // Bharthana
    [26.7150, 79.3780], // Achhalda
    [26.6324, 79.5545]  // PHD
  ],
  "PHD_CNB": [
    [26.6324, 79.5545], // PHD
    [26.5620, 79.7990], // Jhinjhak
    [26.4912, 79.9022], // Rura
    [26.4750, 80.2220], // Panki
    [26.4539, 80.3512]  // CNB
  ]
};

// Helper function to interpolate position along a multi-segment path based on progress [0-1]
const getInterpolatedPosition = (path, progress) => {
  if (!path || path.length === 0) return null;
  if (path.length === 1) return path[0];
  if (progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];

  // Calculate segment distances
  const distances = [];
  let totalDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i+1][0] - path[i][0], path[i+1][1] - path[i][1]);
    distances.push(d);
    totalDist += d;
  }

  const targetDist = progress * totalDist;
  let accumulatedDist = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const d = distances[i];
    if (accumulatedDist + d >= targetDist) {
      const segProgress = (targetDist - accumulatedDist) / d;
      const lat = path[i][0] + (path[i+1][0] - path[i][0]) * segProgress;
      const lon = path[i][1] + (path[i+1][1] - path[i][1]) * segProgress;
      return [lat, lon];
    }
    accumulatedDist += d;
  }
  return path[path.length - 1];
};

export default function GeographicCorridorMap() {
  const { network, trains = [], selectedTrainId, setSelectedTrainId, selectedConflict } = useSimulatorState();
  const mapRef = useRef(null);
  const lastFlownTrainIdRef = useRef(null);
  const trainIconsCacheRef = useRef({});

  const stations = useMemo(() => network?.stations || [], [network?.stations]);
  const sections = useMemo(() => network?.sections || [], [network?.sections]);

  // Operational control room status colors
  const getSeverityColor = (delay) => {
    if (delay <= 0.1) return '#22C55E'; // Green
    if (delay <= 15) return '#F59E0B';  // Amber
    if (delay <= 30) return '#F97316';  // Orange
    return '#EF4444';                   // Red
  };

  // Compute active conflict section prefix once to optimize section rendering
  const conflictedSectionId = useMemo(() => {
    if (!selectedConflict) return null;
    return selectedConflict.block_id.split('_').slice(0, 2).join('_');
  }, [selectedConflict]);

  // Calculate dynamic train position using realistic curved path geometry
  const getTrainPosition = useCallback((train) => {
    if (!train.section_id) {
      const station = stations.find(s => s.id === train.last_station);
      return station ? [station.lat, station.lon] : null;
    }
    const path = SECTION_GEOMETRIES[train.section_id];
    if (path) {
      return getInterpolatedPosition(path, train.progress || 0);
    }
    
    // Fallback to straight-line interpolation if geometry not configured
    const section = sections.find(s => s.id === train.section_id);
    if (!section) return null;
    const fromStation = stations.find(s => s.id === section.from);
    const toStation = stations.find(s => s.id === section.to);
    if (!fromStation || !toStation) return null;

    const lat = fromStation.lat + (toStation.lat - fromStation.lat) * (train.progress || 0);
    const lon = fromStation.lon + (toStation.lon - fromStation.lon) * (train.progress || 0);
    return [lat, lon];
  }, [stations, sections]);

  // Camera focus on selection changes (maintaining no flyTo locking rule)
  useEffect(() => {
    if (selectedTrainId && mapRef.current) {
      if (selectedTrainId !== lastFlownTrainIdRef.current) {
        const train = trains.find(t => t.train_id === selectedTrainId);
        if (train) {
          const pos = getTrainPosition(train);
          if (pos) {
            mapRef.current.flyTo(pos, 9.5, { duration: 1.2 });
            lastFlownTrainIdRef.current = selectedTrainId;
          }
        }
      }
    } else {
      lastFlownTrainIdRef.current = null;
    }
  }, [selectedTrainId, trains, getTrainPosition]);

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleFitCorridor = () => {
    if (mapRef.current && stations.length > 0) {
      const latLngs = stations.map(s => [s.lat, s.lon]);
      mapRef.current.fitBounds(latLngs, { padding: [50, 50] });
    }
  };

  const handleLocateTrain = () => {
    if (mapRef.current && selectedTrainId) {
      const train = trains.find(t => t.train_id === selectedTrainId);
      if (train) {
        const pos = getTrainPosition(train);
        if (pos) {
          mapRef.current.flyTo(pos, 9.5, { duration: 1.2 });
        }
      }
    } else if (mapRef.current && trains.length > 0) {
      const target = trains.find(t => t.delay_minutes > 0.1) || trains[0];
      if (target) {
        setSelectedTrainId(target.train_id);
        const pos = getTrainPosition(target);
        if (pos) {
          mapRef.current.flyTo(pos, 9.5, { duration: 1.2 });
        }
      }
    }
  };

  // Train HTML divIcon mapping
  const getTrainIcon = useCallback((train, isSelected) => {
    const delay = train.delay_minutes;
    const baseColor = getSeverityColor(delay);
    
    const isHighlighted = isSelected || (selectedConflict && (
      selectedConflict.train_a_id === train.train_id ||
      selectedConflict.train_b_id === train.train_id
    ));

    const color = isHighlighted ? '#FFFFFF' : baseColor;
    const delayText = delay > 0.1 ? `+${Math.round(delay)} min` : 'On Time';
    
    let cleanName = train.name || '';
    if (cleanName.includes('Express')) cleanName = cleanName.replace('Express', 'Exp');

    const trainNum = parseInt(train.train_id.replace(/\D/g, '')) || 0;
    const isUp = trainNum % 2 === 0;

    const trainSvg = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: ${color}">
        <rect x="4" y="3" width="16" height="16" rx="2"></rect>
        <path d="M4 11h16"></path>
        <path d="M12 3v8"></path>
        <path d="M8 15h8"></path>
        <path d="M18 21l-2-2"></path>
        <path d="M6 21l2-2"></path>
      </svg>
    `;

    const htmlContent = isUp ? `
      <div class="flex flex-col items-center justify-end" style="height: 110px; width: 120px; position: absolute; bottom: 16px; left: -60px;">
        <div class="px-2 py-1.5 rounded-sm border bg-[#0B0F14] shadow-md flex flex-col font-mono text-[9px] min-w-[95px] max-w-[115px] text-center select-none" style="border-color: ${color};">
          <div class="font-bold text-[#E5E7EB] text-[10px] leading-tight">${train.train_id.replace(/_/g, ' ').toUpperCase()}</div>
          <div class="text-[#9CA3AF] truncate text-[8.5px] font-sans font-medium my-0.5">${cleanName.toUpperCase()}</div>
          <div class="text-[#9CA3AF] text-[8.5px] font-medium my-0.5">${Math.round(train.speed_kmph)} KM/H</div>
          <div class="font-bold" style="color: ${baseColor}">${delayText.toUpperCase()}</div>
        </div>
        <div class="w-[1px] h-4" style="background-color: ${color};"></div>
        <div class="w-8 h-8 rounded-full border-2 bg-[#111827] flex items-center justify-center shadow-md shrink-0" style="border-color: ${color};">
          ${trainSvg}
        </div>
      </div>
    ` : `
      <div class="flex flex-col items-center justify-start" style="height: 110px; width: 120px; position: absolute; top: -16px; left: -60px;">
        <div class="w-8 h-8 rounded-full border-2 bg-[#111827] flex items-center justify-center shadow-md shrink-0" style="border-color: ${color};">
          ${trainSvg}
        </div>
        <div class="w-[1px] h-4" style="background-color: ${color};"></div>
        <div class="px-2 py-1.5 rounded-sm border bg-[#0B0F14] shadow-md flex flex-col font-mono text-[9px] min-w-[95px] max-w-[115px] text-center select-none" style="border-color: ${color};">
          <div class="font-bold text-[#E5E7EB] text-[10px] leading-tight">${train.train_id.replace(/_/g, ' ').toUpperCase()}</div>
          <div class="text-[#9CA3AF] truncate text-[8.5px] font-sans font-medium my-0.5">${cleanName.toUpperCase()}</div>
          <div class="text-[#9CA3AF] text-[8.5px] font-medium my-0.5">${Math.round(train.speed_kmph)} KM/H</div>
          <div class="font-bold" style="color: ${baseColor}">${delayText.toUpperCase()}</div>
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-leaflet-train-icon',
      html: htmlContent,
      iconSize: [120, 110],
      iconAnchor: [60, isUp ? 94 : 16]
    });
  }, [selectedConflict]);

  // Retrieve or create train icon from memory cache to stop marker rebuilding lag
  const getCachedTrainIcon = useCallback((train, isSelected) => {
    const isHighlighted = isSelected || (selectedConflict && (
      selectedConflict.train_a_id === train.train_id ||
      selectedConflict.train_b_id === train.train_id
    ));
    const cacheKey = `${train.train_id}_${Math.round(train.speed_kmph)}_${Math.round(train.delay_minutes)}_${isHighlighted ? 'active' : 'idle'}`;
    if (!trainIconsCacheRef.current[cacheKey]) {
      trainIconsCacheRef.current[cacheKey] = getTrainIcon(train, isSelected);
    }
    return trainIconsCacheRef.current[cacheKey];
  }, [getTrainIcon, selectedConflict]);

  // Static Station icons builder
  const getStationIcon = useCallback((st) => {
    const isTerminus = st.id === 'NDLS' || st.id === 'CNB';
    const isJunction = st.is_junction;
    
    let htmlContent = '';
    if (isTerminus) {
      htmlContent = `
        <div class="flex flex-col items-center justify-end" style="height: 80px; width: 120px; position: relative;">
          <div class="flex flex-col items-center mb-1.5 pointer-events-none">
            <span class="font-sans font-bold text-[#E5E7EB] text-[10px] leading-none text-center drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,1.0)]">${st.name.toUpperCase()}</span>
            <span class="mt-0.5 px-1.5 py-0.5 bg-[#0B0F14]/90 border border-[#242B36] rounded font-mono text-[#9CA3AF] text-[7.5px] leading-none uppercase tracking-wider">${st.id.toUpperCase()}</span>
          </div>
          <div class="w-6.5 h-6.5 rounded-full bg-[#111827] border-2 border-[#1C64F2] flex items-center justify-center shadow-md" style="color: white;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="4" y="3" width="16" height="16" rx="2"></rect>
              <path d="M4 11h16"></path>
              <path d="M12 3v8"></path>
            </svg>
          </div>
        </div>
      `;
    } else {
      htmlContent = `
        <div class="flex flex-col items-center justify-end" style="height: 80px; width: 120px; position: relative;">
          <div class="flex flex-col items-center mb-1.5 pointer-events-none">
            <span class="font-sans font-bold text-[#E5E7EB] text-[9.5px] leading-none text-center drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,1.0)]">${st.name.toUpperCase()}</span>
            <span class="mt-0.5 px-1 py-0.2 bg-[#0B0F14]/85 border border-[#242B36] rounded font-mono text-[#9CA3AF] text-[7px] leading-none uppercase tracking-wider">${st.id.toUpperCase()}</span>
          </div>
          <div class="w-2.5 h-2.5 rounded-full ${isJunction ? 'bg-[#1C64F2] border border-white' : 'bg-[#E5E7EB] border border-gray-950'} shadow-sm"></div>
        </div>
      `;
    }

    return L.divIcon({
      className: 'custom-leaflet-station-icon',
      html: htmlContent,
      iconSize: [120, 80],
      iconAnchor: [60, isTerminus ? 67 : 75]
    });
  }, []);

  // Memoize station icons map as they are fully static
  const stationIconsMap = useMemo(() => {
    const icons = {};
    stations.forEach((st) => {
      icons[st.id] = getStationIcon(st);
    });
    return icons;
  }, [stations, getStationIcon]);

  return (
    <div className="flex-grow w-full h-full relative z-10 bg-[#0B0F14]">
      <MapContainer
        center={[27.5, 78.8]}
        zoom={8}
        className="h-full w-full"
        zoomControl={false}
        ref={(map) => {
          if (map) mapRef.current = map;
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Render Corridor Sections following realistic track paths */}
        {sections.map((sec) => {
          const path = SECTION_GEOMETRIES[sec.id];
          if (!path) return null;

          const sectionTrains = trains.filter(t => t.section_id === sec.id);
          const maxDelay = sectionTrains.length > 0 ? Math.max(...sectionTrains.map(t => t.delay_minutes)) : -1;
          
          const isSectionConflicted = selectedConflict && (
            selectedConflict.block_id.startsWith(sec.id) ||
            sec.id === conflictedSectionId
          );

          const strokeColor = isSectionConflicted ? '#FFFFFF' : (maxDelay >= 0 ? getSeverityColor(maxDelay) : '#242B36');
          const strokeWidth = isSectionConflicted ? (sec.tracks >= 2 ? 6.5 : 4.5) : (sec.tracks >= 2 ? 4.5 : 2.5);

          return (
            <Polyline
              key={sec.id}
              positions={path}
              pathOptions={{
                color: strokeColor,
                weight: strokeWidth,
                opacity: isSectionConflicted || maxDelay >= 0 ? 0.95 : 0.45
              }}
            />
          );
        })}

        {/* Draw Station Markers using memoized static icons */}
        {stations.map((st) => {
          const stoppedTrains = trains.filter(t => !t.section_id && t.last_station === st.id);

          return (
             <Marker 
              key={st.id} 
              position={[st.lat, st.lon]} 
              icon={stationIconsMap[st.id]}
            >
              <Tooltip direction="top" offset={[0, -5]} permanent={false}>
                <div className="font-sans text-[11px] bg-[#111827] border border-[#242B36] text-[#E5E7EB]">
                  <div className="font-semibold">{st.name.toUpperCase()} ({st.id.toUpperCase()})</div>
                  <div className="text-[#9CA3AF] mt-0.5 font-mono">Platforms: {st.platforms}</div>
                  {stoppedTrains.length > 0 && (
                    <div className="mt-1 text-[9px] bg-[#0B0F14] px-1 py-0.5 rounded border border-[#242B36] text-action-blue font-mono">
                      Stopped: {stoppedTrains.map(t => t.train_id).join(', ')}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Draw Train Markers using cached icons */}
        {trains.map((train) => {
          const pos = getTrainPosition(train);
          if (!pos) return null;

          const isSelected = selectedTrainId === train.train_id;
          const trainIcon = getCachedTrainIcon(train, isSelected);

          return (
            <Marker
              key={train.train_id}
              position={pos}
              icon={trainIcon}
              eventHandlers={{
                click: () => {
                  setSelectedTrainId(isSelected ? null : train.train_id);
                }
              }}
            >
              <Popup>
                <div className="p-2 min-w-[170px] text-xs font-mono text-[#E5E7EB] bg-[#111827] border border-[#242B36]">
                  <div className="flex items-center justify-between border-b border-[#242B36] pb-1.5 mb-1.5 font-sans">
                    <span className="font-bold">{train.name.toUpperCase()}</span>
                    <span className="bg-[#161B22] px-1.5 py-0.5 rounded text-[10px] text-[#9CA3AF]">{train.train_id}</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-[#9CA3AF]">
                    <div>Speed: <span className="text-[#E5E7EB] font-bold">{Math.round(train.speed_kmph)} km/h</span></div>
                    <div>Delay: <span className={train.delay_minutes > 0 ? 'text-[#EF4444] font-bold' : 'text-[#22C55E] font-bold'}>
                      {train.delay_minutes > 0.1 ? `+${Math.round(train.delay_minutes)} min` : 'On Time'}
                    </span></div>
                    <div>Location: <span className="text-[#E5E7EB] truncate block max-w-[150px]">
                      {train.section_id ? `Traveling on ${train.section_id}` : `Stopped at ${train.last_station}`}
                    </span></div>
                    {train.next_station && (
                      <div>Next Stop: <span className="text-action-blue">{train.next_station}</span></div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      if (mapRef.current) mapRef.current.flyTo(pos, 10, { duration: 1 });
                    }}
                    className="mt-2.5 w-full bg-[#1C64F2] hover:bg-[#1A56DB] text-white font-bold py-1 rounded text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1 font-sans"
                  >
                    <Navigation className="h-2.5 w-2.5" />
                    <span>Re-center Map</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Custom Zoom Controls */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-[#111827] border border-[#242B36] text-[#E5E7EB] hover:bg-[#161B22] font-sans font-bold rounded-sm flex items-center justify-center shadow-md cursor-pointer select-none text-base"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-[#111827] border border-[#242B36] text-[#E5E7EB] hover:bg-[#161B22] font-sans font-bold rounded-sm flex items-center justify-center shadow-md cursor-pointer select-none text-base"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Floating map action buttons */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <button
          onClick={handleFitCorridor}
          className="bg-[#111827]/90 border border-[#242B36] text-[#E5E7EB] font-sans text-xs px-3.5 py-2 rounded-sm hover:bg-[#161B22] transition-colors flex items-center gap-2 shadow-lg cursor-pointer font-bold tracking-wider text-[9px] uppercase"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Fit Corridor</span>
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-[1000]">
        <button
          onClick={handleLocateTrain}
          className="bg-[#111827]/90 border border-[#242B36] text-[#E5E7EB] font-sans text-xs px-3.5 py-2 rounded-sm hover:bg-[#161B22] transition-colors flex items-center gap-2 shadow-lg cursor-pointer font-bold tracking-wider text-[9px] uppercase"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Locate Train</span>
        </button>
      </div>
    </div>
  );
}
