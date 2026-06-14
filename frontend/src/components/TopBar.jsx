import { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { 
  TrainFront, CheckCircle2, Clock, AlertTriangle, Zap, X, Play, RotateCcw 
} from 'lucide-react';

export default function TopBar() {
  const { 
    trains = [], 
    conflicts = [], 
    simTime = 840, 
    wsStatus, 
    injectDisruption,
    restartSimulation 
  } = useSimulatorState();

  const [showDisruptModal, setShowDisruptModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [disruptForm, setDisruptForm] = useState(() => ({
    disruption_id: 'disrupt_' + Math.floor(Math.random() * 1000),
    train_id: '',
    disruption_type: 'engine_slow',
    magnitude_minutes: 30,
    start_time: 845,
    end_time: 875,
    target_id: ''
  }));

  const handleDisruptSubmit = async (e) => {
    e.preventDefault();
    try {
      await injectDisruption({
        ...disruptForm,
        magnitude_minutes: parseFloat(disruptForm.magnitude_minutes),
        start_time: parseFloat(disruptForm.start_time),
        end_time: parseFloat(disruptForm.end_time),
        target_id: disruptForm.target_id || null
      });
      setShowDisruptModal(false);
      setDisruptForm({
        disruption_id: 'disrupt_' + Math.floor(Math.random() * 1000),
        train_id: '',
        disruption_type: 'engine_slow',
        magnitude_minutes: 30,
        start_time: 845,
        end_time: 875,
        target_id: ''
      });
    } catch (err) {
      alert('Failed to inject disruption: ' + err.message);
    }
  };

  // Calculations for StatPills
  const totalTrains = trains.length;
  const onTimeCount = trains.filter(t => t.delay_minutes <= 0.1).length;
  const delayedCount = totalTrains - onTimeCount;
  const activeConflicts = conflicts.length;
  const avgDelay = totalTrains > 0 
    ? trains.reduce((sum, t) => sum + t.delay_minutes, 0) / totalTrains 
    : 0;

  // Format simTime (in minutes) to HH:MM:SS
  const formatTime = (minutes) => {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stat pill component
  const StatPill = ({ label, value, icon: Icon, color, suffix, isLast }) => (
    <div className={`flex items-center gap-3 px-4 py-1 ${!isLast ? 'border-r border-border' : ''}`}>
      <div className="flex flex-col justify-between">
        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider font-sans">{label}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className={`text-base font-bold leading-none font-mono ${color === 'text-signal-green' ? 'text-text-primary' : color}`}>
            {value}
            {suffix && <span className="text-[10px] font-normal font-sans text-text-secondary ml-1">{suffix}</span>}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <header className="h-16 bg-surface-1 border-b border-border px-4 flex items-center justify-between select-none shrink-0 z-40">
      {/* Logo & Tagline */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-action-blue/10 border border-action-blue/20 flex items-center justify-center">
          <TrainFront className="h-5 w-5 text-action-blue" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="font-bold text-lg leading-tight text-text-primary">RailMind</span>
          <span className="text-[10px] text-text-tertiary leading-none font-medium">
            Intelligent Train Conflict Resolution
          </span>
        </div>
      </div>

      {/* Stat Pills — now with dividers between them */}
      <div className="hidden lg:flex items-center bg-[#0b0e14]/40 border border-border rounded-sm">
        <StatPill label="Active Trains" value={totalTrains} icon={TrainFront} color="text-signal-green" />
        <StatPill label="On Time" value={onTimeCount} icon={CheckCircle2} color="text-signal-green" />
        <StatPill label="Delayed Trains" value={delayedCount} icon={Clock} color="text-signal-orange" />
        <StatPill label="Active Conflicts" value={activeConflicts} icon={AlertTriangle} color="text-signal-red" />
        <StatPill label="Avg Delay" value={avgDelay.toFixed(1)} icon={Clock} color="text-signal-orange" suffix="min" isLast />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">
        {/* Connection Status */}
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-wider font-sans">System Status</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`h-2 w-2 rounded-full ${wsStatus === 'Connected' ? 'bg-signal-green' : 'bg-signal-red'} pulse-indicator`} />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${wsStatus === 'Connected' ? 'text-signal-green' : 'text-signal-red'}`}>
              {wsStatus === 'Connected' ? 'OPERATIONAL' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Clock */}
        <div className="flex flex-col items-end leading-tight font-mono">
          <span className="text-sm font-bold text-text-primary leading-none">{formatTime(simTime)}</span>
          <span className="text-[9px] text-text-tertiary mt-1 font-sans font-medium uppercase tracking-wider">21 May 2026</span>
        </div>

        {/* Action Buttons */}
        <button
          onClick={async () => {
            setIsRestarting(true);
            try {
              await restartSimulation();
            } catch (err) {
              alert('Failed to restart: ' + err.message);
            } finally {
              setIsRestarting(false);
            }
          }}
          disabled={isRestarting}
          className="flex items-center gap-1.5 border border-border hover:bg-surface-3 text-text-secondary hover:text-text-primary px-3 py-2 rounded-sm text-xs font-bold transition-all cursor-pointer tracking-wider uppercase font-sans disabled:opacity-50"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
          <span>{isRestarting ? 'Restarting…' : 'Restart'}</span>
        </button>

        <button
          onClick={() => setShowDisruptModal(true)}
          className="flex items-center gap-1.5 bg-action-blue hover:bg-[#1A56DB] text-white px-4 py-2 rounded-sm text-xs font-bold transition-all cursor-pointer shadow-md tracking-wider uppercase font-sans"
        >
          <Zap className="h-3.5 w-3.5 fill-white/10" />
          <span>Inject Disruption</span>
        </button>
      </div>

      {/* Disruption Modal */}
      {showDisruptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-sm">
          <div className="bg-surface-1 border border-border rounded w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowDisruptModal(false)}
              className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="style-card-title text-signal-red mb-4 flex items-center gap-2 font-mono">
              <AlertTriangle className="h-4.5 w-4.5" />
              <span>Simulate Infrastructure Disruption</span>
            </h3>
            
            <form onSubmit={handleDisruptSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block style-label text-text-secondary mb-1">DISRUPTION ID</label>
                <input
                  type="text"
                  required
                  value={disruptForm.disruption_id}
                  onChange={e => setDisruptForm(prev => ({ ...prev, disruption_id: e.target.value }))}
                  className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none focus:border-signal-red font-mono"
                />
              </div>

              <div>
                <label className="block style-label text-text-secondary mb-1">TARGET TRAIN</label>
                <select
                  required
                  value={disruptForm.train_id}
                  onChange={e => setDisruptForm(prev => ({ ...prev, train_id: e.target.value }))}
                  className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none focus:border-signal-red"
                >
                  <option value="">Select a train...</option>
                  {trains.map(t => (
                    <option key={t.train_id} value={t.train_id}>
                      {t.name} ({t.train_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block style-label text-text-secondary mb-1">DISRUPTION TYPE</label>
                <select
                  value={disruptForm.disruption_type}
                  onChange={e => setDisruptForm(prev => ({ ...prev, disruption_type: e.target.value }))}
                  className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none"
                >
                  <option value="engine_slow">Engine Slowdown (40% Speed)</option>
                  <option value="platform_block">Platform Blockage (Capacity Loss)</option>
                  <option value="signal_hold">Signal Failure (Block Red Aspect)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block style-label text-text-secondary mb-1">MAGNITUDE (MIN)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={disruptForm.magnitude_minutes}
                    onChange={e => setDisruptForm(prev => ({ ...prev, magnitude_minutes: e.target.value }))}
                    className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block style-label text-text-secondary mb-1">START (SIM MIN)</label>
                  <input
                    type="number"
                    required
                    min="840"
                    value={disruptForm.start_time}
                    onChange={e => setDisruptForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block style-label text-text-secondary mb-1">END (SIM MIN)</label>
                  <input
                    type="number"
                    required
                    min="840"
                    value={disruptForm.end_time}
                    onChange={e => setDisruptForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              {disruptForm.disruption_type !== 'engine_slow' && (
                <div>
                  <label className="block style-label text-text-secondary mb-1">TARGET BLOCK/STATION ID</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS or NDLS_GZB_02"
                    value={disruptForm.target_id}
                    onChange={e => setDisruptForm(prev => ({ ...prev, target_id: e.target.value }))}
                    className="w-full bg-canvas border border-border rounded p-2.5 text-text-primary focus:outline-none focus:border-signal-red font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowDisruptModal(false)}
                  className="bg-canvas hover:bg-surface-3 border border-border text-text-secondary hover:text-text-primary px-4 py-2 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-signal-red hover:opacity-90 text-white px-4 py-2 rounded transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Execute Injection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
