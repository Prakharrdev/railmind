import React, { useState, useMemo } from 'react';
import { useSimulatorState } from '../hooks/useSimulatorState';
import { ChevronDown, ChevronRight, GitCommit, Search, Eye, Filter } from 'lucide-react';

export default function DecisionTree() {
  const { decisionTree } = useSimulatorState();
  const [expandedNodes, setExpandedNodes] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'beam', 'best'
  const [searchQuery, setSearchQuery] = useState('');

  // Find all node IDs on the "Best Path".
  // The best path is defined as the sequence of nodes starting from the root 
  // that recursively follows the child with the lowest f_cost that was in the beam.
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
        // Fallback to absolute lowest cost child if none in beam
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
    if (bestPathNodeIds.has(node.node_id)) {
      return 'border-emerald-500 text-emerald-400 bg-emerald-950/15';
    }
    if (node.was_in_beam) {
      return 'border-indigo-500 text-indigo-400 bg-indigo-950/10';
    }
    return 'border-slate-800 text-slate-500 bg-slate-900/40';
  };

  const getBadge = (node) => {
    if (bestPathNodeIds.has(node.node_id)) {
      return <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 px-1.5 py-0.2 rounded font-bold uppercase">Optimal</span>;
    }
    if (node.was_in_beam) {
      return <span className="text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/35 px-1.5 py-0.2 rounded font-semibold uppercase">In Beam</span>;
    }
    return <span className="text-[8px] bg-slate-800 text-slate-500 border border-slate-700 px-1.5 py-0.2 rounded uppercase">Pruned</span>;
  };

  // Recursive node renderer
  const renderNode = (node) => {
    const isExpanded = !!expandedNodes[node.node_id];
    const hasChildren = node.children && node.children.length > 0;
    const isBestPath = bestPathNodeIds.has(node.node_id);
    const inBeam = node.was_in_beam;

    // Apply filters
    if (filterMode === 'best' && !isBestPath) return null;
    if (filterMode === 'beam' && !inBeam && !isBestPath) return null;

    if (searchQuery) {
      const textMatches = node.action_text?.toLowerCase().includes(searchQuery.toLowerCase());
      const childMatches = node.children?.some(c => c.action_text?.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!textMatches && !childMatches) return null;
    }

    return (
      <div key={node.node_id} className="pl-4 border-l border-[#2e303a]/40 relative my-1">
        {/* Node Card wrapper */}
        <div className="flex items-center gap-2 group select-none py-1">
          {/* Connector bullet */}
          <div className="absolute -left-1.5 top-3.5 h-2 w-2 rounded-full bg-[#2e303a] border border-[#12131a]" />
          
          {hasChildren ? (
            <button 
              onClick={() => toggleExpand(node.node_id)}
              className="p-0.5 rounded hover:bg-[#2e303a] text-slate-400 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <GitCommit className="h-3.5 w-3.5 text-slate-600 pl-0.5" />
          )}

          {/* Node detail display */}
          <div className={`flex items-center gap-3 border rounded px-3 py-1.5 transition-all text-xs font-mono max-w-full truncate ${getPathColorClass(node)}`}>
            <span className="font-semibold text-slate-100">{node.action_text || 'Start / Root State'}</span>
            
            <div className="flex items-center gap-2 text-[10px] text-slate-400 border-l border-[#2e303a] pl-2 font-semibold">
              <span>Depth {node.depth}</span>
              <span>Cost: {node.f_cost ? node.f_cost.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'}</span>
            </div>
            
            {getBadge(node)}
          </div>
        </div>

        {/* Children rendering */}
        {hasChildren && isExpanded && (
          <div className="mt-1 pl-2">
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#12131a] border border-[#2e303a] rounded-lg overflow-hidden flex flex-col h-[380px] select-none text-slate-200">
      {/* Header */}
      <div className="bg-[#161720] px-4 py-3 border-b border-[#2e303a] flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-purple-400" />
          <span>Search decision tree trace</span>
        </h2>
        
        {/* Filter modes */}
        <div className="flex items-center gap-1 bg-[#1a1c23] border border-[#2e303a] rounded p-0.5">
          <button 
            onClick={() => setFilterMode('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${filterMode === 'all' ? 'bg-[#2e303a] text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilterMode('beam')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${filterMode === 'beam' ? 'bg-[#2e303a] text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Beam
          </button>
          <button 
            onClick={() => setFilterMode('best')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${filterMode === 'best' ? 'bg-[#2e303a] text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Best Path
          </button>
        </div>
      </div>

      {/* Search Filter input */}
      <div className="px-4 py-2 border-b border-[#2e303a]/50 flex items-center gap-2 bg-[#161720]/40">
        <Search className="h-3.5 w-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter actions (e.g. 'hold')..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-slate-300 focus:outline-none font-mono placeholder:text-slate-600"
        />
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto p-4 bg-[#0f1015]/40">
        {decisionTree ? (
          <div className="min-w-max">
            {renderNode(decisionTree)}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs italic">
            <span>Select a generated advisory recommendation to inspect search decision tree.</span>
          </div>
        )}
      </div>
    </div>
  );
}
