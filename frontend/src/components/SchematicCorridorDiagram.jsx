import { useRef, useEffect, useState, useMemo } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { ZoomIn, ZoomOut, RotateCcw, Locate } from 'lucide-react';

export default function SchematicCorridorDiagram() {
  const { 
    network, 
    trains = [], 
    conflicts = [], 
    selectedTrainId, 
    setSelectedTrainId,
    setSelectedConflict
  } = useSimulatorState();

  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [showLocateDropdown, setShowLocateDropdown] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => 
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  // Monitor prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const stations = useMemo(() => network?.stations || [], [network?.stations]);
  const sections = useMemo(() => network?.sections || [], [network?.sections]);

  // 1. Calculate horizontal coordinates based on square root of traversal time
  const stationPositions = useMemo(() => {
    if (!network) return { positions: {}, totalWidth: 900 };
    const positions = {};
    let currentX = 80;
    stations.forEach((station, index) => {
      positions[station.id] = currentX;
      if (index < sections.length) {
        const section = sections[index];
        const width = Math.max(110, Math.min(260, 26 * Math.sqrt(section.typical_traversal_min || 15)));
        currentX += width;
      }
    });
    return { positions, totalWidth: currentX + 80 };
  }, [stations, sections, network]);

  const { positions, totalWidth } = stationPositions;

  // Color mappings
  const getSeverityColor = (delay) => {
    if (delay <= 0.1) return '#10B981'; // signal-green
    if (delay <= 15) return '#F59E0B';  // signal-yellow
    if (delay <= 30) return '#F97316';  // signal-orange
    return '#EF4444';                    // signal-red
  };

  const getConflictColor = (urgency) => {
    const isScale100 = urgency > 1.0;
    const lowThresh = isScale100 ? 15 : 0.33;
    const medThresh = isScale100 ? 25 : 0.66;
    if (urgency < lowThresh) return '#F59E0B'; // LOW
    if (urgency < medThresh) return '#F97316'; // MEDIUM
    return '#EF4444';                    // HIGH
  };

  // 2. Track Segment Coloring logic
  const trackColors = useMemo(() => {
    const colors = {};
    
    sections.forEach(sec => {
      const sectionTrains = trains.filter(t => t.section_id === sec.id);
      const upTrains = sectionTrains.filter(t => t.direction === 'UP');
      const downTrains = sectionTrains.filter(t => t.direction === 'DOWN');
      const secConflicts = conflicts.filter(c => c.block_id.startsWith(sec.id));

      const maxUpTrainDelay = upTrains.length > 0 ? Math.max(...upTrains.map(t => t.delay_minutes)) : -1;
      const maxDownTrainDelay = downTrains.length > 0 ? Math.max(...downTrains.map(t => t.delay_minutes)) : -1;

      let upColor = maxUpTrainDelay >= 0 ? getSeverityColor(maxUpTrainDelay) : '#2A354A';
      let downColor = maxDownTrainDelay >= 0 ? getSeverityColor(maxDownTrainDelay) : '#2A354A';

      secConflicts.forEach(c => {
        const confColor = getConflictColor(c.urgency_score);
        const affectsUp = upTrains.some(t => t.train_id === c.train_a_id || t.train_id === c.train_b_id);
        const affectsDown = downTrains.some(t => t.train_id === c.train_a_id || t.train_id === c.train_b_id);

        if (affectsUp || sec.tracks === 1) {
          if (upColor === '#2A354A' || confColor === '#EF4444' || (confColor === '#F97316' && upColor !== '#EF4444')) {
            upColor = confColor;
          }
        }
        if (affectsDown || sec.tracks === 1) {
          if (downColor === '#2A354A' || confColor === '#EF4444' || (confColor === '#F97316' && downColor !== '#EF4444')) {
            downColor = confColor;
          }
        }
      });

      colors[sec.id] = { up: upColor, down: downColor };
    });

    return colors;
  }, [sections, trains, conflicts]);

  // 3. Train coordinates lookup
  const trainCoordinates = useMemo(() => {
    const coords = {};
    trains.forEach(t => {
      if (!t.section_id) {
        const x = positions[t.last_station] || 80;
        coords[t.train_id] = { x, y: 130 };
      } else {
        const sec = sections.find(s => s.id === t.section_id);
        if (!sec) return;
        const fromX = positions[sec.from];
        const toX = positions[sec.to];
        const progress = t.progress || 0;
        
        const isUp = t.direction === 'UP';
        const startX = isUp ? fromX : toX;
        const endX = isUp ? toX : fromX;
        const x = startX + progress * (endX - startX);
        
        const isDouble = sec.tracks >= 2;
        let y = 130;
        if (isDouble) {
          y = isUp ? 125 : 135;
        }
        coords[t.train_id] = { x, y };
      }
    });
    return coords;
  }, [trains, positions, sections]);

  // Center selected train automatically
  useEffect(() => {
    if (selectedTrainId && containerRef.current && trainCoordinates[selectedTrainId]) {
      const { x } = trainCoordinates[selectedTrainId];
      const containerWidth = containerRef.current.clientWidth;
      const zoomX = x * zoom;
      containerRef.current.scrollTo({
        left: zoomX - containerWidth / 2,
        behavior: reducedMotion ? 'auto' : 'smooth'
      });
    }
  }, [selectedTrainId, trainCoordinates, zoom, reducedMotion]);

  // Zoom helpers
  const handleZoomIn = () => setZoom(z => Math.min(2.0, z + 0.2));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.2));
  const handleZoomReset = () => setZoom(1.0);

  // Get delay label
  const getDelayLabel = (delay) => {
    if (delay <= 0.1) return 'ON TIME';
    return `+${Math.round(delay)} min`;
  };

  // Shorten train name for card display
  const shortenName = (name) => {
    if (!name) return '';
    return name
      .replace('Express', 'Exp')
      .replace('Passenger', 'Pass')
      .replace(' (Up)', '')
      .replace(' (Down)', '');
  };

  if (!network) return null;

  const svgHeight = 260;
  const trackY = 130;

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden bg-canvas relative">
      {/* SVG Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative scroll-smooth"
      >
        <div 
          style={{ 
            width: `${100 * zoom}%`, 
            minWidth: `${totalWidth}px`,
            transition: reducedMotion ? 'none' : 'width 0.2s ease-out'
          }}
          className="h-full flex items-center justify-center"
        >
          <svg 
            viewBox={`0 0 ${totalWidth} ${svgHeight}`}
            className="w-full h-full select-none"
            style={{ minHeight: '220px' }}
          >
            <defs>
              {/* Glow filter for selected items */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              {/* Drop shadow for cards */}
              <filter id="cardShadow" x="-10%" y="-10%" width="130%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.5"/>
              </filter>
            </defs>

            {/* 1. Draw Section Track Lines with curved ends */}
            {sections.map(sec => {
              const fromX = positions[sec.from];
              const toX = positions[sec.to];
              const isDouble = sec.tracks >= 2;
              const color = trackColors[sec.id] || { up: '#2A354A', down: '#2A354A' };

              if (isDouble) {
                return (
                  <g key={sec.id}>
                    {/* UP track */}
                    <line 
                      x1={fromX} y1={trackY - 5} x2={toX} y2={trackY - 5} 
                      stroke={color.up} strokeWidth="3.5" strokeLinecap="round"
                    />
                    {/* DOWN track */}
                    <line 
                      x1={fromX} y1={trackY + 5} x2={toX} y2={trackY + 5} 
                      stroke={color.down} strokeWidth="3.5" strokeLinecap="round"
                    />
                  </g>
                );
              } else {
                return (
                  <line 
                    key={sec.id}
                    x1={fromX} y1={trackY} x2={toX} y2={trackY} 
                    stroke={color.up} strokeWidth="3.5" strokeLinecap="round"
                  />
                );
              }
            })}

            {/* 2. Draw Station Nodes */}
            {stations.map(st => {
              const x = positions[st.id];
              const isJunction = st.is_junction;
              const hasBigCapacity = st.platforms > 5;

              return (
                <g key={st.id} transform={`translate(${x}, ${trackY})`} className="cursor-pointer">
                  {/* Station symbol */}
                  {isJunction ? (
                    <rect 
                      x="-7" y="-7" width="14" height="14" 
                      transform="rotate(45)"
                      fill={hasBigCapacity ? '#1B2335' : '#121826'}
                      stroke="#3A4A62"
                      strokeWidth="1.5"
                    />
                  ) : (
                    <circle 
                      r="7" 
                      fill={hasBigCapacity ? '#1B2335' : '#121826'}
                      stroke="#3A4A62"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Crossing Loop */}
                  {st.has_loop && (
                    <line x1="-10" y1="14" x2="10" y2="14" stroke="#3A4A62" strokeWidth="1.5" />
                  )}

                  {/* Station name */}
                  <text y="28" textAnchor="middle" fill="#9CA3AF" fontSize="10" fontFamily="IBM Plex Sans, sans-serif" fontWeight="500">
                    {st.name}
                  </text>
                  {/* Station code */}
                  <text y="40" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="IBM Plex Mono, monospace" fontWeight="400">
                    {st.id}
                  </text>

                  <title>{st.name} ({st.id}) · Platforms: {st.platforms}</title>
                </g>
              );
            })}

            {/* 3. Draw Active Conflict Alert Badges */}
            {conflicts.map((c, index) => {
              const secId = c.block_id.split('_').slice(0, 2).join('_');
              const sec = sections.find(s => s.id === secId);
              if (!sec) return null;

              const fromX = positions[sec.from];
              const toX = positions[sec.to];
              const midX = fromX + (toX - fromX) / 2;
              const color = getConflictColor(c.urgency_score);

              return (
                <g 
                  key={index}
                  transform={`translate(${midX + (index * 8)}, ${trackY - 20})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedConflict(c)}
                >
                  <polygon 
                    points="0,-9 9,7 -9,7" 
                    fill={color} 
                    className="pulse-indicator"
                    stroke="#080B11"
                    strokeWidth="1"
                  />
                  <text y="2" textAnchor="middle" fill="#080B11" fontSize="8" fontWeight="700" fontFamily="IBM Plex Sans, sans-serif">!</text>
                  <title>Conflict: {c.train_a_id} vs {c.train_b_id} on {c.block_id}</title>
                </g>
              );
            })}

            {/* 4. Draw Train Info Cards (rich floating cards like reference) */}
            {trains.map((t, idx) => {
              const coord = trainCoordinates[t.train_id];
              if (!coord) return null;

              const isSelected = selectedTrainId === t.train_id;
              const delayColor = getSeverityColor(t.delay_minutes);
              const isOnTime = t.delay_minutes <= 0.1;
              const cardWidth = 105;
              const cardHeight = 52;
              
              // Alternate above/below track for clarity
              const isAbove = idx % 2 === 0 || t.direction === 'UP';
              const cardY = isAbove ? coord.y - cardHeight - 22 : coord.y + 22;

              return (
                <g 
                  key={t.train_id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrainId(isSelected ? null : t.train_id);
                    setSelectedConflict(null);
                  }}
                  style={{
                    transition: reducedMotion ? 'none' : 'transform 800ms linear'
                  }}
                >
                  {/* Selection ring around marker */}
                  {isSelected && (
                    <circle 
                      cx={coord.x} cy={coord.y} r="14" 
                      fill="none" stroke="#1C64F2" strokeWidth="1.5" 
                      className="pulse-indicator" opacity="0.7"
                    />
                  )}

                  {/* Train marker dot on track */}
                  <circle 
                    cx={coord.x} cy={coord.y} r="5"
                    fill={delayColor}
                    stroke="#080B11"
                    strokeWidth="2"
                  />

                  {/* Connector line from marker to card */}
                  {showLabels && (
                    <line
                      x1={coord.x} y1={isAbove ? coord.y - 8 : coord.y + 8}
                      x2={coord.x} y2={isAbove ? cardY + cardHeight : cardY}
                      stroke={delayColor}
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.5"
                    />
                  )}

                  {/* Floating info card */}
                  {showLabels && (
                    <g transform={`translate(${coord.x - cardWidth/2}, ${cardY})`} filter="url(#cardShadow)">
                      {/* Card background */}
                      <rect 
                        x="0" y="0" 
                        width={cardWidth} height={cardHeight} 
                        rx="4" ry="4"
                        fill={isSelected ? '#1B2335' : '#121826'}
                        stroke={isSelected ? '#1C64F2' : delayColor}
                        strokeWidth={isSelected ? '1.5' : '1'}
                        opacity="0.95"
                      />

                      {/* Top colored accent bar */}
                      <rect x="0" y="0" width={cardWidth} height="3" rx="4" ry="4" fill={delayColor} />
                      <rect x="0" y="1.5" width={cardWidth} height="1.5" fill={delayColor} />

                      {/* Train ID (prominent) */}
                      <text x="8" y="17" fill="#F3F4F6" fontSize="11" fontWeight="700" fontFamily="IBM Plex Mono, monospace">
                        {t.train_id.replace(/_/g, ' ').slice(0, 12)}
                      </text>

                      {/* Train name */}
                      <text x="8" y="29" fill="#9CA3AF" fontSize="8.5" fontFamily="IBM Plex Sans, sans-serif" fontWeight="500">
                        {shortenName(t.name).slice(0, 16)}
                      </text>

                      {/* Delay badge */}
                      <rect 
                        x={cardWidth - 48} y="8" 
                        width="40" height="14" 
                        rx="2" ry="2"
                        fill={isOnTime ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
                      />
                      <text 
                        x={cardWidth - 28} y="18" 
                        textAnchor="middle" 
                        fill={delayColor} 
                        fontSize="8" fontWeight="700" 
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        {getDelayLabel(t.delay_minutes)}
                      </text>

                      {/* Speed + Status bottom row */}
                      <text x="8" y="46" fill="#6B7280" fontSize="8" fontFamily="IBM Plex Sans, sans-serif">
                        {Math.round(t.speed_kmph)} km/h
                      </text>
                      <text 
                        x={cardWidth - 8} y="46" 
                        textAnchor="end" 
                        fill={delayColor} fontSize="7.5" fontWeight="700" 
                        fontFamily="IBM Plex Sans, sans-serif"
                      >
                        {isOnTime ? '● ON TIME' : '● DELAYED'}
                      </text>
                    </g>
                  )}

                  <title>
                    {t.name} ({t.train_id}){'\n'}Speed: {Math.round(t.speed_kmph)} km/h{'\n'}Delay: {t.delay_minutes} min
                  </title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* SVG Map Control Overlay Panel */}
      <div className="absolute bottom-4 right-4 bg-surface-1/90 backdrop-blur-sm border border-border p-1.5 rounded flex items-center gap-1.5 shadow-xl z-20">
        {/* Locate dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowLocateDropdown(!showLocateDropdown)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded transition-colors cursor-pointer flex items-center gap-1"
            title="Locate Train"
          >
            <span className="text-[9px] font-bold uppercase tracking-wider font-sans hidden xl:inline">Locate Train</span>
            <Locate className="h-4 w-4" />
          </button>
          
          {showLocateDropdown && (
            <div className="absolute right-0 bottom-8 mt-2 w-52 bg-surface-2 border border-border rounded shadow-2xl z-30 max-h-52 overflow-y-auto p-1 font-mono text-xs">
              <div className="style-label text-text-tertiary p-1.5 border-b border-border mb-1">Locate active train</div>
              {trains.map(t => (
                <button
                  key={t.train_id}
                  onClick={() => {
                    setSelectedTrainId(t.train_id);
                    setShowLocateDropdown(false);
                  }}
                  className="w-full text-left p-1.5 hover:bg-surface-3 text-text-primary rounded truncate flex justify-between cursor-pointer"
                >
                  <span>{t.train_id}</span>
                  <span className="text-[10px] text-text-secondary">{t.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Label Toggle */}
        <button 
          onClick={() => setShowLabels(!showLabels)}
          className={`px-2 py-1 text-[10px] font-bold font-mono rounded border transition-colors cursor-pointer ${
            showLabels 
              ? 'bg-action-blue-muted border-action-blue/30 text-action-blue' 
              : 'border-border text-text-secondary hover:text-text-primary'
          }`}
          title="Toggle labels"
        >
          LABELS
        </button>

        {/* Map View indicator */}
        <div className="flex items-center gap-1 px-2 border-l border-border">
          <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider font-sans">Map View</span>
          <Locate className="h-3.5 w-3.5 text-text-tertiary" />
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center border-l border-border pl-1.5 gap-0.5">
          <button 
            onClick={handleZoomOut} 
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button 
            onClick={handleZoomReset}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded transition-colors cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button 
            onClick={handleZoomIn} 
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
