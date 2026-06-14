import React, { useState, useMemo } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { ChevronDown, ChevronRight, GitCommit, Search, Eye, Filter, Info, ShieldAlert } from 'lucide-react';

export default function DecisionTree() {
  const { decisionTree } = useSimulatorState();
  const [expandedNodes, setExpandedNodes] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterMode, setFilterMode] = useState('best'); // 'best', 'beam', 'all'
  const [searchQuery, setSearchQuery] = useState('');

  // Find all node IDs on the "Best Path"
  const bestPathNodeIds = useMemo(() => {
    if (!decisionTree) return new Set();
    const pathIds = new Set();
    let current = decisionTree;
    
    while (current) {
      pathIds.add(current.node_id);
      if (!current.children || current.children.length === 0) break;
      
      // Select the child with lowest f_cost that was in the beam
      const beamChildren = current.children.filter(c => c.was_in_beam);
      if (beamChildren.length === 0) {
        current.children.sort((a, b) => a.f_cost - b.f_cost);
        current = current.children[0];
      } else {
        beamChildren.sort((a, b) => a.f_cost - b.f_cost);
        current = beamChildren[0];
      }
    }
    return pathIds;
  }, [decisionTree]);

  // Pre-expand root and first level children
  useMemo(() => {
    if (!decisionTree) return;
    const initialExpanded = { [decisionTree.node_id]: true };
    if (decisionTree.children) {
      decisionTree.children.forEach(c => {
        initialExpanded[c.node_id] = true;
      });
    }
    setExpandedNodes(initialExpanded);
  }, [decisionTree]);

  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const getPathColorClass = (node) => {
    const isBest = bestPathNodeIds.has(node.node_id);
    if (isBest) {
      return 'border-emerald-500/50 text-emerald-300 bg-emerald-950/15 shadow-sm shadow-emerald-950/20';
    }
    if (node.was_in_beam) {
      return 'border-purple-500/30 text-purple-300 bg-purple-950/5';
    }
    return 'border-slate-800 text-slate-500 bg-slate-900/40';
  };

  const getBadge = (node) => {
    if (bestPathNodeIds.has(node.node_id)) {
      return <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.2 rounded font-bold uppercase tracking-wider">Best Path</span>;
    }
    if (node.was_in_beam) {
      return <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/25 px-2 py-0.2 rounded font-bold uppercase tracking-wider">In Beam</span>;
    }
    return <span className="text-[8px] bg-slate-800 text-slate-500 border border-slate-700/60 px-2 py-0.2 rounded uppercase tracking-wider">Pruned</span>;
  };

  // Recursive node renderer
  const renderNode = (node) => {
    const isExpanded = !!expandedNodes[node.node_id];
    const hasChildren = node.children && node.children.length > 0;
    const isBestPath = bestPathNodeIds.has(node.node_id);
    const inBeam = node.was_in_beam;

    // Mode filter check (Simple Mode is forced 'best')
    const activeFilter = showAdvanced ? filterMode : 'best';

    if (activeFilter === 'best' && !isBestPath) return null;
    if (activeFilter === 'beam' && !inBeam && !isBestPath) return null;

    // Search query matching
    if (searchQuery) {
      const textMatches = node.action_text?.toLowerCase().includes(searchQuery.toLowerCase());
      const childMatches = node.children?.some(c => c.action_text?.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!textMatches && !childMatches) return null;
    }

    return (
      <div key={node.node_id} className="pl-4 border-l border-[#222530] relative my-1">
        {/* Connector Bullet */}
        <div className="absolute -left-1.5 top-3.5 h-2.5 w-2.5 rounded-full bg-[#222530] border-2 border-[#15171e]" />
        
        {/* Node detail display */}
        <div className="flex items-center gap-2 select-none py-0.5">
          {hasChildren && activeFilter !== 'best' ? (
            <button 
              onClick={() => toggleExpand(node.node_id)}
              className="p-0.5 rounded hover:bg-[#222530] text-slate-400 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <GitCommit className="h-3.5 w-3.5 text-slate-600 pl-0.5" />
          )}

          <div className={`flex items-center gap-3 border rounded px-3 py-1.5 transition-all text-xs font-mono max-w-full truncate ${getPathColorClass(node)}`}>
            <span className="font-semibold">{node.action_text || 'Initial Corridor Status (Root)'}</span>
            
            <div className="flex items-center gap-2 text-[9px] text-slate-500 border-l border-[#222530] pl-2">
              <span>Depth {node.depth}</span>
              <span>Cost: {node.f_cost ? Math.round(node.f_cost).toLocaleString() : '0'}</span>
            </div>
            
            {getBadge(node)}
          </div>
        </div>

        {/* Children rendering */}
        {hasChildren && (activeFilter !== 'best' ? isExpanded : true) && (
          <div className="mt-1 pl-2">
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#15171e] text-slate-200 p-4 select-none justify-between overflow-hidden">
      <div>
        {/* Controls Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222530] mb-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
            Reasoning Display Mode
          </span>
          
          {/* Advanced toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">Advanced Tree:</span>
            <button
              onClick={() => {
                setShowAdvanced(!showAdvanced);
                setFilterMode(!showAdvanced ? 'all' : 'best');
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none cursor-pointer ${
                showAdvanced ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                  showAdvanced ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Advanced Filters (Only visible when toggled) */}
        {showAdvanced && (
          <div className="flex items-center justify-between bg-[#0d0e12]/30 border border-[#222530] rounded p-1.5 mb-3">
            <span className="text-[9px] text-slate-500 font-bold uppercase pl-1.5 font-mono">Tree Filters</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setFilterMode('best')}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${filterMode === 'best' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Best Path
              </button>
              <button 
                onClick={() => setFilterMode('beam')}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${filterMode === 'beam' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Beam Only
              </button>
              <button 
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${filterMode === 'all' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                All States
              </button>
            </div>
          </div>
        )}

        {/* Search input (Only if advanced is open) */}
        {showAdvanced && (
          <div className="px-3 py-1.5 border border-[#222530] rounded flex items-center gap-2 bg-[#0d0e12]/40 mb-3">
            <Search className="h-3 w-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search tree actions (e.g. 'hold')..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-[10px] text-slate-300 focus:outline-none font-mono placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Informative banner for laymen */}
        {!showAdvanced && (
          <div className="bg-[#7c3aed]/5 border border-[#7c3aed]/15 rounded p-2.5 text-[10px] text-slate-400 flex items-start gap-1.5 leading-normal mb-4 font-mono">
            <Info className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
            <span>Showing optimal dispatch sequence. Enable <strong>Advanced Tree</strong> to view evaluated alternative states in the lookahead beam width.</span>
          </div>
        )}
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-auto bg-[#0d0e12]/20 border border-[#222530] rounded p-4 max-h-[500px]">
        {decisionTree ? (
          <div className="min-w-max">
            {renderNode(decisionTree)}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs italic py-16 font-mono">
            <ShieldAlert className="h-7 w-7 text-slate-600 mb-2" />
            <span>Select an advisory recommendation above to inspect search decision tree.</span>
          </div>
        )}
      </div>
    </div>
  );
}
