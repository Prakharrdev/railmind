import { useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Navigation, MapPin } from 'lucide-react';

export default function GeographicCorridorMap() {
  const { network, trains = [], selectedTrainId, setSelectedTrainId } = useSimulatorState();
  const mapRef = useRef(null);
  const lastFlownTrainIdRef = useRef(null);

  const stations = useMemo(() => network?.stations || [], [network?.stations]);
  const sections = useMemo(() => network?.sections || [], [network?.sections]);

  // Severity aspect mappings
  const getSeverityColor = (delay) => {
    if (delay <= 0.1) return '#2FB350';
    if (delay <= 15) return '#E8B339';
    if (delay <= 30) return '#E8772E';
    return '#E14B4B';
  };

  const getTrainPosition = useCallback((train) => {
    if (!train.section_id) {
      const station = stations.find(s => s.id === train.last_station);
      return station ? [station.lat, station.lon] : null;
    }
    const section = sections.find(s => s.id === train.section_id);
    if (!section) return null;
    const fromStation = stations.find(s => s.id === section.from);
    const toStation = stations.find(s => s.id === section.to);
    if (!fromStation || !toStation) return null;

    // Linear interpolation
    const lat = fromStation.lat + (toStation.lat - fromStation.lat) * (train.progress || 0);
    const lon = fromStation.lon + (toStation.lon - fromStation.lon) * (train.progress || 0);
    return [lat, lon];
  }, [stations, sections]);

  // Flying/pan effect to select train
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

  // Train SVG custom divIcon mapping
  const getTrainIcon = (trainClass, delay, isSelected) => {
    const color = getSeverityColor(delay);
    let shapeHtml;

    switch (trainClass) {
      case 'rajdhani_vande_bharat':
      case 'shatabdi':
        shapeHtml = `<polygon points="0,2 10,10 0,18" fill="${color}" stroke="#0A0A0C" stroke-width="1.5" transform="scale(1.2)" />`;
        break;
      case 'premium_mail_express':
      case 'superfast':
      case 'ordinary_express':
        shapeHtml = `<rect x="2" y="2" width="16" height="16" fill="${color}" stroke="#0A0A0C" stroke-width="1.5" />`;
        break;
      case 'freight':
        shapeHtml = `<rect x="0" y="4" width="22" height="12" fill="${color}" stroke="#0A0A0C" stroke-width="1.5" />`;
        break;
      default:
        shapeHtml = `<circle cx="10" cy="10" r="8" fill="${color}" stroke="#0A0A0C" stroke-width="1.5" />`;
    }

    return L.divIcon({
      className: 'custom-leaflet-train-icon',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          ${isSelected ? `<div class="absolute h-9 w-9 rounded-full border-2 border-action-blue bg-action-blue/20 animate-ping"></div>` : ''}
          <svg width="24" height="24" viewBox="0 0 24 24" class="transition-all duration-300">
            ${shapeHtml}
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  // Station Icons
  const getStationIcon = (isJunction) => {
    return L.divIcon({
      className: 'custom-leaflet-station-icon',
      html: `
        <div class="flex items-center justify-center relative">
          ${isJunction 
            ? `<div class="h-3 w-3 bg-surface-3 border border-border rotate-45"></div>`
            : `<div class="h-2.5 w-2.5 rounded-full bg-surface-3 border border-border"></div>`
          }
        </div>
      `,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  };

  return (
    <div className="flex-grow w-full h-full relative z-10">
      <MapContainer
        center={[27.5, 78.8]}
        zoom={8}
        className="h-full w-full"
        zoomControl={true}
        ref={(map) => {
          if (map) mapRef.current = map;
        }}
      >
        {/* CartoDB Dark Matter basemap */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Draw Corridor Sections */}
        {sections.map((sec) => {
          const fromStation = stations.find(s => s.id === sec.from);
          const toStation = stations.find(s => s.id === sec.to);
          if (fromStation && toStation) {
            // Find trains on this section
            const sectionTrains = trains.filter(t => t.section_id === sec.id);
            const maxDelay = sectionTrains.length > 0 ? Math.max(...sectionTrains.map(t => t.delay_minutes)) : -1;
            const strokeColor = maxDelay >= 0 ? getSeverityColor(maxDelay) : '#2A2D34'; // default border grey

            return (
              <Polyline
                key={sec.id}
                positions={[
                  [fromStation.lat, fromStation.lon],
                  [toStation.lat, toStation.lon]
                ]}
                pathOptions={{
                  color: strokeColor,
                  weight: sec.tracks >= 2 ? 4.5 : 2.5,
                  opacity: 0.85
                }}
              />
            );
          }
          return null;
        })}

        {/* Draw Station Markers */}
        {stations.map((st) => {
          const isJunc = st.is_junction;
          const stoppedTrains = trains.filter(t => !t.section_id && t.last_station === st.id);

          return (
            <Marker 
              key={st.id} 
              position={[st.lat, st.lon]} 
              icon={getStationIcon(isJunc)}
            >
              <Tooltip direction="top" offset={[0, -5]} permanent={false}>
                <div className="font-sans text-[11px]">
                  <div className="font-semibold text-text-primary">{st.name} ({st.id})</div>
                  <div className="text-text-tertiary mt-0.5 font-mono">Platforms: {st.platforms}</div>
                  {stoppedTrains.length > 0 && (
                    <div className="mt-1 text-[9px] bg-canvas px-1 py-0.5 rounded border border-border text-action-blue font-mono">
                      Stopped: {stoppedTrains.map(t => t.train_id).join(', ')}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Draw Train Markers */}
        {trains.map((train) => {
          const pos = getTrainPosition(train);
          if (!pos) return null;

          const isSelected = selectedTrainId === train.train_id;
          const trainIcon = getTrainIcon(train.train_class, train.delay_minutes, isSelected);

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
                <div className="p-2 min-w-[170px] text-xs font-mono text-text-primary">
                  <div className="flex items-center justify-between border-b border-border pb-1.5 mb-1.5 font-sans">
                    <span className="font-bold text-text-primary">{train.name}</span>
                    <span className="bg-surface-3 px-1.5 py-0.5 rounded text-[10px] text-text-secondary">{train.train_id}</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-text-secondary">
                    <div>Speed: <span className="text-text-primary font-bold">{Math.round(train.speed_kmph)} km/h</span></div>
                    <div>Delay: <span className={train.delay_minutes > 0 ? 'text-signal-red font-bold animate-pulse' : 'text-signal-green font-bold'}>
                      {train.delay_minutes > 0.1 ? `+${Math.round(train.delay_minutes)} min` : 'On Time'}
                    </span></div>
                    <div>Location: <span className="text-text-primary truncate block max-w-[150px]">
                      {train.section_id ? `Traveling on ${train.section_id}` : `Stopped at ${train.last_station}`}
                    </span></div>
                    {train.next_station && (
                      <div>Next Stop: <span className="text-action-blue">{train.next_station}</span></div>
                    )}
                    {train.is_held && (
                      <div className="text-signal-yellow font-bold mt-1.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>HELD BY PLATFORM DISPATCH</span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      if (mapRef.current) mapRef.current.flyTo(pos, 10, { duration: 1 });
                    }}
                    className="mt-2.5 w-full bg-action-blue hover:opacity-95 text-white font-bold py-1 rounded text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1 font-sans"
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
    </div>
  );
}
