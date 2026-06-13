from typing import Optional, Set
from simulator.env import Action
from simulator.train_state import NetworkState
from optimizer.search_node import SearchNode, TraceNode

def format_action(action: Optional[Action], state: NetworkState) -> str:
    """Formats an Action object into a human-readable string description."""
    if not action or action.action_type == "noop":
        return "Do nothing (noop)"
    if action.action_type == "hold":
        train = state.trains.get(action.train_id)
        train_name = train.name if train else f"Train {action.train_id}"
        # Standardize duration format: check if integer or float
        dur = int(action.hold_minutes) if action.hold_minutes.is_integer() else action.hold_minutes
        return f"Hold {train_name} for {dur} minutes"
    return "Unknown action"

def build_trace_tree(node: SearchNode, beam_node_ids: Set[str], root_state: NetworkState) -> TraceNode:
    """Recursively translates a SearchNode tree into a TraceNode tree."""
    action_text = format_action(node.action, root_state) if node.parent is not None else "Root State"
    
    # Recursively build trace children
    children = [build_trace_tree(child, beam_node_ids, root_state) for child in node.children]
    
    return TraceNode(
        node_id=node.node_id,
        depth=node.depth,
        action_text=action_text,
        g_cost=node.g_cost,
        h_cost=node.h_cost,
        f_cost=node.f_cost,
        was_in_beam=node.node_id in beam_node_ids,
        children=children
    )
