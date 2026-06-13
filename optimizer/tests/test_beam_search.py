import os
import json
import time
import pytest
from simulator.env import TrainNetworkSimulator
from optimizer.scorer import StateScorer
from optimizer.csp_checker import ConstraintChecker
from optimizer.beam_search import BeamSearchPlanner
from optimizer.search_node import ActionSequence

CORRIDOR_PATH = "data/processed/corridor.json"
TIMETABLE_PATH = "data/processed/timetable.json"
DISTRIBUTIONS_PATH = "data/processed/delay_distributions.json"

@pytest.fixture
def simulator():
    return TrainNetworkSimulator(CORRIDOR_PATH, TIMETABLE_PATH, DISTRIBUTIONS_PATH)

@pytest.fixture
def scorer(simulator):
    return StateScorer(simulator.graph, simulator.timetable_data)

@pytest.fixture
def csp_checker(simulator):
    return ConstraintChecker(simulator.graph)

@pytest.fixture
def planner(simulator, scorer, csp_checker):
    return BeamSearchPlanner(simulator, scorer, csp_checker, depth=4, beam_width=8)

def test_planner_initialization(planner):
    assert planner.depth == 4
    assert planner.beam_width == 8
    assert planner.last_sequence is None

def test_planner_plan_execution(planner, simulator):
    state = simulator.current_state()
    
    # Execute planner with depth 2 and beam width 4 to be faster in unit tests
    seq = planner.plan(state, depth=2, beam_width=4)
    
    assert isinstance(seq, ActionSequence)
    assert len(seq.actions) > 0
    assert seq.projected_cost >= 0.0
    assert seq.baseline_cost >= 0.0
    assert seq.decision_trace is not None
    assert seq.decision_trace.node_id == "node_0"
    assert seq.stats.nodes_generated > 0

def test_select_action_policy_interface(planner, simulator):
    state = simulator.current_state()
    
    action, breakdown = planner.select_action(state)
    
    assert action is not None
    assert breakdown is not None
    assert planner.last_sequence is not None

def test_immutability_under_search(planner, simulator):
    state = simulator.current_state()
    # Save original delays
    original_delays = {tid: train.delay_minutes for tid, train in state.trains.items()}
    
    # Run a full plan
    planner.plan(state, depth=3, beam_width=4)
    
    # Assert that the root state trains have not been mutated by the search
    for tid, delay in original_delays.items():
        assert state.trains[tid].delay_minutes == delay

def test_default_config_latency(planner, simulator):
    state = simulator.current_state()
    
    # Measure default planner run (depth=4, beam_width=8)
    start = time.perf_counter()
    planner.plan(state, depth=4, beam_width=8)
    latency_ms = (time.perf_counter() - start) * 1000.0
    
    print(f"\nDefault Beam Search Latency: {latency_ms:.2f}ms")
    # Performance Target: Default configuration must run in under 200ms per planning step.
    assert latency_ms < 200.0
