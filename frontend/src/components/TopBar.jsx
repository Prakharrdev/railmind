import { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { 
  TrainFront, CheckCircle2, Clock, AlertTriangle, CircleDot, Zap, X, Play 
} from 'lucide-react';

export default function TopBar() {
  const { 
    trains = [], 
    conflicts = [], 
    simTime = 840, 
    wsStatus, 
    injectDisruption 
  } = useSimulatorState();

  const [showDisruptModal, setShowDisruptModal] = useState(false);
  const [disruptForm, setDisruptForm] = useState(() => ({
    disruption_id: 'disrupt_' + Math.floor(Math.random() * 1000),
    train_id: '',
    disruption_type: 'engine_slow',
    magnitude_minutes: 30,
    start_time: 845,
    end_time: 875,
    target_id: ''
  }));

  const getStatusColor = () => {
    switch (wsStatus) {
      case 'Connected': return 'text-signal-green';
      case 'Connecting':
      case 'Reconnecting': return 'text-signal-yellow';
      default: return 'text-signal-red';
    }
  };

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

  return (
    <header className="h-16 bg-surface-1 border-b border-border px-4 flex items-center justify-between select-none shrink-0 z-40">
      {/* Logo & Tagline */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <TrainFront className="h-5 w-5 text-action-blue" />
          <span className="style-display text-text-primary">RailMind</span>
        </div>
        <span className="style-label text-text-tertiary leading-none mt-0.5">
          Intelligent Train Conflict Resolution
        </span>
      </div>

      {/* Stat Pills */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Active Trains */}
        <div className="bg-surface-2 border border-border rounded px-3 py-1.5 min-w-[90px]">
          <div className="style-label text-text-secondary flex items-center gap-1">
            <TrainFront className="h-3 w-3 text-text-secondary" />
            <span>Active</span>
          </div>
          <div className="style-data-lg text-text-primary leading-tight mt-0.5">{totalTrains}</div>
        </div>

        {/* On Time */}
        <div className="bg-surface-2 border border-border rounded px-3 py-1.5 min-w-[90px]">
          <div className="style-label text-text-secondary flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-signal-green" />
            <span>On Time</span>
          </div>
          <div className="style-data-lg text-signal-green leading-tight mt-0.5">{onTimeCount}</div>
        </div>

        {/* Delayed */}
        <div className="bg-surface-2 border border-border rounded px-3 py-1.5 min-w-[90px]">
          <div className="style-label text-text-secondary flex items-center gap-1">
            <Clock className="h-3 w-3 text-signal-orange" />
            <span>Delayed</span>
          </div>
          <div className="style-data-lg text-signal-orange leading-tight mt-0.5">{delayedCount}</div>
        </div>

        {/* Active Conflicts */}
        <div className="bg-surface-2 border border-border rounded px-3 py-1.5 min-w-[90px]">
          <div className="style-label text-text-secondary flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-signal-red" />
            <span>Conflicts</span>
          </div>
          <div className="style-data-lg text-signal-red leading-tight mt-0.5">{activeConflicts}</div>
        </div>

        {/* Avg Delay */}
        <div className="bg-surface-2 border border-border rounded px-3 py-1.5 min-w-[90px]">
          <div className="style-label text-text-secondary flex items-center gap-1">
            <Clock className="h-3 w-3 text-text-tertiary" />
            <span>Avg Delay</span>
          </div>
          <div className="style-data-lg text-text-primary leading-tight mt-0.5">
            {avgDelay.toFixed(1)}<span className="text-xs font-normal">m</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-surface-2 border border-border rounded text-text-secondary">
          <CircleDot className={`h-3.5 w-3.5 ${getStatusColor()} pulse-indicator`} />
          <span className="style-label font-semibold">
            {wsStatus === 'Connected' ? 'OPERATIONAL' : 'OFFLINE'}
          </span>
        </div>

        {/* Clock */}
        <div className="text-right leading-none font-mono">
          <div className="style-data-md text-text-primary">{formatTime(simTime)}</div>
          <div className="style-data-sm text-text-tertiary mt-0.5">14 JUN 2026</div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowDisruptModal(true)}
          className="flex items-center gap-1.5 bg-signal-red hover:opacity-90 text-white px-3.5 py-2 rounded text-xs font-bold transition-all cursor-pointer shadow-md"
        >
          <Zap className="h-3.5 w-3.5" />
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
