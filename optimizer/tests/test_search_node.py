from optimizer.search_node import SearchNode, TraceNode, SearchStats, ActionSequence
from simulator.env import Action
from simulator.train_state import NetworkState

def test_search_node_instantiation():
    # Test instantiating search node and trace node
    noop = Action(train_id="noop", action_type="noop")
    state = NetworkState(sim_time=840.0, trains={}, blocks={}, stations={})
    
    node = SearchNode(
        node_id="root",
        state=state,
        parent=None,
        action=noop,
        depth=0,
        g_cost=0.0,
        h_cost=100.0,
        f_cost=100.0
    )
    
    assert node.node_id == "root"
    assert len(node.children) == 0
    assert node.action == noop

def test_trace_node_instantiation():
    trace_child = TraceNode(
        node_id="child",
        depth=1,
        action_text="Hold Train 1 for 5 min",
        g_cost=10.0,
        h_cost=50.0,
        f_cost=60.0,
        was_in_beam=True
    )
    
    trace_parent = TraceNode(
        node_id="root",
        depth=0,
        action_text="Root",
        g_cost=0.0,
        h_cost=100.0,
        f_cost=100.0,
        was_in_beam=True,
        children=[trace_child]
    )
    
    assert trace_parent.node_id == "root"
    assert len(trace_parent.children) == 1
    assert trace_parent.children[0].node_id == "child"
