import React from 'react';
import { Activity } from 'lucide-react';

export default function Loading({ message = "Initializing Dispatcher Panel..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full h-full bg-[#0f1015] select-none p-6">
      <div className="relative flex items-center justify-center mb-6">
        {/* Radar concentric circular waves */}
        <div className="absolute h-20 w-20 rounded-full border border-purple-500/20 animate-ping duration-1000" />
        <div className="absolute h-32 w-32 rounded-full border border-purple-500/10 animate-ping duration-1500" />
        
        {/* Core spinner ring */}
        <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-r-2 border-purple-500 border-b-transparent border-l-transparent" />
        
        {/* Icon in the center */}
        <Activity className="absolute h-6 w-6 text-purple-400 animate-pulse" />
      </div>

      <div className="text-center">
        <h3 className="text-slate-200 font-bold text-sm tracking-wider uppercase mb-1">{message}</h3>
        <p className="text-slate-500 text-xs font-mono">Connecting to backend simulator feed...</p>
      </div>
    </div>
  );
}
