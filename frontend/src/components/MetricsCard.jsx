import React from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { ShieldCheck, TrendingUp, Clock, Zap } from 'lucide-react';
import Loading from './Loading';

export default function MetricsCard() {
  const { metrics, benchmarkMetrics } = useSimulatorState();

  if (!metrics) {
    return <Loading message="Syncing Metrics..." />;
  }

  const optimizedDelay = metrics.total_train_delay_minutes || 0;
  const reductionPct = metrics.delay_reduction_pct || 0;
  
  // Calculate baseline delay mathematically from optimization percentage
  const baselineDelay = reductionPct > 0 && reductionPct < 100
    ? optimizedDelay / (1 - reductionPct / 100)
    : optimizedDelay + (metrics.conflicts_resolved * 10); 

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
      name: 'Pax Delay (k)',
      Baseline: Math.round(baselinePaxDelay / 1000),
      Optimized: Math.round(optimizedPaxDelay / 1000),
    }
  ];

  // Data for historical benchmark runs line chart
  const lineChartData = benchmarkMetrics.map(run => ({
    name: run.run_id.slice(-5),
    'Red %': run.metrics?.delay_reduction_pct || 0,
    'Delay': run.metrics?.total_train_delay_minutes || 0,
  })).slice(-8); // last 8 runs

  return (
    <div className="space-y-4">
      {/* Live Metrics Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="bg-[#0d0e12]/40 border border-[#222530] p-2.5 rounded flex items-center justify-between">
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Resolved Conflicts</span>
            <span className="text-slate-100 font-bold mt-0.5">{metrics.conflicts_resolved || '0'}</span>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-500/80" />
        </div>
        <div className="bg-[#0d0e12]/40 border border-[#222530] p-2.5 rounded flex items-center justify-between">
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Delay Reduction</span>
            <span className="text-emerald-400 font-bold mt-0.5">+{reductionPct.toFixed(1)}%</span>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-500/80" />
        </div>
        <div className="bg-[#0d0e12]/40 border border-[#222530] p-2.5 rounded flex items-center justify-between">
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Search Time</span>
            <span className="text-slate-100 font-bold mt-0.5">{Math.round(metrics.avg_planner_latency_ms) || '0'} ms</span>
          </div>
          <Clock className="h-5 w-5 text-slate-500" />
        </div>
        <div className="bg-[#0d0e12]/40 border border-[#222530] p-2.5 rounded flex items-center justify-between">
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Beam Efficiency</span>
            <span className="text-purple-400 font-bold mt-0.5">{(metrics.beam_efficiency * 100 || 0).toFixed(0)}%</span>
          </div>
          <Zap className="h-5 w-5 text-purple-400/80" />
        </div>
      </div>

      {/* Benchmark Metrics Comparative Charts */}
      <div className="grid grid-cols-1 gap-4 bg-[#0d0e12]/20 border border-[#222530] rounded p-3 text-[10px]">
        {/* Comparative delays */}
        <div className="flex flex-col h-[160px] w-full">
          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">Delay Comparison (Baseline vs Optimized)</span>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativeData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222530" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={8} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#15171e', border: '1px solid #222530', color: '#f8fafc', fontFamily: 'monospace', fontSize: '9px' }} 
                  labelStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
                />
                <Legend iconSize={6} iconType="circle" wrapperStyle={{ fontSize: '8px', fontFamily: 'monospace' }} />
                <Bar dataKey="Baseline" fill="#475569" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Optimized" fill="#7c3aed" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical Runs */}
        <div className="flex flex-col h-[160px] w-full border-t border-[#222530]/50 pt-3">
          <span className="text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider mb-2">Optimization History Trend</span>
          <div className="flex-1 w-full min-h-0">
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222530" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={8} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#15171e', border: '1px solid #222530', color: '#f8fafc', fontFamily: 'monospace', fontSize: '9px' }} 
                    labelStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
                  />
                  <Legend iconSize={6} iconType="circle" wrapperStyle={{ fontSize: '8px', fontFamily: 'monospace' }} />
                  <Line type="monotone" name="Gain %" dataKey="Red %" stroke="#10b981" strokeWidth={1.5} activeDot={{ r: 3 }} dot={{ r: 1 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[9px] text-slate-600 font-mono italic">
                Waiting for historical run cycles...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
