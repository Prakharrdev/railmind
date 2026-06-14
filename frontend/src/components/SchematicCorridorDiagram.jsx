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
    if (!network) return { positions: {}, totalWidth: 500 };
    const positions = {};
    let currentX = 40;
    stations.forEach((station, index) => {
      positions[station.id] = currentX;
      if (index < sections.length) {
        const section = sections[index];
        // traversal-based compression width
        const width = Math.max(90, Math.min(240, 22 * Math.sqrt(section.typical_traversal_min || 15)));
        currentX += width;
      }
    });
    return { positions, totalWidth: currentX + 40 };
  }, [stations, sections, network]);

  const { positions, totalWidth } = stationPositions;

  // Color mappings
  const getSeverityColor = (delay) => {
    if (delay <= 0.1) return '#2FB350'; // signal-green
    if (delay <= 15) return '#E8B339';  // signal-yellow
    if (delay <= 30) return '#E8772E';  // signal-orange
    return '#E14B4B';                    // signal-red
  };

  const getConflictColor = (urgency) => {
    if (urgency < 0.33) return '#E8B339'; // LOW
    if (urgency < 0.66) return '#E8772E'; // MEDIUM
    return '#E14B4B';                    // HIGH
  };

  // 2. Track Segment Coloring logic
  const trackColors = useMemo(() => {
    const colors = {};
    
    sections.forEach(sec => {
      // Find trains on this section
      const sectionTrains = trains.filter(t => t.section_id === sec.id);
      const upTrains = sectionTrains.filter(t => t.direction === 'UP');
      const downTrains = sectionTrains.filter(t => t.direction === 'DOWN');

      // Find conflicts on this section
      const secConflicts = conflicts.filter(c => c.block_id.startsWith(sec.id));

      // Calculate base train severities
      const maxUpTrainDelay = upTrains.length > 0 ? Math.max(...upTrains.map(t => t.delay_minutes)) : -1;
      const maxDownTrainDelay = downTrains.length > 0 ? Math.max(...downTrains.map(t => t.delay_minutes)) : -1;

      let upColor = maxUpTrainDelay >= 0 ? getSeverityColor(maxUpTrainDelay) : '#3A3D47'; // border-strong
      let downColor = maxDownTrainDelay >= 0 ? getSeverityColor(maxDownTrainDelay) : '#3A3D47';

      // Overlay conflict severity if higher
      secConflicts.forEach(c => {
        const confColor = getConflictColor(c.urgency_score);
        // Find which lines the conflict affects
        const affectsUp = upTrains.some(t => t.train_id === c.train_a_id || t.train_id === c.train_b_id);
        const affectsDown = downTrains.some(t => t.train_id === c.train_a_id || t.train_id === c.train_b_id);

        if (affectsUp || sec.tracks === 1) {
          if (upColor === '#3A3D47' || confColor === '#E14B4B' || (confColor === '#E8772E' && upColor !== '#E14B4B')) {
            upColor = confColor;
          }
        }
        if (affectsDown || sec.tracks === 1) {
          if (downColor === '#3A3D47' || confColor === '#E14B4B' || (confColor === '#E8772E' && downColor !== '#E14B4B')) {
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
        // Stopped at station
        const x = positions[t.last_station] || 40;
        coords[t.train_id] = { x, y: 110 };
      } else {
        // Traveling on section
        const sec = sections.find(s => s.id === t.section_id);
        if (!sec) return;
        const fromX = positions[sec.from];
        const toX = positions[sec.to];
        const progress = t.progress || 0;
        
        // Directional interpolation
        const isUp = t.direction === 'UP';
        const startX = isUp ? fromX : toX;
        const endX = isUp ? toX : fromX;
        const x = startX + progress * (endX - startX);
        
        // Track elevation offset
        const isDouble = sec.tracks >= 2;
        let y = 110;
        if (isDouble) {
          y = isUp ? 106 : 114;
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

  // Render Train shapes based on class
  const renderTrainShape = (trainClass, delay) => {
    const color = getSeverityColor(delay);
    
    switch (trainClass) {
      case 'rajdhani_vande_bharat':
      case 'shatabdi':
        // sharp chevron/triangle
        return (
          <polygon 
            points="-8,-6 8,0 -8,6" 
            fill={color} 
            stroke="#0A0A0C" 
            strokeWidth="1.5"
          />
        );
      case 'premium_mail_express':
      case 'superfast':
      case 'ordinary_express':
        // square
        return (
          <rect 
            x="-6" 
            y="-6" 
            width="12" 
            height="12" 
            fill={color} 
            stroke="#0A0A0C" 
            strokeWidth="1.5"
          />
        );
      case 'freight':
        // long rectangle
        return (
          <rect 
            x="-10" 
            y="-5" 
            width="20" 
            height="10" 
            fill={color} 
            stroke="#0A0A0C" 
            strokeWidth="1.5"
          />
        );
      default:
        // circle
        return (
          <circle 
            r="6" 
            fill={color} 
            stroke="#0A0A0C" 
            strokeWidth="1.5"
          />
        );
    }
  };

  if (!network) return null;

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden bg-canvas relative">
      {/* SVG Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative py-4 scroll-smooth"
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
            viewBox={`0 0 ${totalWidth} 220`}
            className="w-full h-full select-none"
            style={{ minHeight: '200px' }}
          >
            {/* 1. Draw Section Track Lines */}
            {sections.map(sec => {
              const fromX = positions[sec.from];
              const toX = positions[sec.to];
              const isDouble = sec.tracks >= 2;
              const color = trackColors[sec.id] || { up: '#3A3D47', down: '#3A3D47' };

              if (isDouble) {
                return (
                  <g key={sec.id}>
                    {/* UP track (NDLS -> CNB) */}
                    <line 
                      x1={fromX} 
                      y1="106" 
                      x2={toX} 
                      y2="106" 
                      stroke={color.up} 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                    />
                    {/* DOWN track (CNB -> NDLS) */}
                    <line 
                      x1={fromX} 
                      y1="114" 
                      x2={toX} 
                      y2="114" 
                      stroke={color.down} 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                    />
                  </g>
                );
              } else {
                // Single track
                return (
                  <line 
                    key={sec.id}
                    x1={fromX} 
                    y1="110" 
                    x2={toX} 
                    y2="110" 
                    stroke={color.up} 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
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
                <g 
                  key={st.id} 
                  transform={`translate(${x}, 110)`}
                  className="cursor-pointer group"
                >
                  {/* Station symbol */}
                  {isJunction ? (
                    <rect 
                      x="-8" 
                      y="-8" 
                      width="16" 
                      height="16" 
                      transform="rotate(45)"
                      fill={hasBigCapacity ? '#25272E' : '#14151A'}
                      stroke="#3A3D47"
                      strokeWidth="1.5"
                    />
                  ) : (
                    <circle 
                      r="7" 
                      fill={hasBigCapacity ? '#25272E' : '#14151A'}
                      stroke="#3A3D47"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Crossing Loop indicators */}
                  {st.has_loop && (
                    <line 
                      x1="-10" 
                      y1="16" 
                      x2="10" 
                      y2="16" 
                      stroke="#3A3D47" 
                      strokeWidth="1.5" 
                    />
                  )}

                  {/* Station Code label */}
                  <text 
                    y="32" 
                    textAnchor="middle" 
                    className="style-data-sm fill-text-secondary"
                  >
                    {st.id}
                  </text>

                  {/* Hover tooltip station full name */}
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
                  transform={`translate(${midX + (index * 6)}, 86)`}
                  className="cursor-pointer"
                  onClick={() => setSelectedConflict(c)}
                >
                  <polygon 
                    points="0,-8 8,6 -8,6" 
                    fill={color} 
                    className="pulse-indicator"
                  />
                  <title>Conflict: {c.train_a_id} vs {c.train_b_id} on {c.block_id}</title>
                </g>
              );
            })}

            {/* 4. Draw Train Markers */}
            {trains.map(t => {
              const coord = trainCoordinates[t.train_id];
              if (!coord) return null;

              const isSelected = selectedTrainId === t.train_id;
              const rotation = t.direction === 'DOWN' ? 180 : 0;
              const isPulsing = isSelected;

              return (
                <g 
                  key={t.train_id}
                  transform={`translate(${coord.x}, ${coord.y})`}
                  style={{
                    transition: reducedMotion ? 'none' : 'transform 800ms linear'
                  }}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrainId(isSelected ? null : t.train_id);
                    setSelectedConflict(null);
                  }}
                >
                  {/* Outer selection ring */}
                  {isPulsing && (
                    <circle 
                      r="16" 
                      fill="none" 
                      stroke="#4C8DFF" 
                      strokeWidth="1.5" 
                      className="pulse-indicator opacity-60"
                    />
                  )}

                  {/* Render class shape */}
                  <g transform={`rotate(${rotation})`}>
                    {renderTrainShape(t.train_class, t.delay_minutes)}
                  </g>

                  {/* Train Identifier Label */}
                  {showLabels && (
                    <text 
                      y="-14" 
                      textAnchor="middle" 
                      className={`style-data-sm select-none transition-all ${
                        isSelected ? 'fill-action-blue font-bold font-mono' : 'fill-text-primary'
                      }`}
                    >
                      {t.train_id.slice(-5)}
                    </text>
                  )}

                  <title>
                    {t.name} ({t.train_id})\nSpeed: {Math.round(t.speed_kmph)} km/h\nDelay: {t.delay_minutes} min
                  </title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* SVG Map Control Overlay Panel */}
      <div className="absolute bottom-4 right-4 bg-surface-1/90 border border-border p-1.5 rounded flex items-center gap-1.5 shadow-xl z-20">
        {/* Locate dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowLocateDropdown(!showLocateDropdown)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded transition-colors cursor-pointer"
            title="Locate Train"
          >
            <Locate className="h-4 w-4" />
          </button>
          
          {showLocateDropdown && (
            <div className="absolute right-0 bottom-8 mt-2 w-48 bg-surface-2 border border-border rounded shadow-2xl z-30 max-h-48 overflow-y-auto p-1 font-mono text-xs">
              <div className="style-label text-text-tertiary p-1 border-b border-border mb-1">Locate active train</div>
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
