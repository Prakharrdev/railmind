import React from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { Train, Shield, HelpCircle, Navigation } from 'lucide-react';

export default function Sidebar() {
  const { trains, selectedTrainId, setSelectedTrainId } = useSimulatorState();

  const getClassBadge = (trainClass) => {
    switch (trainClass) {
      case 'rajdhani_vande_bharat':
      case 'shatabdi':
        return 'border-rose-500/35 bg-rose-500/10 text-rose-400';
      case 'premium_mail_express':
      case 'superfast':
        return 'border-amber-500/35 bg-amber-500/10 text-amber-400';
      case 'freight':
        return 'border-indigo-500/35 bg-indigo-500/10 text-indigo-400';
      default:
        return 'border-slate-500/35 bg-slate-500/10 text-slate-400';
    }
  };

  const getDelayColor = (delay) => {
    if (delay <= 0) return 'text-slate-500';
    if (delay < 5) return 'text-emerald-400 font-semibold';
    if (delay < 15) return 'text-amber-400 font-semibold';
    return 'text-rose-400 font-bold';
  };

  return (
    <aside className="w-80 bg-[#12131a] border-r border-[#2e303a] flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#2e303a] bg-[#161720]">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Train className="h-4 w-4 text-purple-400" />
          <span>Active Train Fleet ({trains.length})</span>
        </h2>
      </div>

      {/* Train list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2e303a]/50">
        {trains.map((train) => {
          const isSelected = selectedTrainId === train.train_id;
          return (
            <div
              key={train.train_id}
              onClick={() => setSelectedTrainId(isSelected ? null : train.train_id)}
              className={`p-3.5 cursor-pointer transition-all duration-150 relative ${
                isSelected ? 'bg-purple-950/20 border-l-2 border-purple-500' : 'hover:bg-[#1a1c25]/40 border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <div className="font-semibold text-slate-200 text-sm">{train.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">ID: {train.train_id}</div>
                </div>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 border rounded ${getClassBadge(train.train_class)}`}>
                  {train.train_class?.split('_')[0] || 'Train'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Navigation className="h-3 w-3 text-slate-500" />
                  <span>Speed:</span>
                  <span className="font-mono text-slate-300 font-semibold">{Math.round(train.speed_kmph)} km/h</span>
                </div>
                <div className="text-right">
                  <span>Delay: </span>
                  <span className={getDelayColor(train.delay_minutes)}>
                    {train.delay_minutes > 0 ? `+${Math.round(train.delay_minutes)}m` : 'On Time'}
                  </span>
                </div>
              </div>

              {/* Status details: Held, Section, Station */}
              <div className="mt-2 text-[10px] font-mono flex items-center justify-between text-slate-500 bg-[#0f1015]/60 px-2 py-1 rounded">
                <div className="truncate pr-1">
                  {train.section_id ? (
                    <span className="text-purple-400/80"> traveling: {train.section_id}</span>
                  ) : (
                    <span className="text-emerald-400/80">stopped @ {train.last_station}</span>
                  )}
                </div>
                {train.is_held && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-sm font-semibold animate-pulse text-[9px]">
                    HELD
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {trains.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No trains active in current simulator state.
          </div>
        )}
      </div>
    </aside>
  );
}
