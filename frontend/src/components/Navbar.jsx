import React, { useState } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Activity, AlertTriangle, Play, Wifi, WifiOff } from 'lucide-react';

export default function Navbar() {
  const { wsStatus, trains, injectDisruption } = useSimulatorState();
  const [showDisruptModal, setShowDisruptModal] = useState(false);
  const [disruptForm, setDisruptForm] = useState({
    disruption_id: 'disrupt_' + Math.floor(Math.random() * 1000),
    train_id: '',
    disruption_type: 'engine_slow',
    magnitude_minutes: 30,
    start_time: 845,
    end_time: 875,
    target_id: ''
  });

  const getStatusColor = () => {
    switch (wsStatus) {
      case 'Connected': return 'bg-emerald-500 text-emerald-500';
      case 'Connecting':
      case 'Reconnecting': return 'bg-amber-500 text-amber-500';
      default: return 'bg-rose-500 text-rose-500';
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
      // Reset form
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

  return (
    <nav className="bg-[#12131a] border-b border-[#2e303a] px-6 py-4 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-purple-400" />
        <span className="font-bold text-lg tracking-wider text-slate-100 uppercase">RailMind Operations Center</span>
      </div>

      <div className="flex items-center gap-6">
        {/* WS Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1c23] border border-[#2e303a] rounded-md text-xs font-semibold text-slate-300">
          {wsStatus === 'Connected' ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-rose-400" />}
          <span>System: {wsStatus}</span>
          <span className={`h-2 w-2 rounded-full ${getStatusColor()} animate-pulse`} />
        </div>

        {/* Inject Disruption Button */}
        <button
          onClick={() => setShowDisruptModal(true)}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-sm font-semibold transition-colors duration-200"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Inject Disruption</span>
        </button>
      </div>

      {/* Disruption Modal Overlay */}
      {showDisruptModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12131a] border border-[#2e303a] rounded-lg w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-rose-500 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Simulate Infrastructure Disruption</span>
            </h3>
            
            <form onSubmit={handleDisruptSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">DISRUPTION ID</label>
                <input
                  type="text"
                  required
                  value={disruptForm.disruption_id}
                  onChange={e => setDisruptForm(prev => ({ ...prev, disruption_id: e.target.value }))}
                  className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">TARGET TRAIN</label>
                <select
                  required
                  value={disruptForm.train_id}
                  onChange={e => setDisruptForm(prev => ({ ...prev, train_id: e.target.value }))}
                  className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none focus:border-rose-500"
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">DISRUPTION TYPE</label>
                <select
                  value={disruptForm.disruption_type}
                  onChange={e => setDisruptForm(prev => ({ ...prev, disruption_type: e.target.value }))}
                  className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="engine_slow">Engine Slowdown (40% Speed)</option>
                  <option value="platform_block">Platform Blockage (Capacity Loss)</option>
                  <option value="signal_hold">Signal Failure (Block Red Aspect)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">MAGNITUDE (MIN)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={disruptForm.magnitude_minutes}
                    onChange={e => setDisruptForm(prev => ({ ...prev, magnitude_minutes: e.target.value }))}
                    className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">START (SIM MIN)</label>
                  <input
                    type="number"
                    required
                    min="840"
                    value={disruptForm.start_time}
                    onChange={e => setDisruptForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">END (SIM MIN)</label>
                  <input
                    type="number"
                    required
                    min="840"
                    value={disruptForm.end_time}
                    onChange={e => setDisruptForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {disruptForm.disruption_type !== 'engine_slow' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">TARGET BLOCK/STATION ID</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS or NDLS_GZB_02"
                    value={disruptForm.target_id}
                    onChange={e => setDisruptForm(prev => ({ ...prev, target_id: e.target.value }))}
                    className="w-full bg-[#1a1c23] border border-[#2e303a] rounded p-2 text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisruptModal(false)}
                  className="bg-[#1a1c23] hover:bg-[#2e303a] border border-[#2e303a] text-slate-300 px-4 py-2 rounded transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded transition-colors duration-150 flex items-center gap-1.5"
                >
                  <Play className="h-4 w-4" />
                  <span>Execute Injection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
