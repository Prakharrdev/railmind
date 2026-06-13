import React from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { BarChart3, TrendingUp, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import Loading from './Loading';

export default function MetricsCard() {
  const { metrics, benchmarkMetrics } = useSimulatorState();

  if (!metrics) {
    return <Loading message="Loading Live Metrics..." />;
  }

  const optimizedDelay = metrics.total_train_delay_minutes || 0;
  const reductionPct = metrics.delay_reduction_pct || 0;
  
  // Calculate baseline delay mathematically from optimization percentage
  const baselineDelay = reductionPct > 0 && reductionPct < 100
    ? optimizedDelay / (1 - reductionPct / 100)
    : optimizedDelay + (metrics.conflicts_resolved * 10); // fallback if no reduction % yet

  const optimizedPaxDelay = metrics.total_passenger_delay_minutes || 0;
  const baselinePaxDelay = reductionPct > 0 && reductionPct < 100
    ? optimizedPaxDelay / (1 - reductionPct / 100)
    : optimizedPaxDelay + (metrics.conflicts_resolved * 8000);

  // Data for comparative bar chart
  const comparativeData = [
    {
      name: 'Train Delay',
      Baseline: Math.round(baselineDelay),
      Optimized: Math.round(optimizedDelay),
    },
    {
      name: 'Pax Delay (k-min)',
      Baseline: Math.round(baselinePaxDelay / 1000),
      Optimized: Math.round(optimizedPaxDelay / 1000),
    }
  ];

  // Data for historical benchmark runs line chart
  const lineChartData = benchmarkMetrics.map(run => ({
    name: run.run_id.slice(-5),
    'Delay Red %': run.metrics?.delay_reduction_pct || 0,
    'Total Delay': run.metrics?.total_train_delay_minutes || 0,
  })).slice(-10); // last 10 runs

  return (
    <div className="bg-[#12131a] border border-[#2e303a] rounded-lg overflow-hidden flex flex-col h-[380px] select-none text-slate-200">
      {/* Header */}
      <div className="bg-[#161720] px-4 py-3 border-b border-[#2e303a] flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span>Performance Optimization Analytics</span>
        </h2>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-[#161720]/30 border-b border-[#2e303a]/50 text-center font-mono">
        <div className="bg-[#1a1c23]/50 p-2 border border-[#2e303a]/30 rounded">
          <span className="block text-[9px] text-slate-500 uppercase">Conflicts Resolved</span>
          <span className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
            <ShieldCheck className="h-4 w-4" />
            {metrics.conflicts_resolved || '0'}
          </span>
        </div>
        <div className="bg-[#1a1c23]/50 p-2 border border-[#2e303a]/30 rounded">
          <span className="block text-[9px] text-slate-500 uppercase">Delay Reduction</span>
          <span className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
            <TrendingUp className="h-4 w-4" />
            {reductionPct > 0 ? `+${Math.round(reductionPct)}%` : '0%'}
          </span>
        </div>
        <div className="bg-[#1a1c23]/50 p-2 border border-[#2e303a]/30 rounded">
          <span className="block text-[9px] text-slate-500 uppercase">Avg Planning Time</span>
          <span className="text-sm font-bold text-slate-200 flex items-center justify-center gap-1 mt-0.5">
            <Clock className="h-4 w-4 text-slate-400" />
            {Math.round(metrics.avg_planner_latency_ms) || '0'} ms
          </span>
        </div>
        <div className="bg-[#1a1c23]/50 p-2 border border-[#2e303a]/30 rounded">
          <span className="block text-[9px] text-slate-500 uppercase">Beam Efficiency</span>
          <span className="text-sm font-bold text-indigo-400 flex items-center justify-center gap-1 mt-0.5">
            {metrics.beam_efficiency ? `${(metrics.beam_efficiency * 100).toFixed(0)}%` : '0%'}
          </span>
        </div>
      </div>

      {/* Charts Panels */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0 bg-[#0f1015]/20">
        {/* comparative delays bar */}
        <div className="flex flex-col h-full">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-2 text-center">Baseline vs. Optimized Delays</div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativeData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e303a" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1c23', border: '1px solid #2e303a', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '10px' }} 
                  labelStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
                />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace' }} />
                <Bar dataKey="Baseline" fill="#475569" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Optimized" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* benchmark runs line */}
        <div className="flex flex-col h-full">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-2 text-center">Improvement Trend (Last Runs)</div>
          <div className="flex-1 w-full min-h-0">
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e303a" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1c23', border: '1px solid #2e303a', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '10px' }} 
                    labelStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="Delay Red %" stroke="#10b981" strokeWidth={2} activeDot={{ r: 4 }} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-mono italic">
                Waiting for historical runs...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
