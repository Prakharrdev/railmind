import { useState, useEffect } from 'react';
import { SimulationProvider } from './context/SimulationContext';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import CorridorMap from './components/CorridorMap';
import ConflictTimeline from './components/ConflictTimeline';
import ConsoleTabs from './components/ConsoleTabs';
import FooterBar from './components/FooterBar';
import { useSimulatorState } from './hooks/useSimulatorState';
import { Map, Train, AlertTriangle, Menu, X } from 'lucide-react';

function DashboardContent() {
  const { conflicts = [] } = useSimulatorState();
  const [width, setWidth] = useState(window.innerWidth);
  const [activeMobileTab, setActiveMobileTab] = useState('map'); // 'map', 'trains', 'advisories'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  // Responsive resize monitor
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Motion policy monitor
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const leftWidthClass = width < 1440 ? 'w-[280px]' : 'w-[320px]';
  const rightWidthClass = width < 1440 ? 'w-[340px]' : 'w-[380px]';

  return (
    <div className="flex flex-col h-screen w-screen bg-canvas overflow-hidden text-text-primary">
      {/* Top Navigation Bar */}
      <TopBar />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
        
        {/* MOBILE MODE */}
        {isMobile && (
          <div className="flex flex-col flex-1 h-full overflow-hidden">
            {/* Viewport content */}
            <div className="flex-1 overflow-hidden relative">
              {activeMobileTab === 'map' && <CorridorMap />}
              {activeMobileTab === 'trains' && <Sidebar />}
              {activeMobileTab === 'advisories' && <ConsoleTabs />}
            </div>

            {/* Bottom Nav Tab Bar */}
            <div className="h-12 bg-surface-1 border-t border-border flex items-center justify-around shrink-0 style-label text-text-secondary z-30">
              <button
                onClick={() => setActiveMobileTab('map')}
                className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
                  activeMobileTab === 'map' ? 'text-action-blue' : 'hover:text-text-primary'
                }`}
              >
                <Map className="h-4 w-4" />
                <span className="text-[9px] mt-0.5 font-bold">Map</span>
              </button>
              <button
                onClick={() => setActiveMobileTab('trains')}
                className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
                  activeMobileTab === 'trains' ? 'text-action-blue' : 'hover:text-text-primary'
                }`}
              >
                <Train className="h-4 w-4" />
                <span className="text-[9px] mt-0.5 font-bold">Trains</span>
              </button>
              <button
                onClick={() => setActiveMobileTab('advisories')}
                className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors relative ${
                  activeMobileTab === 'advisories' ? 'text-action-blue' : 'hover:text-text-primary'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="text-[9px] mt-0.5 font-bold">Advisories</span>
                {conflicts.length > 0 && (
                  <span className="absolute top-1 right-8 bg-signal-red text-white text-[8px] px-1 rounded-full font-bold">
                    {conflicts.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TABLET MODE */}
        {isTablet && (
          <div className="flex flex-1 h-full overflow-hidden relative">
            {/* Left Panel: Narrow roster */}
            <div className="w-[240px] shrink-0 h-full overflow-hidden">
              <Sidebar />
            </div>

            {/* Center Panel */}
            <main className="flex-1 flex flex-col h-full overflow-hidden border-r border-border relative">
              {/* Floating drawer trigger */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="absolute top-14 right-4 bg-action-blue text-white px-3 py-1.5 rounded-sm style-label flex items-center gap-1.5 shadow-lg z-20 hover:opacity-90 cursor-pointer"
              >
                <Menu className="h-3.5 w-3.5" />
                <span>Intel Console</span>
                {conflicts.length > 0 && (
                  <span className="bg-signal-red text-white text-[8px] px-1.5 rounded-full font-bold">
                    {conflicts.length}
                  </span>
                )}
              </button>

              {/* Upper Pane: Corridor Map */}
              <div className="flex-[55] flex flex-col overflow-hidden border-b border-border">
                <CorridorMap />
              </div>
              {/* Lower Pane: Timeline */}
              <div className="flex-[45] flex flex-col overflow-hidden">
                <ConflictTimeline />
              </div>
            </main>

            {/* Drawer backdrop scrim */}
            {isDrawerOpen && (
              <div 
                onClick={() => setIsDrawerOpen(false)}
                className="absolute inset-0 bg-scrim backdrop-blur-sm z-30 transition-opacity"
              />
            )}

            {/* Slide-over Drawer Panel */}
            <div 
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '320px',
                zIndex: 40,
                transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: reducedMotion ? 'none' : 'transform 200ms ease-in-out',
                boxShadow: '-4px 0 16px rgba(0,0,0,0.5)'
              }}
              className="bg-surface-1 border-l border-border flex flex-col h-full overflow-hidden"
            >
              <div className="h-10 bg-surface-2 px-3 border-b border-border flex items-center justify-between shrink-0">
                <span className="style-label text-text-secondary font-bold">Intelligence Console</span>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-text-tertiary hover:text-text-primary hover:bg-surface-3 rounded cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-grow overflow-hidden">
                <ConsoleTabs />
              </div>
            </div>
          </div>
        )}

        {/* DESKTOP MODE */}
        {isDesktop && (
          <>
            {/* Left Panel: Active Fleet Train Roster */}
            <div className={`${leftWidthClass} shrink-0 h-full overflow-hidden`}>
              <Sidebar />
            </div>

            {/* Center Panel: Corridor & Timeline */}
            <main className="flex-1 min-w-[600px] flex flex-col h-full overflow-hidden border-r border-border">
              {/* Upper Pane: Corridor Map Diagram (55% height) */}
              <div className="flex-[55] flex flex-col overflow-hidden border-b border-border">
                <CorridorMap />
              </div>
              {/* Lower Pane: Conflict Occupancy Gantt & List (45% height) */}
              <div className="flex-[45] flex flex-col overflow-hidden">
                <ConflictTimeline />
              </div>
            </main>

            {/* Right Panel: Intelligence tab panel */}
            <div className={`${rightWidthClass} bg-surface-1 flex flex-col h-full overflow-hidden border-l border-border shrink-0`}>
              <ConsoleTabs />
            </div>
          </>
        )}

      </div>

      {/* Footer Status Bar */}
      <FooterBar />
    </div>
  );
}

function App() {
  return (
    <SimulationProvider>
      <DashboardContent />
    </SimulationProvider>
  );
}

export default App;

