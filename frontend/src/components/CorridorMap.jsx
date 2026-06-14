import { useState, useEffect } from 'react';
import { Compass, Map } from 'lucide-react';
import SchematicCorridorDiagram from './SchematicCorridorDiagram';
import GeographicCorridorMap from './GeographicCorridorMap';

export default function CorridorMap() {
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('railmind_corridor_view') || 'schematic';
  });

  useEffect(() => {
    localStorage.setItem('railmind_corridor_view', viewMode);
  }, [viewMode]);

  return (
    <div className="flex-grow flex flex-col h-full bg-surface-1 select-none">
      {/* Corridor Panel Header */}
      <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 bg-surface-1">
        {/* Left Title */}
        <div className="flex items-center gap-2.5">
          <h2 className="style-panel-title text-text-secondary leading-none">
            CORRIDOR MAP – DELHI TO KANPUR
          </h2>
        </div>

        {/* Right Info: View Toggle & Legend */}
        <div className="flex items-center gap-6">
          {/* Swatches Legend */}
          <div className="hidden xl:flex items-center gap-4 text-text-secondary style-label">
            <span className="flex items-center gap-1.5 normal-case font-medium text-[10px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#22C55E' }} /> On Time
            </span>
            <span className="flex items-center gap-1.5 normal-case font-medium text-[10px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} /> Minor Delay
            </span>
            <span className="flex items-center gap-1.5 normal-case font-medium text-[10px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#F97316' }} /> Major Delay
            </span>
            <span className="flex items-center gap-1.5 normal-case font-medium text-[10px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }} /> Critical Delay
            </span>
          </div>

          {/* View Mode Toggle Pill */}
          <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded border border-border">
            <button
              onClick={() => setViewMode('schematic')}
              className={`px-3 py-1 rounded-sm text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'schematic'
                  ? 'bg-action-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Compass className="h-3 w-3" />
              Schematic
            </button>
            <button
              onClick={() => setViewMode('geographic')}
              className={`px-3 py-1 rounded-sm text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'geographic'
                  ? 'bg-action-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Map className="h-3 w-3" />
              Map View
            </button>
          </div>
        </div>
      </div>

      {/* Visual Render Pane */}
      <div className="flex-1 w-full relative overflow-hidden bg-canvas">
        {viewMode === 'schematic' ? (
          <SchematicCorridorDiagram />
        ) : (
          <GeographicCorridorMap />
        )}
      </div>
    </div>
  );
}
