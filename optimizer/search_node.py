from dataclasses import dataclass, field
from typing import List, Optional
from simulator.env import Action
from simulator.train_state import NetworkState

@dataclass
class SearchNode:
    node_id: str
    state: NetworkState
    parent: Optional["SearchNode"]
    action: Optional[Action]
    depth: int
    g_cost: float
    h_cost: float
    f_cost: float
    children: List["SearchNode"] = field(default_factory=list)

@dataclass
class TraceNode:
    node_id: str
    depth: int
    action_text: str
    g_cost: float
    h_cost: float
    f_cost: float
    was_in_beam: bool
    children: List["TraceNode"] = field(default_factory=list)

@dataclass
class SearchStats:
    nodes_generated: int
    nodes_expanded: int
    nodes_pruned: int
    beam_width: int
    depth: int
    latency_ms: float

@dataclass
class ActionSequence:
    actions: List[Action]
    projected_cost: float
    baseline_cost: float
    improvement_pct: float
    decision_trace: TraceNode
    stats: SearchStats
