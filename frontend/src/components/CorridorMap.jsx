import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useSimulatorState } from '../hooks/useSimulatorState';
import Loading from './Loading';
import { MapPin, Navigation, Compass } from 'lucide-react';

export default function CorridorMap() {
  const { network, trains, selectedTrainId, setSelectedTrainId } = useSimulatorState();
  const [map, setMap] = useState(null);

  // Focus/Fly to selected train
  useEffect(() => {
    if (selectedTrainId && map && network) {
      const train = trains.find(t => t.train_id === selectedTrainId);
      if (train) {
        const pos = getTrainPosition(train);
        if (pos) {
          map.flyTo(pos, 9, { duration: 1.5 });
        }
      }
    }
  }, [selectedTrainId, map, trains, network]);

  if (!network) {
    return <Loading message="Loading Network Map..." />;
  }

  const { stations = [], sections = [] } = network;

  // Find train coordinates by interpolating station positions along section progress
  const getTrainPosition = (train) => {
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
    const lat = fromStation.lat + (toStation.lat - fromStation.lat) * train.progress;
    const lon = fromStation.lon + (toStation.lon - fromStation.lon) * train.progress;
    return [lat, lon];
  };

  const getDelayColorClass = (delay) => {
    if (delay < 5) return 'bg-emerald-500 border-emerald-300';
    if (delay < 15) return 'bg-amber-500 border-amber-300';
    if (delay < 30) return 'bg-orange-500 border-orange-300';
    return 'bg-rose-500 border-rose-300';
  };

  return (
    <div className="flex-1 h-full relative border border-[#2e303a] rounded-lg overflow-hidden flex flex-col bg-[#12131a]">
      {/* Map Header */}
      <div className="bg-[#161720] px-4 py-2 border-b border-[#2e303a] flex items-center justify-between text-xs select-none">
        <span className="font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Compass className="h-4 w-4 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Live Operations Corridor</span>
        </span>
        <div className="flex gap-4 text-slate-500 font-semibold font-mono">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt;5m</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 5-15m</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> 15-30m</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> &gt;30m</span>
        </div>
      </div>

      <div className="flex-1 w-full relative z-10">
        <MapContainer
          center={[27.5, 78.8]}
          zoom={8}
          className="h-full w-full"
          zoomControl={true}
          ref={setMap}
        >
          {/* CartoDB Dark Matter tiles (highly professional, dark, minimalist) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Draw Railway Corridor Polylines */}
          {sections.map((sec) => {
            const fromStation = stations.find(s => s.id === sec.from);
            const toStation = stations.find(s => s.id === sec.to);
            if (fromStation && toStation) {
              return (
                <Polyline
                  key={sec.id}
                  positions={[
                    [fromStation.lat, fromStation.lon],
                    [toStation.lat, toStation.lon]
                  ]}
                  pathOptions={{
                    color: '#4f46e5',
                    weight: 3,
                    opacity: 0.45,
                    dashArray: '4, 6'
                  }}
                />
              );
            }
            return null;
          })}

          {/* Draw Stations */}
          {stations.map((st) => {
            // Check if any train is currently stopped at this station
            const stoppedTrains = trains.filter(t => !t.section_id && t.last_station === st.id);
            const stationIcon = L.divIcon({
              className: 'custom-station-icon',
              html: `
                <div class="flex items-center justify-center">
                  <div class="h-2.5 w-2.5 rounded-full bg-purple-500 border border-slate-900 shadow-md"></div>
                  ${stoppedTrains.length > 0 ? `<div class="absolute -top-1 -right-1 h-2 w-2 bg-emerald-400 rounded-full animate-ping"></div>` : ''}
                </div>
              `,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });

            return (
              <Marker key={st.id} position={[st.lat, st.lon]} icon={stationIcon}>
                <Tooltip direction="top" offset={[0, -5]} permanent={false}>
                  <div className="font-semibold text-slate-100">{st.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">CODE: {st.id} | Platforms: {st.platforms}</div>
                  {stoppedTrains.length > 0 && (
                    <div className="mt-1 text-[9px] bg-[#1a1c23] px-1 py-0.5 rounded border border-purple-500/20 text-purple-300">
                      Stopped: {stoppedTrains.map(t => t.train_id).join(', ')}
                    </div>
                  )}
                </Tooltip>
              </Marker>
            );
          })}

          {/* Draw Trains */}
          {trains.map((train) => {
            const pos = getTrainPosition(train);
            if (!pos) return null;

            const isSelected = selectedTrainId === train.train_id;
            const delayColorClass = getDelayColorClass(train.delay_minutes);

            const trainIcon = L.divIcon({
              className: 'custom-train-icon',
              html: `
                <div class="relative flex items-center justify-center cursor-pointer">
                  ${isSelected ? `<div class="absolute h-8 w-8 rounded-full border border-purple-400 bg-purple-400/20 animate-ping"></div>` : ''}
                  <div class="h-6 w-6 rounded-full ${delayColorClass} border-2 border-[#12131a] flex items-center justify-center shadow-lg transition-all duration-300">
                    <span class="text-[9px] font-bold text-slate-900 font-mono">${train.train_id.slice(-2)}</span>
                  </div>
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });

            return (
              <Marker
                key={train.train_id}
                position={pos}
                icon={trainIcon}
                eventHandlers={{
                  click: () => setSelectedTrainId(isSelected ? null : train.train_id)
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[160px] text-xs text-slate-200">
                    <div className="flex items-center justify-between border-b border-[#2e303a] pb-1.5 mb-1.5">
                      <span className="font-bold text-slate-100">{train.name}</span>
                      <span className="font-mono bg-[#2e303a] px-1 rounded text-[10px] text-slate-400">{train.train_id}</span>
                    </div>
                    <div className="space-y-1 font-mono text-[10px]">
                      <div>Speed: <span className="text-slate-300">{Math.round(train.speed_kmph)} km/h</span></div>
                      <div>Delay: <span className={train.delay_minutes > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                        {train.delay_minutes > 0 ? `${Math.round(train.delay_minutes)} min` : 'None'}
                      </span></div>
                      <div>Location: <span className="text-slate-300 truncate">
                        {train.section_id ? `Traveling on ${train.section_id}` : `Stopped at ${train.last_station}`}
                      </span></div>
                      {train.next_station && (
                        <div>Next Stop: <span className="text-purple-400">{train.next_station}</span></div>
                      )}
                      {train.is_held && (
                        <div className="text-amber-400 font-bold animate-pulse mt-1">HELD ON DISPATCH ADVISORY</div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
