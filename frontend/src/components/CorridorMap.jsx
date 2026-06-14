import { useState, useEffect } from 'react';
import { Compass } from 'lucide-react';
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
      <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 bg-surface-1 bg-opacity-30">
        {/* Left Title */}
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-action-blue" />
          <h2 className="style-panel-title text-text-secondary leading-none">
            Corridor Map — Delhi to Kanpur
          </h2>
        </div>

        {/* Right Info: Severity Legend & View Toggle */}
        <div className="flex items-center gap-6">
          {/* Swatches Legend */}
          <div className="hidden xl:flex items-center gap-4 text-text-secondary style-label">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-signal-green" /> On Time
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-signal-yellow" /> Delayed 5–15m
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-signal-orange" /> High Delay 15–30m
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-signal-red" /> Severe &gt;30m
            </span>
          </div>

          {/* View Mode Toggle Pill */}
          <div className="flex bg-surface-2 p-0.5 rounded border border-border">
            <button
              onClick={() => setViewMode('schematic')}
              className={`px-3 py-1 rounded-sm text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'schematic'
                  ? 'bg-action-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Schematic
            </button>
            <button
              onClick={() => setViewMode('geographic')}
              className={`px-3 py-1 rounded-sm text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'geographic'
                  ? 'bg-action-blue text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Geographic
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
